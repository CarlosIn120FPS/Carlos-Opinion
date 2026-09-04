# Despliegue — Pavilion

## Cómo se publica

```
git push casa main
   ↓
Pavilion recibe el código, compila y publica.   (~1 min)
```

Eso es todo. **GitHub no interviene en ningún momento**: allí solo se guarda copia
por si un día hay que recuperar el código desde fuera.

```
tu PC ──push──> Pavilion (repo.git) ──hook──> npm ci + build ──> site/ ──> nginx
                                                                            ↓
                                                          Nginx Proxy Manager
                                                                            ↓
                                          https://opinion.carlosin120fps.duckdns.org

tu PC ──push──> GitHub   (solo copia de seguridad, fuera del camino)
```

---

## Los dos remotos

```bash
git push casa main      # publica la web
git push github main    # guarda copia de seguridad
```

Si clonas el proyecto en otro sitio, configúralos así:

```bash
git remote add casa   pavilion:carlos-opinion/repo.git
git remote add github https://github.com/CarlosIn120FPS/Carlos-Opinion.git
```

(`pavilion` es el alias de `~/.ssh/config` que apunta a `192.168.50.148`.)

---

## Qué hay montado en Pavilion

| Qué | Dónde |
|---|---|
| Repositorio de despliegue | `~/carlos-opinion/repo.git` (bare) |
| Hook que compila y publica | `~/carlos-opinion/repo.git/hooks/post-receive` |
| Carpeta donde compila | `~/carlos-opinion/build/` |
| Lo que sirve nginx | `~/carlos-opinion/site/` |
| Stack | `~/carlos-opinion/docker-compose.yml` |
| Config de nginx | `~/carlos-opinion/nginx.conf` |

El contenedor corre en `read_only`, con `no-new-privileges`, `mem_limit 64m`
(consume ~2 MB en reposo) y publicado **solo** en `192.168.50.148:8098`, nunca en
`0.0.0.0`. `~/matrix-stack` no se toca nunca.

`node_modules` se conserva entre despliegues y solo se reinstala si cambió
`package-lock.json` — en un dv6, `npm ci` cada vez serían minutos de más por nada.

---

## Lo que falta: el Proxy Host en NPM

En la interfaz de Nginx Proxy Manager → **Hosts → Proxy Hosts → Add Proxy Host**:

**Pestaña Details**

| Campo | Valor |
|---|---|
| Domain Names | `opinion.carlosin120fps.duckdns.org` |
| Scheme | `http` |
| Forward Hostname / IP | `192.168.50.148` |
| Forward Port | `8098` |
| Cache Assets | **desactivado** (el nginx de detrás ya manda las cabeceras correctas; si NPM cachea encima, seguirás viendo el `index.html` viejo) |
| Block Common Exploits | activado |
| Websockets Support | no hace falta |
| Access List | ninguna — es una web pública |

**Pestaña SSL**

| Campo | Valor |
|---|---|
| SSL Certificate | *Request a new SSL Certificate* |
| Force SSL | activado |
| HTTP/2 Support | activado |

> DuckDNS resuelve cualquier subdominio del dominio al mismo IP, así que
> `opinion.carlosin120fps.duckdns.org` ya apunta a casa sin configurar nada más —
> igual que `home.` y `jellyfin.`.

---

## Actualizar contenido

### Añadir un anime, manga o novela

Editas `public/data/anime.json`, y:

```bash
git push casa main      # publicado en ~1 min
git push github main    # y guardada la copia
```

### El atajo: editar directamente en el servidor

```bash
ssh pavilion
nano ~/carlos-opinion/site/data/anime.json
```

Recargas y ya está: sin compilar, sin desplegar. nginx sirve esos JSON sin caché
justamente para esto.

> ⚠️ **El siguiente `git push casa` se lo lleva por delante.** Este atajo es para
> una corrección rápida; replícala luego en `public/data/` del repo.

---

## Guardas de seguridad

El hook **se niega a publicar** y deja la versión anterior en su sitio si:

- `npm ci` o `npm run build` fallan,
- el build no generó `index.html`,
- falta cualquiera de los tres `data/*.json`,
- alguno de esos JSON no es JSON válido (`jq -e`).

Usa `rsync --delay-updates`, que mueve todos los ficheros a su sitio al final,
para que nadie pille la web a medio actualizar.

Y cuando se niega, **avisa por ntfy** (tema `carlos-opinion`, con el motivo):
git ignora el código de salida del hook, así que desde el timer del panel nadie
vería el fallo. El hook admite `CO_BASE` y `CO_REPO` en el entorno para poder
probarlo en un sandbox sin tocar el despliegue real.

---

## Operación

```bash
# ver la web sin pasar por el dominio
curl -I http://192.168.50.148:8098/anime

# estado del contenedor
docker ps --filter name=carlos-opinion
docker logs --tail 50 carlos-opinion

# reiniciar el servidor web (no afecta al contenido)
cd ~/carlos-opinion && docker compose restart

# volver a publicar sin cambiar nada (fuerza el hook)
git commit --allow-empty -m "redesplegar" && git push casa main
```

