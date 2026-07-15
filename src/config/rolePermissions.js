export const MODULE_DEFINITIONS = {
  dashboard: {
    key: 'dashboard',
    label: 'Dashboard',
    summary: 'Resumen general del sistema.',
  },
  products: {
    key: 'products',
    label: 'Productos',
    summary: 'Gestion completa del modulo de productos.',
  },
  inventory: {
    key: 'inventory',
    label: 'Inventario',
    summary: 'Control de stock, vencimientos y niveles criticos.',
  },
  entries: {
    key: 'entries',
    label: 'Entradas',
    summary: 'Registro de entradas de mercancia por proveedor.',
  },
  users: {
    key: 'users',
    label: 'Usuarios',
    summary: 'Administracion de usuarios y credenciales.',
  },
  clients: {
    key: 'clients',
    label: 'Clientes',
    summary: 'Gestion completa del modulo de clientes.',
  },
  providers: {
    key: 'providers',
    label: 'Proveedores',
    summary: 'Gestion completa del modulo de proveedores.',
  },
  vehicles: {
    key: 'vehicles',
    label: 'Vehiculos',
    summary: 'Gestion de flotilla y estado operativo de vehiculos.',
  },
  vehicleServices: {
    key: 'vehicleServices',
    label: 'Servicios Vehiculo',
    summary: 'Control de mantenimientos, costos y proximo kilometraje.',
  },
  serviceTypes: {
    key: 'serviceTypes',
    label: 'Tipos Servicio',
    summary: 'Catalogo base para mantenimiento de vehiculos.',
  },
  maturation: {
    key: 'maturation',
    label: 'Maduracion MP',
    summary: 'Control de maduracion para lotes de materia prima.',
  },
}

const DEFAULT_ROLE = 'Piloto'

export const ROLE_MODULE_PERMISSIONS = {
  Administrador: ['dashboard', 'users', 'products', 'inventory', 'entries', 'clients', 'providers', 'vehicles', 'vehicleServices', 'serviceTypes', 'maturation'],
  Produccion: ['dashboard', 'products', 'inventory', 'maturation'],
  Logistica: ['dashboard', 'entries', 'clients', 'providers', 'inventory', 'vehicles', 'vehicleServices', 'serviceTypes', 'maturation'],
  Piloto: ['dashboard'],
}

export const getAllowedModuleKeys = (role) => {
  const roleKey = role || DEFAULT_ROLE
  return ROLE_MODULE_PERMISSIONS[roleKey] || ROLE_MODULE_PERMISSIONS[DEFAULT_ROLE]
}

export const getAllowedModules = (role) => {
  return getAllowedModuleKeys(role)
    .map((key) => MODULE_DEFINITIONS[key])
    .filter(Boolean)
}

export const canAccessModule = (role, moduleKey) => {
  return getAllowedModuleKeys(role).includes(moduleKey)
}
