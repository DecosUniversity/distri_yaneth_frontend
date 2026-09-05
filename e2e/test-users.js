// Credenciales de las cuentas de prueba E2E. Deben existir en la base de datos real
// (correr una vez: node scripts/seed_e2e_users.js dentro de Backend).
export const E2E_PASSWORD = 'E2eTest123!'

export const E2E_USERS = {
  Administrador: { username: 'e2e.admin', password: E2E_PASSWORD },
  Produccion: { username: 'e2e.produccion', password: E2E_PASSWORD },
  Logistica: { username: 'e2e.logistica', password: E2E_PASSWORD },
  Piloto: { username: 'e2e.piloto', password: E2E_PASSWORD },
}

export const authFile = (role) => `e2e/.auth/${role}.json`
