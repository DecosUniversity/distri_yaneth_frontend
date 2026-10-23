# Frontend — Sistema Integral de Producción y Distribución (Distribuidora Yaneth)

Cliente web en React 19 + Vite 8 (React Router, Recharts, jsPDF, ExcelJS, SweetAlert2).
Consume la API del [backend](https://github.com/DecosUniversity/distri_yaneth_backend); la
instalación completa está en el Manual Técnico del backend (`docs/A_Manual_Tecnico/`).

## Requisitos

- Node.js 22 LTS (mínimo 20.19; Vite 8 no funciona con Node 18).
- El backend corriendo (por defecto en `http://localhost:3000`).

## Desarrollo local

```bash
npm install
cp .env.example .env.local    # VITE_API_URL=http://localhost:3000
npm run dev                   # http://localhost:5173
```

Vite escucha en todas las interfaces: para probar desde un teléfono de la misma red use
`http://<IP-del-equipo>:5173` y ponga `VITE_API_URL=http://<IP-del-equipo>:3000`.

### Scripts

- `npm run dev`: servidor de desarrollo.
- `npm run build`: compila a `dist/`.
- `npm run preview`: sirve `dist/` localmente.
- `npm run lint`: ESLint.
- `npm run test:e2e`: pruebas Playwright (ver [e2e/README.md](e2e/README.md)).

## Producción

El frontend se compila a archivos estáticos que entrega **Nginx** en el servidor de aplicación;
Nginx reenvía `/api` a la API del mismo servidor. `VITE_API_URL` es el dominio del sistema (sin
`/api` y sin puerto) y se incrusta al compilar: si cambia, hay que recompilar.

```bash
cd /opt/yaneth-sistema/Frontend
echo "VITE_API_URL=https://<dominio-del-sistema>" > .env.production
npm ci
npm run build
sudo mkdir -p /var/www/yaneth && sudo cp -r dist/* /var/www/yaneth/
```

Notas:

- No copie `.env.local` al servidor: tiene prioridad sobre `.env.production`.
- Si `VITE_API_URL` queda vacía, el cliente usa `http://localhost:3000`.
- La app usa rutas del navegador (`BrowserRouter`): Nginx debe tener
  `try_files $uri $uri/ /index.html;` en `location /`, o recargar una pantalla interna da 404.
