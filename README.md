# TácticoMarket

Plataforma privada para personal militar argentino: mercado de artículos, viajes compartidos (movilidad) y donaciones voluntarias para sostener el proyecto.

Este repo reemplaza a los dos prototipos anteriores (`tacticomarket` y `base`), auditados el 27/07/2026 y fusionados en código el 29/07/2026. Ver `auditoria_tacticomarket_base.md` para el detalle completo de la auditoría que originó esta fusión.

## ⚠️ Antes de usar esto en producción

1. **Rotá la credencial de Mercado Pago vieja.** El `index.js` original tenía un access token hardcodeado y público (`APP_USR-46eb8024-...`). Ese valor quedó expuesto en el historial de git de un repo público — hay que regenerarlo en el panel de Mercado Pago sin importar qué hagas con el código.
2. **El login es una demo, no autenticación real.** `login.html` guarda `{nombre, fuerza}` en `localStorage` sin validar nada — cualquiera puede escribir cualquier dato. Antes de manejar información real de personas hace falta un login real (ej. Firebase Auth) validado del lado del servidor.
3. **Mercado y movilidad son mocks.** Los listados de `mercado.html` y `movilidad.html` son datos fijos en el HTML, y los botones de "Contactar" solo muestran un `alert()`. Falta un backend real de listados + mensajería.

## Estructura

```
backend/
  server.js         Express: sirve el frontend + API de donaciones (Mercado Pago)
frontend/
  index.html         Landing + donación
  login.html         Acceso (demo)
  dashboard.html      Mapa (Leaflet + geolocalización) + pedir viaje
  mercado.html        Listado de artículos (demo)
  movilidad.html       Listado de viajes compartidos (demo)
  css/styles.css       Tema visual único (verde militar oscuro) para todas las páginas
  js/                  auth.js (login/logout demo), donate.js, dashboard.js
```

## Setup local

```bash
npm install
cp .env.example .env
# completá MP_ACCESS_TOKEN y MP_PUBLIC_KEY reales (o de test) en .env
npm start
```

Abrí `http://localhost:3000`.

## Variables de entorno

Ver `.env.example`. Ninguna credencial va hardcodeada en el código — el `MP_ACCESS_TOKEN` vive solo en el backend/hosting, y el `MP_PUBLIC_KEY` se sirve al frontend vía `GET /api/public-config` (es seguro de exponer, a diferencia del access token).

## Qué cambió respecto a los repos originales

- Credenciales movidas a variables de entorno (antes hardcodeadas y duplicadas frontend/backend).
- Un solo tema visual (antes `base` tenía un tema claro y `tacticomarket` uno oscuro, sin relación entre sí).
- `dashboard.html` llamaba a `crearViaje()` y `logout()` sin que existieran en ningún lado — estaba roto. Ahora están implementadas (como demo).
- Se sacó el SDK de Firebase que estaba cargado en `base` pero nunca usado (dead code).
- `mercado.html`, `movilidad.html` y `dashboard.html` ahora exigen login (antes `dashboard.html` no lo pedía, inconsistente con las otras dos).
- Backend reorganizado bajo `/api/*`, con validación de monto y CORS configurable por variable de entorno.

## Pendiente (no incluido en esta fusión)

- Autenticación real.
- Backend de listados de mercado (hoy hardcodeados en el HTML).
- Backend de matching de viajes / mensajería entre usuarios.
- Tests y CI.
- Decidir licencia (hoy no tiene ninguna — por defecto significa todos los derechos reservados).
