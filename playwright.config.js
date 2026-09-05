import { defineConfig, devices } from '@playwright/test'

// Las pruebas asumen que el backend (http://localhost:3000) y el frontend
// (http://localhost:5173, "npm run dev") ya estan corriendo, y que existen las
// cuentas de prueba creadas por Backend/scripts/seed_e2e_users.js. Ver e2e/README.md.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [['html', { open: 'never' }]],
  timeout: 30_000,
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'setup', testMatch: /.*\.setup\.js/ },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
    },
  ],
})