> Antes aquí ponía `git push casa main --force-with-lease`. Se cambió a propósito:
> reescribir `main` en el bare **borra sin vuelta atrás**, porque un repositorio
> bare no lleva reflog. Mientras el único cliente era este PC daba igual; en cuanto
> haya un segundo escritor (el panel privado), un force borraría lo que se escribió
> desde el móvil. Un commit vacío dispara el hook igual y no reescribe nada.

---

## Si algo falla

| Síntoma | Causa |
|---|---|
| `git push casa` falla o no compila | El error sale en la propia salida del push. Prueba `npm run build` en tu PC para verlo con detalle |
| La raíz carga pero `/anime` da **404** | El contenedor no está usando `nginx.conf` (comprueba el montaje en el compose) |
| Página en blanco y 404 de `.js`/`.css` | `base` mal en `vite.config.js`. Para servir en la raíz de un subdominio debe ser `/` |
| "No se pudieron cargar los datos de esta sección" | Un `data/*.json` inválido. El hook lo rechaza, así que esto solo pasa si lo editaste a mano en el servidor |
| El contenedor sale `unhealthy` pero la web va | El healthcheck debe apuntar a `127.0.0.1`, no a `localhost` (dentro del contenedor `localhost` resuelve también a `::1` y nginx solo escucha IPv4) |
| NPM da 502 | El contenedor está caído, o el Proxy Host apunta a un puerto que no es 8098 |

---

## Las páginas por ficha (Open Graph)

`npm run build` es `vite build` **y después** `scripts/og.mjs`, que deja en
`dist/` una copia de `index.html` por sección (`anime.html`) y por ficha
(`anime/2.html`) con sus etiquetas Open Graph: título, descripción, portada y
URL absolutas. Así WhatsApp, Telegram o Discord, que no ejecutan JavaScript,
enseñan la ficha al compartir un enlace. Para el navegador es la misma app.

Para que nginx las sirva, `nginx.conf` lleva `try_files $uri $uri.html $uri/
/index.html`. **Ese fichero se copia a mano a Pavilion** (`~/carlos-opinion/nginx.conf`)
y se reinicia el contenedor: el hook sólo publica `dist/`. Si tras un cambio en
`nginx.conf` compartir un enlace sigue enseñando el título genérico, es eso.

El dominio absoluto sale de `CO_SITE_URL` o, por defecto, de
`https://opinion.carlosin120fps.duckdns.org`.

El mismo script deja en la raíz `sitemap.xml` (portada, secciones y fichas),
`feed.xml` (RSS 2.0, una entrada por ficha con la opinión publicada) y
`robots.txt` con la ruta del sitemap. La fecha de una ficha es la última de su
diario; sin diario va sin fecha, no se inventa. `index.html` enlaza el feed con
`rel="alternate"`.

## El panel

Vive aparte: `deploy/panel/README.md`. Lo que más se olvida: **un cambio en
`panel/` no llega al panel con `npm run deploy`**; hay que hacer rebase en
`panel-work` y reiniciar el escritor. Está escrito allí con el comando exacto.

## Pavilion arranca con el kernel 6.12.96 a propósito

El 3 de septiembre de 2026 Pavilion se actualizó al kernel 6.12.105 y su
adaptador de red USB (ASIX AX88179B, colgado de una controladora USB3 Renesas
sin firmware) dejó de recibir tramas de más de ~1500 bytes con la MTU a 9000.
Síntoma: cualquier subida grande por cable (`git push casa`, `scp`) se cortaba
con «Connection reset by peer», mientras que la web, el panel y los comandos
cortos iban bien. Strix, con el mismo adaptador y kernel pero controladora
Intel, no lo sufre.

Decisión de Carlos: arrancar siempre en 6.12.96. `GRUB_DEFAULT` apunta a esa
entrada por id (copia del original en `/etc/default/grub.bak-20260903`) y
`linux-image-amd64` y `linux-headers-amd64` están retenidos con `apt-mark hold`:
todo lo demás se sigue actualizando. Antes de probar un kernel nuevo:

```bash
ping -f -l 2000 192.168.50.148        # desde Windows; si no responde, ese kernel tampoco vale
```

Parche de emergencia si reaparece: `sudo ip link set enx9c69d37d15ce mtu 1500`
(no persiste; el perfil de NetworkManager sigue a 9000). Y ojo: OpenSSH 10
penaliza por IP las conexiones que mueren, así que tras varios cortes seguidos
sshd rechaza todo lo que venga del PC durante unos minutos. Se entra por Strix
(`ssh -J strix pavilion`) o por la WiFi de Pavilion (192.168.50.28).

## GitHub Pages

`base` vale `/` por defecto. Si alguna vez quieres volver a publicar en Pages:
`npm run build:pages` (compila con `base=/Carlos-Opinion/` y genera las páginas
por ficha con esa base). Pages sirve `anime/2.html` para `/anime/2`, así que
los enlaces directos a una ficha funcionan; `/Carlos-Opinion/anime` a secas se
sirve desde `anime.html`.
