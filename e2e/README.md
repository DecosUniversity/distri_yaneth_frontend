# Pruebas E2E (Playwright)

Requisitos antes de correrlas:

1. Backend corriendo en `http://localhost:3000` (`npm run dev` en `Backend/`, con Redis y
   MariaDB arriba).
2. Frontend corriendo en `http://localhost:5173` (`npm run dev` en `Frontend/`).
3. Cuentas de prueba creadas en la base de datos real (una sola vez, o cuando se vacie la BD):
   ```
   cd Backend
   node scripts/seed_e2e_users.js
   ```
   Crea `e2e.admin`, `e2e.produccion`, `e2e.logistica`, `e2e.piloto`, todas con password
   `E2eTest123!`. Es idempotente: si ya existen no hace nada.

## Correr las pruebas

```
npm run test:e2e          # headless, un solo navegador (chromium)
npm run test:e2e:ui       # modo interactivo (recomendado mientras se escriben pruebas)
npx playwright show-report
```

El proyecto `setup` (`auth.setup.js`) inicia sesion una vez por rol y guarda el `storageState`
en `e2e/.auth/*.json` (ignorado por git); las demas pruebas reutilizan esas sesiones en vez de
loguearse en cada test.

## Estructura

- `test-users.js` - credenciales de las 4 cuentas de prueba.
- `auth.setup.js` - login por rol, genera los `storageState`.
- `navigation.spec.js` - smoke test: para cada rol, el menu lateral muestra exactamente los
  modulos permitidos y cada uno carga sin errores de JS.
- `products.spec.js` - primer ejemplo de CRUD completo (crear / editar / eliminar), sirve como
  plantilla para agregar el resto de los modulos (clientes, proveedores, vehiculos, pedidos,
  rutas, devoluciones, produccion, etc.).

Los modulos de esta app no tienen rutas propias (es una SPA de una sola pantalla que cambia de
seccion por estado, no por URL), asi que cada prueba navega haciendo clic en el boton del menu
lateral correspondiente en vez de usar `page.goto` a una ruta especifica.
