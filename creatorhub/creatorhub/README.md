# CreatorHub

Sube un video una vez y publícalo en **YouTube Shorts, TikTok e Instagram Reels** desde un solo lugar.
Todo se conecta con las API oficiales mediante OAuth: la app nunca pide tus contraseñas y nunca marca algo como publicado si la plataforma no lo confirmó.

## Qué incluye

- Panel, nueva publicación (arrastrar y soltar, vista previa, ajustes por plataforma), calendario, historial, biblioteca y cuentas conectadas.
- Modo oscuro por defecto (con interruptor claro/oscuro) y diseño adaptable a computadora, tablet y teléfono.
- Registro/inicio de sesión (contraseñas con bcrypt, sesión en cookie firmada).
- Base de datos PostgreSQL con Prisma.
- Un **worker** que publica en la hora programada, con reintentos y estados reales.
- Tokens de las redes cifrados (AES-256-GCM) en la base de datos.
- Exportación manual (descarga + texto listo) cuando una plataforma no permite publicar por API.

## Requisitos

- Node.js 20 o superior
- Docker Desktop (para PostgreSQL), o un PostgreSQL propio

## Puesta en marcha

```bash
npm install
cp .env.example .env          # en Windows: copy .env.example .env
```

Abre `.env` y rellena `AUTH_SECRET` y `ENCRYPTION_KEY`. Genera cada uno con:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Luego:

```bash
docker compose up -d          # inicia PostgreSQL
npm run db:push               # crea las tablas
npm run dev:all               # inicia la web (http://localhost:3000) y el worker
```

Entra a http://localhost:3000, crea tu cuenta y, cuando termines, pon `ALLOW_REGISTRATION="false"` en `.env` para cerrar el registro.

> El worker (`npm run worker`) es el que realmente publica. Si está apagado, las publicaciones quedan en "Pendiente" o "Programado" hasta que lo enciendas.

## Conectar las redes (hazlo de a una)

En cada plataforma crea una app de desarrollador y registra esta URL de redirección (cambia el dominio por tu `APP_URL`):

| Plataforma | URL de redirección | Variables del `.env` |
|---|---|---|
| YouTube | `APP_URL/api/connect/youtube/callback` | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |
| TikTok | `APP_URL/api/connect/tiktok/callback` | `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET` |
| Instagram | `APP_URL/api/connect/instagram/callback` | `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET` |

- **YouTube**: Google Cloud Console → habilita *YouTube Data API v3* → credenciales OAuth tipo "Aplicación web". Mientras tu proyecto no esté verificado por Google, los videos subidos pueden quedar privados.
- **TikTok**: developers.tiktok.com → producto *Content Posting API* con los permisos `user.info.basic`, `video.publish` y `video.upload`. Sin la auditoría de TikTok solo puedes usar "Enviar a borradores" o publicar en privado.
- **Instagram**: developers.facebook.com → *Instagram API con inicio de sesión de Instagram* (permisos `instagram_business_basic` e `instagram_business_content_publish`). Requiere cuenta profesional.

**TikTok e Instagram necesitan una URL pública HTTPS.** Para probar en tu computadora usa un túnel (Cloudflare Tunnel o ngrok), pon esa dirección en `APP_URL`, reinicia, y **abre la app desde esa dirección** al conectar las cuentas (si no, la cookie de sesión no llega al regreso de OAuth). Instagram además descarga el video desde esa URL mediante un enlace temporal firmado.

Las reglas y requisitos de las plataformas cambian: revisa su documentación oficial al configurar cada una.

## Cómo funcionan las publicaciones

1. Al publicar se crea un registro por plataforma (`PostTarget`) en estado *Pendiente* o *Programado*.
2. El worker toma los vencidos de forma atómica (`FOR UPDATE SKIP LOCKED`), sube el video y consulta a la plataforma hasta confirmar el resultado.
3. Errores temporales (red antes de enviar, límites, 5xx) se reintentan hasta 3 veces con espera creciente.
4. Si la conexión se corta *durante* la subida, NO se reintenta solo (podría duplicar el video): queda en *Error* y tú decides con **Reintentar** tras revisar la plataforma.
5. Si el worker se detiene a mitad de una publicación, pasados 15 minutos queda en *Error* por la misma razón.

## Estructura

```
prisma/schema.prisma        modelo de datos
worker/index.ts             proceso que publica y reintenta
src/lib/platforms/          un adaptador por red (youtube, tiktok, instagram)
src/lib/publisher.ts        orquesta renovar token → publicar → guardar estado
src/lib/storage.ts          archivos (disco local; reemplazable por S3/MinIO)
src/app/(app)/              pantallas: panel, nueva, calendario, historial, biblioteca, cuentas
src/app/api/                subida, medios, publicaciones, OAuth, autenticación
```

## Límites actuales

- Los videos se guardan en disco (`STORAGE_DIR`). Para S3/MinIO hay que reescribir las 4 funciones de `src/lib/storage.ts`.
- Los límites por plataforma de `src/lib/platforms/meta.ts` (duración, caracteres) son de referencia; ajústalos si cambian.
- Esta primera versión no incluye pruebas automáticas.
