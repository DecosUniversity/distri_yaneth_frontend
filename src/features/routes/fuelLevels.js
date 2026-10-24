// Nivel del tanque en octavos, como lo muestra el marcador de combustible del vehiculo.
export const TANK_LEVEL_OPTIONS = [
  { value: 0, label: 'Vacio' },
  { value: 1, label: '1/8' },
  { value: 2, label: '1/4' },
  { value: 3, label: '3/8' },
  { value: 4, label: '1/2' },
  { value: 5, label: '5/8' },
  { value: 6, label: '3/4' },
  { value: 7, label: '7/8' },
  { value: 8, label: 'Lleno' },
]

export const formatTankLevel = (value) => {
  if (value === null || value === undefined || value === '') {
    return '-'
  }

  return TANK_LEVEL_OPTIONS.find((option) => option.value === Number(value))?.label ?? '-'
}
