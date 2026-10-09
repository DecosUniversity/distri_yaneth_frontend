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
    // El empaque de redes se estandarizo dentro de Produccion ("+ Empacar red"); este modulo
    // solo consulta el historico de cajas registradas antes de ese cambio.
    summary: 'Historico de cajas de red empacadas antes de unificar este flujo con Produccion.',
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

// Agrupacion visual del menu lateral en modulos generales, para no mostrar 16+ items sueltos.
// Dashboard y Trazabilidad quedan fuera de cualquier grupo porque son transversales (no
// pertenecen a un solo flujo de trabajo).
export const MODULE_GROUPS = [
  {
    key: 'produccion',
    // "Proceso Productivo" y no "Produccion": el grupo contiene el modulo "Produccion" y un
    // nombre identico rompe los selectores por accesibilidad (accessible name duplicado).
    label: 'Proceso Productivo',
    moduleKeys: ['entries', 'maturation', 'production', 'greenNets'],
  },
  {
    key: 'inventarioCatalogos',
    label: 'Inventario y Catalogos',
    moduleKeys: ['products', 'inventory', 'clients', 'providers'],
  },
  {
    key: 'distribucion',
    label: 'Distribucion',
    moduleKeys: ['orders', 'routes', 'returns'],
  },
  {
    key: 'flota',
    label: 'Flota',
    moduleKeys: ['vehicles', 'vehicleServices', 'serviceTypes'],
  },
  {
    key: 'administracion',
    label: 'Administracion',
    moduleKeys: ['users'],
  },
]

const NAVIGATION_ORDER = [
  { type: 'standalone', moduleKey: 'dashboard' },
  ...MODULE_GROUPS.map((group) => ({ type: 'group', ...group })),
  { type: 'standalone', moduleKey: 'traceability' },
]

// Arma el arbol de navegacion (items sueltos + grupos) ya filtrado por lo que el rol puede ver.
// Un grupo que se quede sin ningun modulo permitido para el rol no aparece en absoluto.
export const getNavigationTree = (role) => {
  const allowedKeys = getAllowedModuleKeys(role)

  return NAVIGATION_ORDER.map((entry) => {
    if (entry.type === 'standalone') {
      if (!allowedKeys.includes(entry.moduleKey)) {
        return null
      }

      return { type: 'standalone', module: MODULE_DEFINITIONS[entry.moduleKey] }
    }

    const modules = entry.moduleKeys
      .filter((key) => allowedKeys.includes(key))
      .map((key) => MODULE_DEFINITIONS[key])
      .filter(Boolean)

    if (modules.length === 0) {
      return null
    }

    return { type: 'group', key: entry.key, label: entry.label, modules }
  }).filter(Boolean)
}
