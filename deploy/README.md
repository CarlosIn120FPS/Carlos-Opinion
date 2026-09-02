# Despliegue — Pavilion + Nginx Proxy Manager

## Cómo funciona

GitHub Actions **no puede llegar a Pavilion**: es una IP de LAN (`192.168.50.148`) y
exponer SSH a la WAN va contra las reglas del homelab. Así que el despliegue va al
revés de lo habitual — **Pavilion viene a buscar el build**:

```
push a main
   ↓
GitHub Actions: npm ci → lint → build → comprueba los JSON
   ↓
publica dist/ en la rama `deploy` (force-push, historia nueva cada vez)
   ↓
Pavilion, cada 5 min: carlos-opinion-update.timer
   ↓
git fetch → ¿SHA distinto? → valida → rsync a ~/carlos-opinion/site/
   ↓
contenedor nginx (192.168.50.148:8098)
   ↓
Nginx Proxy Manager → https://opinion.carlosin120fps.duckdns.org
```

**Cero puertos abiertos hacia dentro. Cero credenciales en el servidor** (el
repositorio es público, el clon es anónimo). En Actions tampoco hay que configurar
ningún secreto: el `GITHUB_TOKEN` para empujar la rama `deploy` lo pone GitHub solo.

Coste: hasta 5 minutos de retraso entre el push y verlo publicado.

---

## Estado: ya instalado en Pavilion

| Qué | Dónde |
|---|---|
| Stack | `~/carlos-opinion/docker-compose.yml` |
| Config de nginx | `~/carlos-opinion/nginx.conf` |
| Contenido servido | `~/carlos-opinion/site/` |
| Clon de la rama `deploy` | `~/carlos-opinion/repo/` (lo crea el timer) |
| Actualizador | `/usr/local/bin/carlos-opinion-update.sh` |
| Unidades systemd | `/etc/systemd/system/carlos-opinion-update.{service,timer}` |

El contenedor corre en modo `read_only`, con `no-new-privileges`, `mem_limit 64m`
(consume ~8 MB) y publicado **solo** en `192.168.50.148:8098`, nunca en `0.0.0.0`.

`~/matrix-stack` no se ha tocado en ningún momento.

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
| Cache Assets | **desactivado** (el propio nginx ya manda las cabeceras correctas) |
| Block Common Exploits | activado |
| Websockets Support | no hace falta (la web no usa websockets) |
| Access List | ninguna — es una web pública |

**Pestaña SSL**

| Campo | Valor |
|---|---|
| SSL Certificate | *Request a new SSL Certificate* |
| Force SSL | activado |
| HTTP/2 Support | activado |
| HSTS | opcional |
| Email / Acepto los términos | los tuyos |

> DuckDNS resuelve cualquier subdominio del dominio al mismo IP, así que
> `opinion.carlosin120fps.duckdns.org` ya apunta a casa sin configurar nada más —
> igual que `home.` y `jellyfin.`.

---

## Operación

```bash
# forzar una comprobación ahora mismo, sin esperar los 5 minutos
sudo systemctl start carlos-opinion-update.service

# ver qué hizo el último despliegue
journalctl -u carlos-opinion-update.service -n 30 --no-pager

# ¿cuándo toca la próxima?
systemctl list-timers carlos-opinion-update.timer

# estado del contenedor
docker ps --filter name=carlos-opinion
docker logs --tail 50 carlos-opinion
```

### Avisos por ntfy (opcional)

El script no notifica nada por defecto porque ntfy pide autenticación. Para
activarlo, crea `/etc/carlos-opinion.env`:

```bash
NTFY_URL=http://192.168.50.148:8090/TU_TOPIC
NTFY_TOKEN=tu_token   # si tu ntfy lo exige
```

Sin ese fichero, un fallo sigue siendo visible en `systemctl --failed` y en el
journal.

---

## Actualizar contenido

### Lo normal: por el repositorio

Editas `public/data/anime.json`, commit, push. En menos de 5 minutos está en
producción y el repositorio queda al día.

### El atajo: editar en el servidor

```bash
ssh pavilion
nano ~/carlos-opinion/site/data/anime.json
```

Recargas y ya está: sin compilar, sin desplegar. nginx sirve esos JSON sin caché
justamente para esto.

> ⚠️ **El siguiente despliegue se lo lleva por delante.** El actualizador usa
> `rsync --delete` contra la rama `deploy`, y el repositorio manda. Este atajo es
> para una corrección rápida; replícala en `public/data/` del repo.
>
> Como consecuencia, `~/carlos-opinion/site/` **no necesita backup**: es
> reconstruible desde GitHub. Lo que no es reconstruible es una edición hecha solo
> aquí.

---

## Guardas de seguridad

El actualizador **se niega a desplegar** y deja el build anterior en su sitio si:

- falta `index.html` o está vacío,
- falta cualquiera de los tres `data/*.json`,
- alguno de esos JSON no es JSON válido (`jq -e`).

Además usa `rsync --delay-updates`, que mueve todos los ficheros a su sitio al
final, para que nadie pille la web a medio actualizar.

Probado en Pavilion antes de activarlo: primer despliegue, despliegue sin cambios,
despliegue con cambios, build con JSON inválido y build sin `index.html`. En los dos
últimos casos se rechazó y el sitio conservó el build bueno.

---

## Si algo falla

| Síntoma | Causa |
|---|---|
| La raíz carga pero `/anime` da **404** | El contenedor no está usando `nginx.conf` (comprueba el montaje en el compose) |
| Página en blanco y 404 de `.js`/`.css` | `base` mal. Para servir en la raíz de un subdominio debe ser `/` (es el valor por defecto) |
| "No se pudieron cargar los datos de esta sección" | `site/data/*.json` ausente o inválido. Mira el journal del actualizador |
| El push no llega a producción | ¿Falló Actions? ¿Existe la rama `deploy`? `systemctl status carlos-opinion-update.service` |
| El contenedor sale `unhealthy` pero la web va | El healthcheck debe apuntar a `127.0.0.1`, no a `localhost` (dentro del contenedor `localhost` resuelve también a `::1` y nginx solo escucha IPv4) |
| NPM da 502 | El contenedor está caído, o el Proxy Host apunta a un puerto que no es 8098 |

---

## GitHub Pages

`base` vale `/` por defecto (servidor propio). Si alguna vez quieres volver a
publicar en Pages: `npm run build:pages` (compila con `base=/Carlos-Opinion/`).
Aviso: en Pages no hay `try_files`, así que los enlaces directos a
`/Carlos-Opinion/anime` dan 404; solo funciona entrar por la raíz.
