import { useState } from 'react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import {
  searchTraceabilityRequest,
  getTraceabilityByCodeRequest,
  getTraceabilityByRefRequest,
  searchTraceabilityByFiltersRequest,
} from '../../services/traceability.service'

const TRACE_CODE_PATTERN = /^[A-Za-z]{2,4}-\d{6}-\d{3,}$/

const TYPE_LABELS = {
  entrada: 'Entrada',
  lote: 'Lote MP',
  sublote: 'Sub-lote',
  proceso: 'Proceso',
  red: 'Red verde',
  existencia: 'Existencia',
  pedido: 'Pedido',
}

const AREA_OPTIONS = [
  { key: 'maduracion', label: 'Maduracion (lotes/sub-lotes activos)' },
  { key: 'produccion', label: 'Produccion (procesos en curso)' },
  { key: 'redes', label: 'Redes verdes empacadas' },
  { key: 'inventario', label: 'Producto terminado (por vencimiento)' },
  { key: 'pedidos', label: 'Pedidos entregados' },
]

const ALL_AREA_KEYS = AREA_OPTIONS.map((option) => option.key)

const formatNumber = (value, unit) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '-'
  }

  const formatted = new Intl.NumberFormat('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value))
  return unit ? `${formatted} ${unit}` : formatted
}

