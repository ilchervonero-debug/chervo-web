# Vercel & Deploy Setup

## chervo-web → ilchervo.com
- Repo: https://github.com/ilchervonero-debug/chervo-web
- Vercel project: `chervo-web`
- Dominio: `www.ilchervo.com` (Production), `ilchervo.com` → 308 redirect
- Build command: `node generate.js` → genera `index.html` desde Notion
- Output dir: `.`
- Deploy: push a `master` → auto-deploy

## CMS (Notion)
- **Servicios** DB: Nombre, Descripcion, Orden → 12 servicios cargados
- **Clientes** DB: Nombre, Rol → 5 clientes cargados
- **Aplicaciones** DB: Nombre, Descripcion, URL, Icono, Orden, Activo
  - iLDraw cargado → https://www.ilchervo.com/apps/ildraw/
- **Configuracion** DB: Clave/Valor → whatsapp, email, hero_palabras_rotativas

## Portal de clientes
- `/clientes/` → login con Supabase Auth
- `/clientes/portal.html` → muestra carpeta Drive si tiene `drive_url`
- Supabase: `https://mvuyntiuiwjjjjsshzcb.supabase.co`
- Trigger SQL activo: crea fila en `public.clients` al registrarse

## Pendiente
- CDN cache `www.ilchervo.com` mostrando versión vieja (vercel.json con no-cache agregado, debería resolverse en próximo redeploy)
- Edge Function para auto-crear carpeta Google Drive al registrar cliente (incompleto)

## Inmobiliaria (próxima sesión)
- Proyecto: djcu-app (pendiente conectar repo Git)
- Tarea: conectar Notion a Google Drive para fotos de propiedades
