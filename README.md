# plans-site

Galería estática de planes de entrenamiento y nutrición, servida en
**https://plans.josechaparro.com**.

Cinco HTML sin build step ni dependencias de servidor. La única carga externa
es la fuente Inter desde Google Fonts; todo lo demás es local.

---

## Infraestructura

| Pieza | Valor real |
|---|---|
| Servidor | `dokploy` → `192.168.3.143` (Ubuntu 26.04), user `jose` |
| Gestión | Dokploy, servicio tipo Compose, desde este repo (`main`) |
| Ruta del stack | `/etc/dokploy/compose/plans-spa-xmu5sd/code` |
| Contenedor | `plans-spa-xmu5sd-plans-1` (imagen propia sobre `nginx:alpine`) |
| Red Docker | `dokploy-network` (overlay swarm, `attachable=true`) |
| Reverse proxy | `dokploy-traefik` (`traefik:v3.6.7`) |
| Entrypoint | `web` (:80) |
| certresolver | **ninguno** — ver abajo |
| Entrada pública | Cloudflare Tunnel `jose-home` (`cloudflared` en el mismo host) |

### Por qué no hay TLS en Traefik

El host no tiene port-forward: la única entrada desde internet es el túnel de
Cloudflare. El challenge HTTP-01 de Let's Encrypt necesita el puerto 80
alcanzable públicamente, así que **nunca puede completarse** — de hecho el
`acme.json` del servidor está en 0 bytes desde que se instaló Dokploy.

Por eso el router usa `entrypoints=web` sin `tls.certresolver`. **Cloudflare
termina el TLS en el edge** y el túnel habla HTTP plano contra Traefik. Es el
mismo patrón que ya usaba `vault.josechaparro.com`.

Si algún día el server queda expuesto directo a internet, ahí sí conviene
volver a `websecure` + `letsencrypt`.

### Cloudflare

- **DNS:** `plans` → CNAME al túnel `jose-home` (proxied, nube naranja)
- **Túnel:** Public Hostname `plans.josechaparro.com` → `http://localhost:80`
- **Caché:** no hace falta ninguna regla. Todos los HTML salen con
  `Cache-Control: no-cache, must-revalidate`, que Cloudflare respeta. Los
  estáticos (`css/js/woff2/png/jpg/svg/webp`) van con `max-age=30d, immutable`
  y se versionan por query (`?v=N`).

> El apex `josechaparro.com` tiene una Redirect Rule a `www` que corre en el
> edge **antes** del routing del túnel. Por eso esto vive en subdominio y no en
> `josechaparro.com/plans`: la ruta bajo el apex habría requerido meterle una
> excepción a esa regla.

---

## Actualizar un plan

Reemplazá el HTML, commiteá y pusheá. Dokploy reconstruye la imagen y recrea el
contenedor.

```bash
git add html/plan-fuerza-jose.html
git commit -m "docs(fuerza): actualizar semana 3"
git push
```

Si tenés el webhook configurado, el deploy arranca solo. Si no, dale **Redeploy**
en la UI de Dokploy.

Verificá:

```bash
curl -sI https://plans.josechaparro.com/plan-fuerza-jose.html | head -1
```

Los HTML salen con `no-cache`, así que el cambio se ve al instante sin purgar
Cloudflare. Los estáticos (`assets/*`) van con `max-age=30d, immutable`, así que
**si tocás `theme.css` o `theme.js` hay que subir el `?v=N`** en las cinco páginas
— si no, los visitantes con caché siguen con la versión vieja hasta 30 días.

### Por qué la imagen se construye y no se montan volúmenes

Dokploy **borra y re-clona** su directorio `code/` en cada deploy, así que
`code/html` estrena inode. Un contenedor ya corriendo mantiene el bind mount
apuntando al directorio viejo, que ya no existe: sirve una raíz vacía y nginx
responde `403 directory index is forbidden`. Y `docker compose up -d` no lo
recrea, porque el compose no cambió.

Copiar los archivos dentro de la imagen (`Dockerfile`) evita todo eso: cada
deploy construye una imagen nueva, y eso fuerza un contenedor nuevo.

Diagnóstico rápido si vuelve a aparecer un 403:

```bash
ssh dokploy 'stat -c "disco=%i" /etc/dokploy/compose/<servicio>/code/html'
ssh dokploy 'docker exec <contenedor> stat -c "cont=%i" /usr/share/nginx/html'
```

Si los inodes no coinciden, es esto. Se arregla recreando el contenedor.

## Añadir un plan nuevo a la galería

Hay **un solo lugar** que editar. El array `PLANS` en `html/assets/theme.js`
alimenta a la vez las cards de la galería y el nav del header, así que un plan
se declara una vez y aparece en los dos.

