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

## GitHub Pages

`base` vale `/` por defecto. Si alguna vez quieres volver a publicar en Pages:
`npm run build:pages` (compila con `base=/Carlos-Opinion/`). Aviso: en Pages no hay
`try_files`, así que los enlaces directos a `/Carlos-Opinion/anime` dan 404.
