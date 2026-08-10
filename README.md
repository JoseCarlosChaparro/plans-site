# plans-site

Galería estática de planes de entrenamiento y nutrición, servida en
**https://plans.josechaparro.com**.

Cinco HTML sin build step ni dependencias de servidor. `index.html` carga GSAP
desde CDN; el resto es autocontenido.

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

1. Copiá el HTML del plan a `html/`.
2. Agregá una `<a class="card">` dentro de `<div class="grid" id="grid">` en
   `index.html`, siguiendo el patrón:

```html
<a class="card" href="./mi-plan-nuevo.html" data-tags="activo entrenamiento" data-accent="#c6f24e">
  <div class="card-accent" style="background:linear-gradient(90deg,#c6f24e,transparent)"></div>
  <div class="status live"><span class="sd"></span> En curso</div>
  <div class="card-top">
    <span class="cat" style="background:rgba(198,242,78,.12);color:#c6f24e">Fuerza</span>
  </div>
  <div class="card-body">
    <h3>Título del plan</h3>
    <p>Descripción corta, una o dos frases.</p>
    <div class="card-foot">
      <div class="meta"><span><b>8</b> semanas</span><span><b>10 ago</b> → 4 oct</span></div>
      <div class="go" style="color:#c6f24e">Abrir →</div>
    </div>
  </div>
</a>
```

### `data-tags` — controla los filtros

Lista separada por espacios. Los botones de arriba filtran por estos valores:

| Filtro | Tag |
|---|---|
| Todo | *(no lleva tag, matchea siempre)* |
| Activo ahora | `activo` |
| Entrenamiento | `entrenamiento` |
| Nutrición | `nutricion` |
| Programado | `futuro` |

Combinalos: un plan de fuerza en curso lleva `data-tags="activo entrenamiento"`.
Un tag que no esté en la tabla simplemente no será alcanzable por ningún botón
(si querés uno nuevo, agregá también su `<button class="f" data-filter="...">`).

### `data-accent` — controla el color

Un hex. Ojo: **hay que repetirlo a mano en tres lugares más** dentro de la card,
porque el CSS usa estilos inline y no lee el atributo:

- `.card-accent` → `linear-gradient(90deg,TU_HEX,transparent)`
- `.cat` → `background:rgba(R,G,B,.12); color:TU_HEX`
- `.go` → `color:TU_HEX`

Acentos en uso: `#c6f24e` (lima, fuerza) · `#ff7a45` (naranja, nutrición) ·
`#5cc8ff` (celeste, movilidad) · `#a78bfa` (violeta, futuro).

### `.status` — el badge de estado

`<div class="status live">` para planes en curso. Sacá la clase `live` (o
cambiá el texto) para los que todavía no arrancaron.

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
