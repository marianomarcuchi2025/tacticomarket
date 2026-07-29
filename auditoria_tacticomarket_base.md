# Auditoría de repositorios `tacticomarket` y `base` + plan de fusión

Fecha del análisis: 27/07/2026
Repos analizados: `marianomarcuchi2025/tacticomarket` y `marianomarcuchi2025/base` (clonados y leídos directamente; metadata verificada vía API de GitHub)

---

## 0. Alerta de seguridad (léela antes que el resto)

**El repo `tacticomarket` es público y tiene una credencial de Mercado Pago hardcodeada en el código, tanto en el backend como en el frontend.**

En `index.js` (backend):
```js
const MP_ACCESS_TOKEN = "APP_USR-46eb8024-b517-4584-9c38-31e2ea0a6d11";
```

En `index.html` (frontend, visible con "ver código fuente" por cualquier visitante):
```js
const MP_PUBLIC_KEY = "APP_USR-46eb8024-b517-4584-9c38-31e2ea0a6d11";
```

**Es el mismo valor en los dos lados.** En Mercado Pago, el *Access Token* (secreto, solo backend) y la *Public Key* (segura de exponer en frontend) son credenciales distintas — nunca deberían coincidir. No puedo confirmar desde el código si el valor real es el access token o la public key (ambos usan el prefijo `APP_USR-` en producción), pero hay dos escenarios y los dos son malos:

- Si es el **access token real**: está expuesto en el HTML público de la página, o sea cualquier visitante puede leerlo e invocar la API de Mercado Pago en tu nombre (crear preferencias, y según el scope del token, potencialmente más).
- Si es la **public key duplicada por error** en la variable de backend: el endpoint `/create-preference` probablemente nunca funcionó como backend válido.

**Esto ya está en un repo público desde mayo de 2026, con varios commits de historial (`server.js`, `index.js`).** Independientemente de qué fusión decidas hacer, mi recomendación es:

1. Entrá a tu cuenta de Mercado Pago y **regenerá/revocá esa credencial ahora**, aunque el proyecto esté inactivo.
2. Nunca vuelvas a poner una credencial de pago en un archivo commiteado. Usá variables de entorno (`.env`, no trackeado) tanto en local como en el hosting (Vercel/Render/Netlify tienen "Environment Variables" en el panel).
3. Solo la *Public Key* va en el frontend. El *Access Token* nunca sale del backend.

No tengo forma de verificar si esa credencial ya fue usada de forma indebida por terceros — no es algo que pueda auditar desde el código. Es una hipótesis de riesgo basada en que el repo es público, no un hecho confirmado.

---

## 1. Qué es cada repo en realidad (no lo que el nombre sugiere)

Ambos son prototipos de un (1) solo día de trabajo, sin actividad después:

| | `base` | `tacticomarket` |
|---|---|---|
| Creado / último push | 06/05/2026 → 07/05/2026 (1 día) | 13/05/2026 → 14/05/2026 (1 día) |
| Descripción en GitHub | "Red privada entre personal militar" | (sin descripción) |
| Deploy declarado | `base-two-green.vercel.app` | `tacticomarket.vercel.app` (pero el HTML apunta a Netlify y el backend a Render — ver punto 4) |
| Stack | HTML/CSS/JS estático, sin backend, sin `package.json` | HTML estático + backend Node/Express mínimo |
| Tamaño | 60 KB, 8 archivos | 251 KB, 3 archivos |
| Tests / CI / README / licencia | Ninguno | Ninguno |

**Contenido real de `base`:** son en realidad dos prototipos distintos mezclados en el mismo repo, que no se comunican entre sí:
- `index.html` + `dashboard.html` + `app.js`: se llaman a sí mismos **"Militar Ride PRO"**, cargan el SDK completo de Firebase (Auth + Firestore + Analytics) pero **no lo usan para nada real** — el botón "Ingresar" no llama a ninguna función de Firebase. `dashboard.html` sí tiene algo funcional: un mapa con Leaflet + OpenStreetMap (gratis, sin API key) que geolocaliza al usuario.
- `login.html` + `mercado.html` + `movilidad.html` + `js/auth.js`: se llaman **"BASE"**, no usan Firebase para nada, el "login" es una función `login()` que guarda `{nombre, fuerza}` en `localStorage` sin ninguna validación real (cualquiera puede escribir cualquier nombre/fuerza; no es autenticación, es solo un formulario que setea una variable local). `mercado.html` y `movilidad.html` son pantallas de demo con datos hardcodeados ("Notebook Dell — Córdoba", "Suboficial EA ⭐ 4.8") y botones que solo hacen `alert('Chat en demo')`.

Es decir: **`base` tiene dos identidades de producto sin resolver** (Militar Ride PRO vs. BASE) y ningún login real, ninguna base de datos conectada, ningún dato persistente más allá de un objeto en `localStorage`.