const formatDate = (value) => {
  if (!value) {
    return '-'
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString('es-GT', { year: 'numeric', month: 'short', day: 'numeric' })
}

const formatDateTime = (value) => {
  if (!value) {
    return '-'
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString('es-GT', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function TraceNode({ level, title, subtitle, badge, defaultCollapsed, children }) {
  const [collapsed, setCollapsed] = useState(Boolean(defaultCollapsed))

  return (
    <div className={`trace-node trace-node-level-${level}`}>
      <button
        type="button"
        className="trace-node-header"
        onClick={() => setCollapsed((current) => !current)}
        aria-expanded={!collapsed}
      >
        {badge ? <span className="trace-badge">{badge}</span> : null}
        <div className="trace-node-text">
          <p className="trace-node-title">{title}</p>
          {subtitle ? <p className="trace-node-subtitle">{subtitle}</p> : null}
        </div>
        <span className={`dashboard-collapse-chevron trace-node-chevron ${collapsed ? 'is-collapsed' : ''}`} aria-hidden="true">
          ▾
        </span>
      </button>
      {children && !collapsed ? <div className="trace-children">{children}</div> : null}
    </div>
  )
}

function TraceLeafTable({ emptyMessage, columns, rows, rowKey }) {
  if (!rows || rows.length === 0) {
    return <p className="widget-muted trace-leaf-empty">{emptyMessage}</p>
  }

  return (
    <div className="providers-table-wrap table-limited trace-leaf-table">
      <table className="providers-table">
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key}>{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={rowKey ? rowKey(row) : (row.id ?? index)}>
              {columns.map((col) => (
                <td key={col.key}>{col.render ? col.render(row) : row[col.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// Solo se usa para producto terminado resultante / entradas directas: un resumen
// de una linea, sin desglose de movimientos (eso ya lo cubre el modulo de Inventario).
// Si el lote ya se vendio, tambien lista hacia adelante a que pedido/cliente se entrego.
function TraceExistenciaSummary({ existencia }) {
  if (!existencia) {
    return null
  }

  const pedidos = existencia.pedidos || []

  return (
    <div className="trace-existencia-summary">
      <span className="trace-badge">{TYPE_LABELS.existencia}</span>
      <div className="trace-node-text">
        <p className="trace-node-title">
          Existencia #{existencia.id_existencia} - {existencia.producto_nombre || 'Producto sin nombre'}
        </p>
        <p className="trace-node-subtitle">
          Disponible: {formatNumber(existencia.cantidad_disponible)} | Vence: {formatDate(existencia.fecha_vencimiento)} | Estado: {existencia.estado_registro}
        </p>
        {pedidos.length > 0 ? (
          <TraceLeafTable
            emptyMessage="Este lote aun no se ha vendido."
            rowKey={(row) => row.id_detalle}
            rows={pedidos}
            columns={[
              { key: 'pedido', label: 'Pedido', render: (row) => `#${row.id_pedido}` },
              { key: 'cliente', label: 'Cliente', render: (row) => row.nombre_comercial || `Cliente #${row.id_cliente}` },
              { key: 'cantidad', label: 'Cantidad', render: (row) => formatNumber(row.cantidad) },
              { key: 'estado_entrega', label: 'Entrega', render: (row) => row.estado_entrega },
              { key: 'pedido_estado', label: 'Estado pedido', render: (row) => row.pedido_estado },
            ]}
          />
        ) : (
          <p className="widget-muted trace-leaf-empty">Este lote aun no se ha vendido.</p>
        )}
      </div>
    </div>
  )
}

// Una tabla identificada con todas las redes del sub-lote, en vez de un nodo
// colapsable por cada red (que antes obligaba a expandir una por una para ver algo).
function TraceRedesTable({ redes }) {
  const totalRedes = redes.reduce((sum, red) => sum + (Number(red.cantidad_redes) || 0), 0)

  return (
    <div className="trace-subsection">
      <p className="trace-subsection-title">
        Cajas de red verde empacadas ({redes.length}{totalRedes > 0 ? `, ${totalRedes} redes` : ''})
      </p>
      <TraceLeafTable
        emptyMessage="Sin cajas de red verde empacadas."
        rowKey={(row) => row.id_red}
        columns={[
          { key: 'id_red', label: 'Caja #', render: (row) => `#${row.id_red}` },
          { key: 'producto', label: 'Producto', render: (row) => row.existencia?.producto_nombre || '-' },
          { key: 'cantidad_redes', label: 'Redes', render: (row) => row.cantidad_redes ?? '-' },
          { key: 'peso_kg', label: 'Peso', render: (row) => formatNumber(row.peso_kg, 'kg') },
          { key: 'fecha_empaque', label: 'Empacado', render: (row) => formatDateTime(row.fecha_empaque) },
          { key: 'usuario_nombre', label: 'Por', render: (row) => row.usuario_nombre || '-' },
          { key: 'disponible', label: 'Disponible', render: (row) => formatNumber(row.existencia?.cantidad_disponible) },
          { key: 'vence', label: 'Vence', render: (row) => formatDate(row.existencia?.fecha_vencimiento) },
          { key: 'estado', label: 'Estado', render: (row) => row.existencia?.estado_registro || '-' },
        ]}
        rows={redes}
      />
    </div>
  )
}

// KPIs del recorrido completo: la primera pregunta ("por lotes que esta teniendo")
// se responde de un vistazo, sin tener que abrir cada nodo del arbol.
function TraceSummary({ raiz }) {
  const lotes = raiz.lotes || []
  const sublotes = lotes.flatMap((lote) => lote.sublotes || [])
  const redes = sublotes.flatMap((sublote) => sublote.redes || [])
  const procesos = sublotes.flatMap((sublote) => sublote.procesos || [])
  const procesosFinalizados = procesos.filter((proceso) => proceso.estado_proceso === 'Finalizado')
  const procesosActivos = procesos.length - procesosFinalizados.length
  const kgProducido = procesosFinalizados.reduce((sum, proceso) => sum + (Number(proceso.cantidad_producida_kg) || 0), 0)
  const kgEnRedes = redes.reduce((sum, red) => sum + (Number(red.peso_kg) || 0), 0)
  const totalRedesIndividuales = redes.reduce((sum, red) => sum + (Number(red.cantidad_redes) || 0), 0)

  const stats = [
    { label: 'Lotes MP', value: lotes.length },
    { label: 'Sub-lotes', value: sublotes.length },
    {
      label: 'Cajas de red verde',
      value: redes.length,
      hint: redes.length > 0 ? `${totalRedesIndividuales} redes | ${formatNumber(kgEnRedes, 'kg')}` : null,
    },
    { label: 'Procesos activos', value: procesosActivos },
    {
      label: 'Procesos finalizados',
      value: procesosFinalizados.length,
      hint: procesosFinalizados.length > 0 ? `${formatNumber(kgProducido, 'kg')} producido` : null,
    },
  ]

  return (
    <div className="inventory-summary trace-summary">
      {stats.map((stat) => (
        <article className="inventory-metric" key={stat.label}>
          <span>{stat.label}</span>
          <strong>{stat.value}</strong>
          {stat.hint ? <small>{stat.hint}</small> : null}
        </article>
      ))}
    </div>
  )
}

function TraceProceso({ proceso, defaultCollapsed }) {
  return (
    <TraceNode
      level={3}
      badge={TYPE_LABELS.proceso}
      title={`Proceso #${proceso.id_proceso} - ${proceso.producto_resultado_nombre || 'Producto sin definir'}`}
      subtitle={`Ingresado: ${formatNumber(proceso.cantidad_ingresada_kg, 'kg')} | Producido: ${formatNumber(proceso.cantidad_producida_kg, 'kg')} | Rendimiento: ${formatNumber(proceso.rendimiento_porcentaje)}% | Estado: ${proceso.estado_proceso}`}
      defaultCollapsed={defaultCollapsed}
    >
      <div className="trace-subsection">
        <p className="trace-subsection-title">Etapas</p>
        <TraceLeafTable
          emptyMessage="Sin etapas registradas."
          columns={[
            { key: 'nombre_etapa', label: 'Etapa' },
            { key: 'fecha_inicio', label: 'Inicio', render: (row) => formatDateTime(row.fecha_inicio) },
            { key: 'fecha_fin', label: 'Fin', render: (row) => formatDateTime(row.fecha_fin) },
            { key: 'cantidad_entrada_kg', label: 'Entrada', render: (row) => formatNumber(row.cantidad_entrada_kg, 'kg') },
            { key: 'cantidad_salida_kg', label: 'Salida', render: (row) => formatNumber(row.cantidad_salida_kg, 'kg') },
            { key: 'merma_kg', label: 'Merma', render: (row) => formatNumber(row.merma_kg, 'kg') },
          ]}
          rows={proceso.etapas}
        />
      </div>

      <div className="trace-subsection">
        <p className="trace-subsection-title">Mermas</p>
        <TraceLeafTable
          emptyMessage="Sin mermas registradas."
          columns={[
            { key: 'nombre_merma', label: 'Categoria' },
            { key: 'cantidad_kg', label: 'Cantidad', render: (row) => formatNumber(row.cantidad_kg, 'kg') },
            { key: 'fecha_registro', label: 'Fecha', render: (row) => formatDateTime(row.fecha_registro) },
            { key: 'observaciones', label: 'Observaciones', render: (row) => row.observaciones || '-' },
          ]}
          rows={proceso.mermas}
        />
      </div>

      <div className="trace-subsection">
        <p className="trace-subsection-title">Insumos consumidos</p>
        <TraceLeafTable
          emptyMessage="Sin insumos registrados."
          columns={[
            { key: 'producto_nombre', label: 'Producto' },
            { key: 'cantidad', label: 'Cantidad', render: (row) => formatNumber(row.cantidad, row.unidad_medida) },
            { key: 'fecha_registro', label: 'Fecha', render: (row) => formatDateTime(row.fecha_registro) },
          ]}
          rows={proceso.insumos}
        />
      </div>

      {proceso.diferencia_kg !== null && proceso.diferencia_kg !== undefined ? (
        <p className="widget-muted trace-note">
          Diferencia de balance de masa: {formatNumber(proceso.diferencia_kg, 'kg')}
          {proceso.justificacion_diferencia ? ` - ${proceso.justificacion_diferencia}` : ''}
        </p>
      ) : null}

      {proceso.existencias && proceso.existencias.length > 0 ? (
        <div className="trace-subsection">
          <p className="trace-subsection-title">Producto terminado resultante</p>
          {proceso.existencias.map((existencia) => (
            <TraceExistenciaSummary key={existencia.id_existencia} existencia={existencia} />
          ))}
        </div>
      ) : null}
    </TraceNode>
  )
}

function TraceSublote({ sublote, defaultCollapsed }) {
  return (
    <TraceNode
      level={2}
      badge={TYPE_LABELS.sublote}
      title={`Sub-lote #${sublote.id_sublote} (${sublote.codigo_sublote})`}
      subtitle={`Peso actual: ${formatNumber(sublote.peso_kg, 'kg')} | Maduracion: ${sublote.estado_maduracion} | Estado: ${sublote.estado_registro}`}
      defaultCollapsed={defaultCollapsed}
    >
      <div className="trace-subsection">
        <p className="trace-subsection-title">Controles de maduracion</p>
        <TraceLeafTable
          emptyMessage="Sin controles registrados."
          columns={[
            { key: 'fecha_medicion', label: 'Fecha', render: (row) => formatDateTime(row.fecha_medicion) },
            { key: 'grados_brix', label: 'Brix', render: (row) => formatNumber(row.grados_brix) },
            { key: 'peso_medido_kg', label: 'Peso medido', render: (row) => formatNumber(row.peso_medido_kg, 'kg') },
            { key: 'temperatura_cuarto', label: 'Temp.', render: (row) => formatNumber(row.temperatura_cuarto) },
          ]}
          rows={sublote.controles}
        />
      </div>

      <TraceRedesTable redes={sublote.redes} />

      {sublote.procesos.length > 0 ? (
        <div className="trace-subsection">
          <p className="trace-subsection-title">Procesos de produccion ({sublote.procesos.length})</p>
          {sublote.procesos.map((proceso) => (
            <TraceProceso key={proceso.id_proceso} proceso={proceso} defaultCollapsed={defaultCollapsed} />
          ))}
        </div>
      ) : null}
    </TraceNode>
  )
}

function TraceLote({ lote, defaultCollapsed }) {
  return (
    <TraceNode
      level={1}
      badge={TYPE_LABELS.lote}
      title={`Lote MP #${lote.id_lote_mp} - ${lote.producto_nombre || 'Producto sin nombre'}`}
      subtitle={`Peso inicial: ${formatNumber(lote.peso_inicial_kg, 'kg')} | Unidades: ${lote.cantidad_unidades ?? '-'} | Estado: ${lote.estado_registro}`}
      defaultCollapsed={defaultCollapsed}
    >
      {lote.sublotes.map((sublote) => (
        <TraceSublote key={sublote.id_sublote} sublote={sublote} defaultCollapsed={defaultCollapsed} />
      ))}
    </TraceNode>
  )
}

function TraceRaiz({ raiz, defaultCollapsed }) {
  return (
    <TraceNode
      level={0}
      badge={TYPE_LABELS.entrada}
      title={`${raiz.codigo_lote || `Entrada #${raiz.id_entrada}`} - ${raiz.proveedor_nombre || 'Sin proveedor'}`}
      subtitle={`Recibido: ${formatDateTime(raiz.fecha_recepcion)} | Documento: ${raiz.documento_referencia || '-'} | Receptor: ${raiz.receptor_nombre || '-'} | Costo total: ${formatNumber(raiz.costo_total)}`}
      defaultCollapsed={false}
    >
      {raiz.lotes.map((lote) => (
        <TraceLote key={lote.id_lote_mp} lote={lote} defaultCollapsed={defaultCollapsed} />
      ))}

      {raiz.existencias_directas && raiz.existencias_directas.length > 0 ? (
        <div className="trace-subsection">
          <p className="trace-subsection-title">Producto ingresado directamente (sin maduracion)</p>
          {raiz.existencias_directas.map((existencia) => (
            <TraceExistenciaSummary key={existencia.id_existencia} existencia={existencia} />
          ))}
        </div>
      ) : null}

      {raiz.lotes.length === 0 && (!raiz.existencias_directas || raiz.existencias_directas.length === 0) ? (
        <p className="widget-muted trace-leaf-empty">Esta entrada aun no genero lotes ni existencias.</p>
      ) : null}
    </TraceNode>
  )
}

const addPdfSectionTitle = (doc, text, y) => {
  const pageHeight = doc.internal.pageSize.getHeight()
  let cursorY = y

  if (cursorY > pageHeight - 25) {
    doc.addPage()
    cursorY = 18
  }

  doc.setFontSize(11)
  doc.setTextColor(31, 111, 59)
  doc.text(text, 14, cursorY)
  return cursorY + 6
}

const addPdfInfoTable = (doc, y, rows) => {
  autoTable(doc, {
    startY: y,
    body: rows,
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: 1.2, textColor: [40, 40, 40] },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 45 } },
    margin: { left: 14, right: 14 },
  })
  return doc.lastAutoTable.finalY + 4
}

const addPdfTableOrEmpty = (doc, y, head, body, emptyLabel) => {
  if (body.length === 0) {
    doc.setFontSize(8.5)
    doc.setTextColor(130, 130, 130)
    doc.text(emptyLabel, 16, y)
    return y + 6
  }

  autoTable(doc, {
    startY: y,
    head: [head],
    body,
    styles: { fontSize: 8, cellPadding: 1.6 },
    headStyles: { fillColor: [31, 111, 59] },
    margin: { left: 14, right: 14 },
  })
  return doc.lastAutoTable.finalY + 6
}

const buildTraceabilityPdf = (trace) => {
  const doc = new jsPDF()
  const generatedAt = new Date().toLocaleString('es-GT')
  let y = 15

  if (trace.raiz) {
    const raiz = trace.raiz

    doc.setFontSize(15)
    doc.setTextColor(20, 20, 20)
    doc.text(`Trazabilidad - ${raiz.codigo_lote || `Entrada #${raiz.id_entrada}`}`, 14, y)
    y += 6
    doc.setFontSize(9)
    doc.setTextColor(120, 120, 120)
    doc.text(`Generado: ${generatedAt}`, 14, y)
    y += 8

    y = addPdfInfoTable(doc, y, [
      ['Proveedor', raiz.proveedor_nombre || '-'],
      ['Fecha recepcion', formatDateTime(raiz.fecha_recepcion)],
      ['Documento', raiz.documento_referencia || '-'],
      ['Receptor', raiz.receptor_nombre || '-'],
      ['Costo total', formatNumber(raiz.costo_total)],
    ])

    ;(raiz.lotes || []).forEach((lote) => {
      y = addPdfSectionTitle(doc, `Lote MP #${lote.id_lote_mp} - ${lote.producto_nombre || 'Producto sin nombre'}`, y)
      y = addPdfInfoTable(doc, y, [
        ['Peso inicial', formatNumber(lote.peso_inicial_kg, 'kg')],
        ['Unidades', lote.cantidad_unidades ?? '-'],
        ['Estado', lote.estado_registro],
      ])

      ;(lote.sublotes || []).forEach((sublote) => {
        y = addPdfSectionTitle(doc, `  Sub-lote #${sublote.id_sublote} (${sublote.codigo_sublote})`, y)
        y = addPdfInfoTable(doc, y, [
          ['Peso actual', formatNumber(sublote.peso_kg, 'kg')],
          ['Maduracion', sublote.estado_maduracion],
          ['Estado', sublote.estado_registro],
        ])

        y = addPdfTableOrEmpty(
          doc,
          y,
          ['Fecha', 'Brix', 'Peso medido', 'Temp.'],
          (sublote.controles || []).map((control) => [
            formatDateTime(control.fecha_medicion),
            formatNumber(control.grados_brix),
            formatNumber(control.peso_medido_kg, 'kg'),
            formatNumber(control.temperatura_cuarto),
          ]),
          'Sin controles de maduracion registrados.'
        )

        y = addPdfTableOrEmpty(
          doc,
          y,
          ['Caja #', 'Producto', 'Redes', 'Peso', 'Empacado', 'Por', 'Disponible', 'Vence'],
          (sublote.redes || []).map((red) => [
            `#${red.id_red}`,
            red.existencia?.producto_nombre || '-',
            red.cantidad_redes ?? '-',
            formatNumber(red.peso_kg, 'kg'),
            formatDateTime(red.fecha_empaque),
            red.usuario_nombre || '-',
            formatNumber(red.existencia?.cantidad_disponible),
            formatDate(red.existencia?.fecha_vencimiento),
          ]),
          'Sin cajas de red verde empacadas.'
        )

        ;(sublote.procesos || []).forEach((proceso) => {
          y = addPdfSectionTitle(
            doc,
            `    Proceso #${proceso.id_proceso} - ${proceso.producto_resultado_nombre || 'Producto sin definir'} (${proceso.estado_proceso})`,
            y
          )

          const infoRows = [
            ['Ingresado', formatNumber(proceso.cantidad_ingresada_kg, 'kg')],
            ['Producido', formatNumber(proceso.cantidad_producida_kg, 'kg')],
            [
              'Rendimiento',
              proceso.rendimiento_porcentaje !== null && proceso.rendimiento_porcentaje !== undefined
                ? `${formatNumber(proceso.rendimiento_porcentaje)}%`
                : '-',
            ],
          ]

          if (proceso.diferencia_kg !== null && proceso.diferencia_kg !== undefined) {
            infoRows.push([
              'Diferencia de balance',
              `${formatNumber(proceso.diferencia_kg, 'kg')}${proceso.justificacion_diferencia ? ` - ${proceso.justificacion_diferencia}` : ''}`,
            ])
          }

          y = addPdfInfoTable(doc, y, infoRows)

          y = addPdfTableOrEmpty(
            doc,
            y,
            ['Etapa', 'Entrada', 'Salida', 'Merma', 'Inicio', 'Fin'],
            (proceso.etapas || []).map((etapa) => [
              etapa.nombre_etapa,
              formatNumber(etapa.cantidad_entrada_kg, 'kg'),
              formatNumber(etapa.cantidad_salida_kg, 'kg'),
              formatNumber(etapa.merma_kg, 'kg'),
              formatDateTime(etapa.fecha_inicio),
              formatDateTime(etapa.fecha_fin),
            ]),
            'Sin etapas registradas.'
          )

          y = addPdfTableOrEmpty(
            doc,
            y,
            ['Merma', 'Cantidad', 'Fecha'],
            (proceso.mermas || []).map((merma) => [merma.nombre_merma, formatNumber(merma.cantidad_kg, 'kg'), formatDateTime(merma.fecha_registro)]),
            'Sin mermas registradas.'
          )

          y = addPdfTableOrEmpty(
            doc,
            y,
            ['Insumo', 'Cantidad', 'Fecha'],
            (proceso.insumos || []).map((insumo) => [
              insumo.producto_nombre,
              formatNumber(insumo.cantidad, insumo.unidad_medida),
              formatDateTime(insumo.fecha_registro),
            ]),
            'Sin insumos registrados.'
          )

          if (proceso.existencias && proceso.existencias.length > 0) {
            proceso.existencias.forEach((existencia) => {
              const pageHeight = doc.internal.pageSize.getHeight()
              if (y > pageHeight - 20) {
                doc.addPage()
                y = 18
              }
              doc.setFontSize(8.5)
              doc.setTextColor(60, 60, 60)
              doc.text(
                `Producto terminado: Existencia #${existencia.id_existencia} - ${existencia.producto_nombre || '-'} | Disponible: ${formatNumber(existencia.cantidad_disponible)} | Vence: ${formatDate(existencia.fecha_vencimiento)}`,
                16,
                y
              )
              y += 6
            })
          }
        })
      })
    })

    if (raiz.existencias_directas && raiz.existencias_directas.length > 0) {
      y = addPdfSectionTitle(doc, 'Producto ingresado directamente (sin maduracion)', y)
      y = addPdfTableOrEmpty(
        doc,
        y,
        ['Existencia', 'Producto', 'Disponible', 'Vence', 'Estado'],
        raiz.existencias_directas.map((existencia) => [
          `#${existencia.id_existencia}`,
          existencia.producto_nombre || '-',
          formatNumber(existencia.cantidad_disponible),
          formatDate(existencia.fecha_vencimiento),
          existencia.estado_registro,
        ]),
        ''
      )
    }

    doc.save(`trazabilidad_${raiz.codigo_lote || `entrada_${raiz.id_entrada}`}.pdf`)
    return
  }

  if (trace.existencia_huerfana) {
    const existencia = trace.existencia_huerfana

    doc.setFontSize(15)
    doc.setTextColor(20, 20, 20)
    doc.text('Trazabilidad - Existencia sin origen vinculado', 14, y)
    y += 10

    addPdfInfoTable(doc, y, [
      ['Existencia', `#${existencia.id_existencia}`],
      ['Producto', existencia.producto_nombre || '-'],
      ['Disponible', formatNumber(existencia.cantidad_disponible)],
      ['Vence', formatDate(existencia.fecha_vencimiento)],
      ['Estado', existencia.estado_registro],
    ])

    doc.save(`trazabilidad_existencia_${existencia.id_existencia}.pdf`)
  }
}

function TraceabilityModule({ token }) {
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState(null)
  const [trace, setTrace] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [collapseAll, setCollapseAll] = useState(false)
  const [treeVersion, setTreeVersion] = useState(0)

  const [showAdvanced, setShowAdvanced] = useState(false)
  const [advancedAreas, setAdvancedAreas] = useState(ALL_AREA_KEYS)
  const [advancedDesde, setAdvancedDesde] = useState('')
  const [advancedHasta, setAdvancedHasta] = useState('')
  const [advancedResults, setAdvancedResults] = useState(null)

  const handleToggleAdvancedArea = (areaKey) => {
    setAdvancedAreas((current) =>
      current.includes(areaKey) ? current.filter((key) => key !== areaKey) : [...current, areaKey]
    )
  }

  const handleAdvancedSearch = async (event) => {
    event.preventDefault()

    setErrorMessage('')
    setTrace(null)
    setSearchResults(null)
    setSearchTerm('')
    setIsLoading(true)

    try {
      const results = await searchTraceabilityByFiltersRequest(
        { areas: advancedAreas, desde: advancedDesde || null, hasta: advancedHasta || null },
        token
      )
      setAdvancedResults(results)
    } catch (error) {
      setErrorMessage(error.message || 'No se pudo completar la busqueda por filtros')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSearch = async (event) => {
    event.preventDefault()
    const term = searchTerm.trim()

    if (!term) {
      return
    }

    setErrorMessage('')
    setTrace(null)
    setSearchResults(null)
    setAdvancedResults(null)
    setIsLoading(true)

    try {
      if (TRACE_CODE_PATTERN.test(term)) {
        const result = await getTraceabilityByCodeRequest(term, token)
        setTrace(result)
        setCollapseAll(false)
        setTreeVersion((current) => current + 1)
      } else {
        const results = await searchTraceabilityRequest(term, token)
        setSearchResults(results)

        if (results.length === 1) {
          const result = await getTraceabilityByRefRequest(results[0].tipo, results[0].id, token)
          setTrace(result)
          setCollapseAll(false)
          setTreeVersion((current) => current + 1)
        }
      }
    } catch (error) {
      setErrorMessage(error.message || 'No se pudo completar la busqueda')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSelectResult = async (result) => {
    setErrorMessage('')
    setIsLoading(true)

    try {
      const traced = await getTraceabilityByRefRequest(result.tipo, result.id, token)
      setTrace(traced)
      setCollapseAll(false)
      setTreeVersion((current) => current + 1)
    } catch (error) {
      setErrorMessage(error.message || 'No se pudo obtener la trazabilidad')
    } finally {
      setIsLoading(false)
    }
  }

  const handleBackToResults = () => {
    setTrace(null)
  }

  const handleNewSearch = () => {
    setTrace(null)
    setSearchResults(null)
    setAdvancedResults(null)
    setSearchTerm('')
    setErrorMessage('')
  }

  const handleToggleCollapseAll = () => {
    setCollapseAll((current) => !current)
    setTreeVersion((current) => current + 1)
  }

  const handleExportPdf = () => {
    buildTraceabilityPdf(trace)
  }

  return (
    <section className="panel-card" aria-label="Modulo de trazabilidad">
      <div className="providers-header-row">
        <div>
          <h3>Trazabilidad</h3>
          <p>
            Rastrea el recorrido completo de un lote, sub-lote, proceso, red o producto terminado: desde la
            entrada de materia prima hasta el inventario final, o al reves.
          </p>
        </div>
      </div>

      <form className="maturation-filter-panel no-print" onSubmit={handleSearch}>
        <div className="maturation-filter-grid">
          <label className="maturation-filter-field" style={{ flex: 1 }}>
            <span className="maturation-filter-label">Buscar</span>
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Codigo de trazabilidad (ej. PLV-260825-003), numero de lote/sublote/proceso, proveedor o producto"
              className="maturation-filter-input"
            />
          </label>
          <div className="provider-form-actions">
            <button type="submit" disabled={isLoading}>
              {isLoading ? 'Buscando...' : 'Buscar'}
            </button>
          </div>
        </div>
      </form>

      <div className="trace-toolbar no-print">
        <button type="button" className="secondary-button" onClick={() => setShowAdvanced((current) => !current)}>
          {showAdvanced ? 'Ocultar busqueda avanzada' : 'Busqueda avanzada por fechas'}
        </button>
      </div>

      {showAdvanced ? (
        <form className="maturation-filter-panel no-print" onSubmit={handleAdvancedSearch}>
          <div className="maturation-filter-grid">
            <label className="maturation-filter-field">
              <span className="maturation-filter-label">Desde</span>
              <input
                type="date"
                value={advancedDesde}
                onChange={(event) => setAdvancedDesde(event.target.value)}
                className="maturation-filter-input"
              />
            </label>
            <label className="maturation-filter-field">
              <span className="maturation-filter-label">Hasta</span>
              <input
                type="date"
                value={advancedHasta}
                onChange={(event) => setAdvancedHasta(event.target.value)}
                className="maturation-filter-input"
              />
            </label>
          </div>

          <div className="trace-area-checkboxes">
            {AREA_OPTIONS.map((option) => (
              <label key={option.key} className="trace-area-checkbox">
                <input
                  type="checkbox"
                  checked={advancedAreas.includes(option.key)}
                  onChange={() => handleToggleAdvancedArea(option.key)}
                />
                {option.label}
              </label>
            ))}
          </div>

          <div className="provider-form-actions">
            <button type="submit" disabled={isLoading || advancedAreas.length === 0}>
              {isLoading ? 'Buscando...' : 'Buscar por filtros'}
            </button>
          </div>
        </form>
      ) : null}

      {errorMessage ? <p className="feedback error">{errorMessage}</p> : null}

      {advancedResults && !trace ? (
        advancedResults.length === 0 ? (
          <p className="widget-muted">Ningun registro activo coincide con esos filtros.</p>
        ) : (
          <div className="trace-results-list">
            <p className="widget-muted" style={{ margin: '0 0 8px' }}>
              {advancedResults.length} resultado(s). Los pedidos entregados son solo informativos (no tienen arbol de trazabilidad por lote).
            </p>
            {advancedResults.map((result) =>
              result.tipo === 'pedido' ? (
                <div key={`${result.tipo}-${result.id}`} className="trace-result-item trace-result-item--static">
                  <span className="trace-badge">{TYPE_LABELS[result.tipo] || result.tipo}</span>
                  <span>
                    {result.etiqueta} - {result.fecha} - {result.detalle}
                  </span>
                </div>
              ) : (
                <button
                  key={`${result.tipo}-${result.id}`}
                  type="button"
                  className="trace-result-item"
                  onClick={() => handleSelectResult(result)}
                >
                  <span className="trace-badge">{TYPE_LABELS[result.tipo] || result.tipo}</span>
                  <span>
                    {result.etiqueta} - {result.fecha}
                    {result.detalle ? ` - ${result.detalle}` : ''}
                  </span>
                </button>
              )
            )}
          </div>
        )
      ) : null}

      {searchResults && !trace ? (
        searchResults.length === 0 ? (
          <p className="widget-muted">No se encontraron resultados para esa busqueda.</p>
        ) : (
          <div className="trace-results-list">
            <p className="widget-muted" style={{ margin: '0 0 8px' }}>
              Varios resultados coinciden, selecciona uno para ver su trazabilidad completa:
            </p>
            {searchResults.map((result) => (
              <button
                key={`${result.tipo}-${result.id}`}
                type="button"
                className="trace-result-item"
                onClick={() => handleSelectResult(result)}
              >
                <span className="trace-badge">{TYPE_LABELS[result.tipo] || result.tipo}</span>
                {result.etiqueta}
              </button>
            ))}
          </div>
        )
      ) : null}

      {trace ? (
        <div className="trace-toolbar no-print">
          {(searchResults && searchResults.length > 1) || (advancedResults && advancedResults.length > 1) ? (
            <button type="button" className="secondary-button" onClick={handleBackToResults}>
              ‹ Volver a resultados
            </button>
          ) : null}
          <button type="button" className="secondary-button" onClick={handleNewSearch}>
            Nueva busqueda
          </button>
          <button type="button" className="secondary-button" onClick={handleToggleCollapseAll}>
            {collapseAll ? 'Expandir todo' : 'Colapsar todo'}
          </button>
          {trace?.raiz || trace?.existencia_huerfana ? (
            <button type="button" className="secondary-button" onClick={handleExportPdf}>
              Descargar PDF
            </button>
          ) : null}
        </div>
      ) : null}

      {trace?.raiz ? (
        <div className="trace-tree">
          <TraceSummary raiz={trace.raiz} />
          <div key={treeVersion}>
            <TraceRaiz raiz={trace.raiz} defaultCollapsed={collapseAll} />
          </div>
        </div>
      ) : null}

      {trace && !trace.raiz && trace.existencia_huerfana ? (
        <div className="trace-tree">
          <p className="widget-muted" style={{ margin: '0 0 10px' }}>
            Esta existencia no tiene un origen de entrada o produccion vinculado (registro manual o legado).
          </p>
          <TraceExistenciaSummary existencia={trace.existencia_huerfana} />
        </div>
      ) : null}
    </section>
  )
}

export default TraceabilityModule
