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
| Ruta del stack | `/home/jose/stacks/plans` |
| Contenedor | `plans-plans-1` (`nginx:alpine`) |
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

### Por qué el stack vive fuera de `/etc/dokploy`

`/etc/dokploy/compose/` lo gestiona Dokploy desde su UI (cada proyecto lleva
sufijo aleatorio). Este stack es manual, así que vive en `~/stacks/plans` para
que Dokploy no lo pise ni lo adopte a medias. Bonus: no hace falta `sudo`
(el user `jose` está en el grupo `docker`).

### Cloudflare

- **DNS:** `plans` → CNAME al túnel `jose-home` (proxied, nube naranja)
- **Túnel:** Public Hostname `plans.josechaparro.com` → `http://localhost:80`
- **Caché:** no hace falta ninguna regla. Todos los HTML salen con
  `Cache-Control: no-cache, must-revalidate`, que Cloudflare respeta. Los
  estáticos (`css/js/woff2/png/jpg/svg/webp`) sí van con `expires 30d`.

> El apex `josechaparro.com` tiene una Redirect Rule a `www` que corre en el
> edge **antes** del routing del túnel. Por eso esto vive en subdominio y no en
> `josechaparro.com/plans`: la ruta bajo el apex habría requerido meterle una
> excepción a esa regla.

---

## Actualizar un plan

Reemplazá el HTML y sincronizá. **No hace falta reiniciar nada**: el directorio
`html/` está montado como volumen, nginx lee del disco en cada request y el
`no-cache` evita que quede pegado en el navegador o en Cloudflare.

```bash
rsync -az --delete plans-site/ dokploy:stacks/plans/
```

Verificá:

```bash
curl -sI https://plans.josechaparro.com/plan-fuerza-jose.html | head -1
```

Solo necesitás `docker compose` si tocaste `docker-compose.yml` o `nginx.conf`:

```bash
ssh dokploy 'cd ~/stacks/plans && docker compose -p plans up -d'
```

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
   snippet anti-flash) y `<script src="./assets/theme.js"></script>` antes de
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
ssh dokploy 'docker compose -p plans ps'
ssh dokploy 'docker inspect plans-plans-1 --format "{{range \$n,\$v := .NetworkSettings.Networks}}{{\$n}}{{end}}"'

# ¿Traefik ve el router?
ssh dokploy 'docker exec dokploy-traefik wget -qO- http://127.0.0.1:8080/api/http/routers/plans@docker'

# Probar el origin salteando Cloudflare por completo
ssh dokploy 'curl -sI -H "Host: plans.josechaparro.com" http://127.0.0.1/'

# Logs de nginx
ssh dokploy 'docker compose -p plans logs -f'
```

Si el origin responde 200 pero el dominio público no, el problema está en
Cloudflare (DNS, Public Hostname del túnel, o `cloudflared` caído), no acá.