**Contenido real de `tacticomarket`:** no es un marketplace. Es exclusivamente una landing page de **donaciones vía Mercado Pago** ("TÁCTICO MARKET — Donación voluntaria") con un backend Express de 70 líneas que crea una "preference" de pago. No hay ningún catálogo, listado, ni funcionalidad de compra/venta pese al nombre.

**Conclusión honesta:** ambos repos parecen ser iteraciones/pivots del mismo concepto — una red/mercado privado para personal militar argentino (marketplace de artículos + viajes compartidos + comunidad) — abandonadas cada una a las pocas horas de empezar. No hay solapamiento de código reutilizable directo entre ambos (distintos stacks, distintas convenciones), pero sí hay solapamiento de **idea de producto**. Esto es una inferencia mía a partir de las fechas, el dominio temático y los nombres — no está documentado en ningún README, así que te lo marco como hipótesis, no como hecho confirmado. Si el objetivo real de cada repo era otro, decime y ajusto el plan.

---

## 2. Auditoría técnica — hallazgos

### Seguridad
- **Crítico:** credencial de Mercado Pago hardcodeada y duplicada frontend/backend (ver sección 0).
- **Medio:** config de Firebase expuesta en `base/app.js`. Esto en sí *no* es necesariamente un problema — las claves de Firebase client-side están diseñadas para ser públicas — pero solo es seguro si las **Firestore/Auth Security Rules** del proyecto `uber-militar` están bien configuradas. No pude verificar esas reglas desde el repo (viven en la consola de Firebase, no en el código). Si nunca las configuraste, cualquiera podría leer/escribir la base de datos.
- **Medio:** "login" de `base` no autentica nada — es trivial de falsificar. Si en algún momento pensás usar ese flujo para dar acceso a un grupo cerrado ("red privada entre personal militar"), hoy no hay ninguna barrera real.
- **Bajo:** no hay `.gitignore` en ninguno de los dos repos, lo que facilita que en el futuro se vuelvan a commitear `.env` o `node_modules` por accidente.

### Consistencia / deploy
- `tacticomarket` referencia **tres** hostings distintos en el mismo proyecto: el HTML apunta a `tacticomarket.netlify.app` (back_urls de retorno) y a `tacticmarket-backend.onrender.com` (API), mientras que GitHub declara como homepage `tacticomarket.vercel.app`. No es posible saber, sin acceso a esas cuentas, cuál (si alguno) está realmente vivo hoy. Recomiendo verificarlo antes de asumir que algo de esto sigue funcionando.
- Nombre del proyecto en `package.json` (`tacticmarket-api`, sin "o") vs. nombre del repo (`tacticomarket`, con "o") — inconsistencia menor pero típica de proyectos que no pasaron por una fase de revisión.

### Calidad / mantenibilidad
- Sin tests, sin CI, sin linter, sin README, sin licencia en ninguno de los dos repos.
- Historial de commits mayormente `"Update index.html"` repetidos — sugiere edición directa (probablemente desde el editor web de GitHub o un asistente) sin mensajes descriptivos ni ramas. No es grave para un prototipo de un día, pero no es una base sobre la que hacer merges de git tradicionales con confianza.
- `base` no tiene `package.json`: no es un proyecto Node gestionado, es HTML estático servido tal cual. Fusionarlo con `tacticomarket` (que sí es un proyecto Node con Express) requiere decidir una sola estructura, no puede ser un simple copy-paste de carpetas.

---

## 3. Qué es rescatable de cada uno

**De `tacticomarket`:**
- La landing de donación (diseño oscuro, verde militar, UI de montos rápidos) está más pulida visualmente que cualquier pantalla de `base`.
- El patrón backend (Express + `/create-preference` + `/health`) es un punto de partida válido para pagos, una vez corregido el manejo de credenciales.

**De `base`:**
- El mapa con Leaflet + OpenStreetMap (`dashboard.html`) es la única funcionalidad "real" (no simulada) de los dos repos — vale la pena conservarla como base del módulo de movilidad.
- La estructura de pantallas (`mercado.html`, `movilidad.html`, `dashboard.html`) da una idea clara de la información arquitectónica que el producto necesita, aunque el contenido sea todo mock.
- La paleta "verde militar" (`#4B5320`) en `css/styles.css` es consistente con la identidad visual que después aparece en `tacticomarket`.

---

## 4. Referencias externas (repos parecidos, para sacar patrones)

Busqué proyectos open source comparables en tres frentes — marketplace/clasificados, carpooling, e integración de Mercado Pago — priorizando los que sean activos y, cuando existió la opción, argentinos:

