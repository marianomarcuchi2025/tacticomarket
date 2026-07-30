# TácticoMarket

Plataforma privada de ayuda mutua para personal de las Fuerzas Armadas argentinas y su entorno familiar: comprar/vender, ofrecer servicios, pedir ayuda con mudanzas, alquileres, movilidad compartida, y donaciones (generales o para una colecta puntual).

Reemplaza a los dos prototipos anteriores (`tacticomarket` y `base`, auditados el 27/07/2026) y a la primera fusión estática del 29/07/2026. Desde el 30/07/2026 corre sobre una base de datos real (Supabase: Postgres + Auth + Storage), no sobre mocks.

## Estructura

```
backend/
  server.js              Express: estáticos + Mercado Pago (crear preferencia, webhook) + config pública
frontend/
  index.html             Landing + donación (stats reales desde donation_totals)
  login.html             Registro / ingreso real (Supabase Auth)
  pendiente.html         Pantalla para cuentas sin verificar todavía
  publicaciones.html     Listado único con categorías (venta/servicio/mudanza/alquiler/movilidad/ayuda/otro)
  publicacion-nueva.html Crear publicación (con foto opcional, meta de colecta si es "ayuda")
  publicacion.html       Detalle: chat, cerrar trato, calificar, colaborar con una colecta
  admin.html             Aprobar cuentas pendientes, cargar puntos de encuentro seguros
  dashboard.html         Mapa (Leaflet + geolocalización), "pedir viaje" publica un aviso real de movilidad
  css/styles.css         Tema visual único (verde militar oscuro)
  js/                    supabaseClient.js, auth.js, y un archivo por página
```

## Modelo de datos (Supabase)

- **profiles**: identidad (nombre, fuerza, unidad, alias/callsign), `verified`, `rol` (member/admin), `reputation` y `trust_badge` (recalculados automáticamente tras cada calificación), `avalado_por` (aval opcional de otro miembro).
- **listings**: publicaciones por categoría, con `crowdfunding_goal`/`crowdfunding_current` para el caso "ayuda".
- **messages**: chat por publicación (polling, no websockets).
- **transactions**: registra el cierre de un trato (comprador, vendedor, monto, punto de encuentro seguro); habilita la calificación.
- **testimonials**: calificación 1-5 + comentario, solo permitida entre partes de una transacción `completed` real.
- **time_bank** / **time_bank_transfers**: banco de horas de ayuda mutua entre miembros, con validación de saldo.
- **safe_points**: puntos de encuentro seguros (comisaría, estación de servicio, etc.) para cerrar tratos.
- **donations**: registro de donaciones vía Mercado Pago; `donation_totals` es la única vista pública (agregado, sin exponer donantes).

Todas las tablas tienen RLS habilitado con políticas explícitas — ver las migraciones aplicadas al proyecto Supabase `tacticomarket` (`bvxylizvibtfzwyiywdd`).

## Verificación de identidad

Auto-declaración + aprobación manual: cualquiera se registra, pero solo puede publicar/escribir una vez que un admin lo aprueba desde `admin.html`. A propósito **no se piden ni se guardan documentos de identidad** (evita responsabilidad legal por manejar DNI/carnet militar bajo la Ley 25.326). El campo `avalado_por` permite opcionalmente registrar que otro miembro ya verificado avaló a la persona, como dato de contexto para quien aprueba.

## Setup local

```bash
npm install
cp .env.example .env
# completá MP_ACCESS_TOKEN/MP_PUBLIC_KEY y SUPABASE_URL/SUPABASE_ANON_KEY/SUPABASE_SERVICE_ROLE_KEY
npm start
```

Abrí `http://localhost:3000`. Al registrar la primera cuenta, promovela a admin manualmente:

```sql
update profiles set rol = 'admin', verified = true where id = '<tu-user-id>';
```

## Variables de entorno

Ver `.env.example`. `SUPABASE_ANON_KEY` es segura de exponer al frontend (se sirve vía `/api/public-config`, igual que `MP_PUBLIC_KEY`). `SUPABASE_SERVICE_ROLE_KEY` es secreta — bypassea RLS, solo se usa server-side para registrar donaciones y procesar el webhook de Mercado Pago.

## Pendiente / fuera de alcance a propósito

- Sin verificación por documento de identidad (decisión de producto, ver arriba).
- Sin websockets — el chat es por polling cada ~4s.
- Sin notificaciones push/email.
- Gamificación (`weekly_streak`, `user_credits`, `user_stats`, `shared_clicks`) ya está protegida con RLS pero sin UI construida todavía — quedó de un diseño anterior, no se integró en esta vuelta.
- **`safe_points` tiene 6 direcciones cargadas que no fueron ingresadas en esta sesión de trabajo y no están verificadas como reales.** Confirmalas o reemplazalas por lugares reales antes de que alguien coordine un encuentro basado en esos datos.
- Tests automatizados y CI.
- Cobro de comisión (`transactions.commission` / `admin_revenue`) preparado en el esquema pero no se cobra nada real todavía — no hay pasarela de pago para operaciones entre pares, solo para donaciones.
