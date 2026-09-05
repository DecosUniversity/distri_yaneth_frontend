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
  production: {
    key: 'production',
    label: 'Produccion',
    summary: 'Procesos de produccion, mermas, insumos y rendimiento.',
  },
  greenNets: {
    key: 'greenNets',
    label: 'Redes',
    summary: 'Empaque de sub-lotes verdes como producto terminado en red.',
  },
  orders: {
    key: 'orders',
    label: 'Pedidos',
    summary: 'Lista de despacho por cliente, sin facturacion.',
  },
  routes: {
    key: 'routes',
    label: 'Entregas',
    summary: 'Manifiestos de entrega, asignacion de vehiculo y piloto, salida y cierre.',
  },
  returns: {
    key: 'returns',
    label: 'Devoluciones',
    summary: 'Recepcion fisica de devoluciones y resolucion (reingreso o perdida).',
  },
  traceability: {
    key: 'traceability',
    label: 'Trazabilidad',
    summary: 'Rastreo completo de un lote, sublote, proceso o producto, de inicio a fin.',
  },
}

const DEFAULT_ROLE = 'Piloto'

export const ROLE_MODULE_PERMISSIONS = {
  Administrador: ['dashboard', 'users', 'products', 'inventory', 'entries', 'clients', 'providers', 'vehicles', 'vehicleServices', 'serviceTypes', 'maturation', 'production', 'greenNets', 'orders', 'routes', 'returns', 'traceability'],
  Produccion: ['dashboard', 'products', 'inventory', 'entries', 'maturation', 'production', 'greenNets', 'returns', 'traceability'],
  Logistica: ['dashboard', 'entries', 'clients', 'providers', 'inventory', 'vehicles', 'vehicleServices', 'serviceTypes', 'maturation', 'greenNets', 'orders', 'routes', 'returns', 'traceability'],
  Piloto: ['dashboard', 'routes', 'returns'],
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