- **[`STS-Rosario/carpoolear`](https://github.com/STS-Rosario/carpoolear)** y **[`carpoolear_backend`](https://github.com/STS-Rosario/carpoolear_backend)** — app de auto-compartido **argentina**, open source, activa (último commit el 26-27/07/2026, esta semana). Es la referencia más cercana al módulo "movilidad" de `base`. El backend muestra exactamente la estructura que a tu proyecto le falta: `.env.example` (credenciales de ejemplo, nunca reales), `.gitignore`, `README.md`, `LICENSE`, carpeta `tests/`, `Dockerfile` + `docker-compose.yml`, y `.github/` (CI). Vale la pena mirar cómo modelan usuarios, viajes y reputación (rating de conductor, similar a lo que ya insinuás con "⭐ 4.8" en tu mock).
- **[`openclassify/openclassify`](https://github.com/openclassify/openclassify)** y **[`mindstellar/Osclass`](https://github.com/mindstellar/Osclass)** — plataformas de clasificados open source (Laravel/PHP). Útiles como referencia de modelo de datos para el módulo "mercado" (categorías, ubicación, estado del aviso, sistema de contacto/mensajería en vez de un botón que solo hace `alert()`).
- **[`sharetribe/sharetribe`](https://github.com/sharetribe/sharetribe)** — marketplace P2P open source más completo (aunque ya no mantenido activamente); útil para ver cómo separan listados, transacciones y usuarios como entidades independientes.

Patrón común a los tres, y que hoy falta por completo en tus dos repos: **variables de entorno para credenciales, README con instrucciones de setup, y separación clara entre código de demo/mock y código de producción.**

No encontré ningún proyecto open source enfocado específicamente en "comunidad privada para personal militar" — es un nicho angosto, así que las referencias son genéricas (marketplace + carpooling) más que un caso 1 a 1.

---

## 5. Plan de fusión propuesto

Antes de tocar código, esto es una decisión de producto que solo vos podés tomar: **¿cuál es el producto final?** Con la evidencia que tengo, veo dos caminos razonables, y el plan de fusión cambia según cuál elijas:

- **(A) Un marketplace + comunidad militar** con movilidad y compra/venta como módulos, y donaciones como forma de sostener el proyecto (combina todo). Nombre lógico: `tacticomarket` como repo único, con "base"/red militar como el core de usuarios/auth.
- **(B) Solo la landing de donación** (lo único que hoy genera valor real e inmediato), dejando `base` archivado como referencia de diseño para retomar más adelante.

Asumiendo que el objetivo es (A) — que es lo que el pedido "hacer solo 1" sugiere — el plan sería:

1. **Antes que nada:** revocar/regenerar la credencial de Mercado Pago (sección 0). Esto es independiente de la fusión y no debería esperar.
2. **Crear un repo nuevo** (o vaciar `tacticomarket` y usarlo como destino) con estructura Node estándar: `/frontend` (o Next.js/Vite si vas a crecer la UI) y `/backend` (Express, igual que ya tenés), separados desde el día uno.
3. **Mover la landing de donación** de `tacticomarket` tal cual, corrigiendo las credenciales a variables de entorno (`process.env.MP_ACCESS_TOKEN` en backend; la public key real, distinta del access token, en frontend vía variable de build).
4. **Portar el módulo de mapa** de `base/dashboard.html` (Leaflet + geolocalización) como el punto de partida real del módulo de movilidad — es lo único no simulado que tenés.
5. **Decidir un solo sistema de autenticación.** Hoy tenés dos falsos en paralelo (Firebase sin usar + localStorage sin validar). Sugerencia: si vas a validar identidad militar/fuerza, un login real (Firebase Auth, que ya está en el proyecto, o algo más simple con backend propio) es no negociable — el `localStorage` actual no sirve ni para un MVP cerrado.
6. **Rehacer `mercado.html` y `movilidad.html`** como componentes conectados a datos reales (aunque sea una base de datos mínima), no hardcodeados, usando como referencia el modelo de datos de `carpoolear`/`openclassify` mencionado arriba.
7. **Agregar lo básico que falta en los dos repos originales:** `.gitignore`, `.env.example`, `README.md` con instrucciones de setup, y si es posible algún test mínimo.
8. **Archivar los dos repos viejos** (GitHub tiene un flag "Archive" que los deja de solo lectura) en vez de borrarlos, para no perder el historial, y dejar en el `README` del repo nuevo una nota de que reemplaza a ambos.

Este plan es una propuesta de arquitectura basada en lo que vi en el código, no una implementación — decime si querés que avance con la fusión real (puedo generar el andamiaje del repo nuevo, migrar los archivos y dejar los `.env.example`), y si el rumbo de producto es (A), (B) u otro que tengas en mente que yo no esté viendo.

---

## 6. Resumen de lo que es hecho vs. hipótesis en este informe

- **Hecho verificado directamente en el código/API de GitHub:** contenido de archivos, historial de commits, visibilidad pública de ambos repos, fechas de creación/push, credencial duplicada frontend/backend.
- **Hipótesis mía, no confirmada:** que ambos repos son iteraciones del mismo concepto de producto; que la credencial expuesta es realmente el access token (vs. una public key mal nombrada); el estado actual (activo/caído) de los tres hostings mencionados; el propósito original detrás de cada repo. Te marco esto explícitamente porque no tengo forma de verificarlo sin más contexto tuyo o acceso a esas cuentas externas.