1. Copiá el HTML del plan a `html/`.
2. Agregá una entrada al final de `PLANS`:

```js
{
  file: 'mi-plan-nuevo.html',
  nav: 'Yoga',                    // texto corto para el nav del header
  title: 'Título del plan',
  category: 'Yoga',               // chip de arriba a la izquierda en la card
  accent: 'strength',             // ver tabla de acentos
  tags: ['activo', 'entrenamiento'],
  active: true,                   // true → badge "En curso"; false → "Programado"
  summary: 'Descripción corta, una o dos frases.',
  meta: [
    { value: '8',      label: 'semanas' },
    { value: '10 ago', label: '→ 4 oct' }
  ]
}
```

3. Al HTML nuevo pegale la cabecera compartida (fuente Inter, `theme.css`, el
   snippet anti-flash) y `<script src="./assets/theme.js?v=N"></script>` antes de
   `</body>`. Copiá esas líneas de cualquier plan existente.

### `tags` — controla los filtros

Los botones de la galería filtran por estos valores:

| Filtro | Tag |
|---|---|
| Todo | *(matchea siempre)* |
| Activo ahora | `activo` |
| Entrenamiento | `entrenamiento` |
| Nutrición | `nutricion` |
| Programado | `futuro` |

Un tag fuera de esta tabla no será alcanzable por ningún botón. Si querés uno
nuevo, agregá también su `<button class="f" data-filter="...">` en `index.html`.

### `accent` — controla el color

Un nombre, no un hex. Cada uno mapea a un token que ya trae variante clara y
oscura, así que no hay que tocar colores a mano:

| `accent` | Token | Claro | Oscuro |
|---|---|---|---|
| `strength` | `--a-strength` | `#2563eb` | `#60a5fa` |
| `nutrition` | `--a-nutrition` | `#0d9488` | `#2dd4bf` |
| `mobility` | `--a-mobility` | `#0891b2` | `#22d3ee` |
| `running` | `--a-running` | `#7c3aed` | `#a78bfa` |

Si necesitás uno nuevo, declaralo en `assets/theme.css` (en `:root` **y** en
`.dark`) y sumalo al mapa `ACCENT_VAR` de `index.html`.

---

## Diseño

El sitio replica el lenguaje visual de
[josechaparro.com](https://www.josechaparro.com): tipografía **Inter**,
`primary #2563eb` → `secondary #7c3aed` en gradiente 135°, rampa de grises de
Tailwind y dark mode por clase en `<html>`.

- **`assets/theme.css`** — tokens, header, footer, botones y utilidades
  compartidas. Única fuente de verdad de la paleta.
- **`assets/theme.js`** — catálogo de planes, header, toggle de tema, barra de
  progreso de lectura y scroll reveals.

Cada plan conserva su layout propio (tablas, checklists, timelines) pero mapea
sus tokens viejos a los del theme, así que hereda claro/oscuro sin reescribir
sus reglas una por una.

> **Ojo con los nombres de tokens.** Un plan que redefina en su `:root` un
> nombre que ya existe en `theme.css` (`--bg`, `--surface`, `--border`,
> `--text`, `--muted`) le gana al bloque `.dark` — misma especificidad, y el
> `<style>` de la página va después del stylesheet. Eso congela la página en
> una sola paleta. Mapeá solo los tokens propios de la página.

El tema elegido se guarda en `localStorage` bajo `plans-theme`; si no hay nada
guardado se respeta `prefers-color-scheme`. Un snippet inline en el `<head>` de
cada página aplica la clase antes del primer paint para que el modo oscuro no
parpadee en blanco.

---

## Troubleshooting

```bash
# ¿El contenedor está arriba y en la red correcta?
ssh dokploy 'docker ps --filter name=plans-spa'
ssh dokploy 'docker inspect plans-spa-xmu5sd-plans-1 --format "{{range \$n,\$v := .NetworkSettings.Networks}}{{\$n}}{{end}}"'

# ¿Traefik ve el router?
ssh dokploy 'docker exec dokploy-traefik wget -qO- http://127.0.0.1:8080/api/http/routers/plans@docker'

# Probar el origin salteando Cloudflare por completo
ssh dokploy 'curl -sI -H "Host: plans.josechaparro.com" http://127.0.0.1/'

# Logs de nginx
ssh dokploy 'docker logs -f plans-spa-xmu5sd-plans-1'
```

Si el origin responde 200 pero el dominio público no, el problema está en
Cloudflare (DNS, Public Hostname del túnel, o `cloudflared` caído), no acá.
