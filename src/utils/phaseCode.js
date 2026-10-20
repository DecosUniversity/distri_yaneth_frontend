// Codigo legible por fase: PREFIJO-NNNNNN (ej. SUB-000009), derivado del ID. Es el mismo
// formato que entiende el buscador de Trazabilidad (Backend/src/workers/shared/phaseCode.js):
// si se agrega un prefijo aqui, agregarlo tambien alla.
export const PHASE_CODE_PREFIXES = {
  entrada: 'ENT',
  lote: 'LMP',
  sublote: 'SUB',
  proceso: 'PRO',
  red: 'RED',
  existencia: 'EXI',
  pedido: 'PED',
}

export const formatPhaseCode = (tipo, id) => {
  const prefix = PHASE_CODE_PREFIXES[tipo]

  if (!prefix || id === null || id === undefined || id === '') {
    return '-'
  }

  return `${prefix}-${String(id).padStart(6, '0')}`
}
