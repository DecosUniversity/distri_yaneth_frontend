import jsPDF from 'jspdf'

const padSegment = (value) => {
  if (value === null || value === undefined || value === '') {
    return '0000'
  }

  return String(value).padStart(4, '0')
}

export const buildTraceabilityCode = ({ id_proveedor, id_entrada, id_lote, id_producto }) =>
  `P${padSegment(id_proveedor)}-E${padSegment(id_entrada)}-L${padSegment(id_lote)}-PT${padSegment(id_producto)}`

export const downloadTraceabilityLabelPdf = ({ code, title, lines, fileName }) => {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [100, 60] })

  doc.setDrawColor(31, 111, 59)
  doc.setLineWidth(0.6)
  doc.rect(3, 3, 94, 54)

  doc.setFontSize(9)
  doc.setTextColor(31, 111, 59)
  doc.text(title, 50, 10, { align: 'center' })

  doc.setFontSize(15)
  doc.setTextColor(20, 20, 20)
  doc.text(code, 50, 20, { align: 'center' })

  doc.setDrawColor(200, 200, 200)
  doc.setLineWidth(0.2)
  doc.line(8, 24, 92, 24)

  doc.setFontSize(8.5)
  doc.setTextColor(50, 50, 50)

  let cursorY = 30
  lines.forEach((line) => {
    doc.text(line, 8, cursorY)
    cursorY += 5.5
  })

  doc.save(fileName)
}
