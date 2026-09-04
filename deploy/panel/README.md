# El panel, alojado en Pavilion

Etapa 2: el panel deja de ser `npm run panel` en el PC y pasa a estar alojado
como la web, con su subdominio y su HTTPS. Para escribir desde el móvil,
recién visto el episodio, que es de lo que iba todo esto.

## Cómo queda montado

```
   móvil / navegador
        │  https://panel.carlosin120fps.duckdns.org
        ▼
   Nginx Proxy Manager  ── Access List (usuario y contraseña)
        │  http://192.168.50.148:8099
        ▼
   carlos-opinion-panel.service        ← escribe y COMMITEA. Devuelve en <1 s.
        │  ~/carlos-opinion/panel-work
        ▼
   carlos-opinion-push.timer (2 min)   ← EMPUJA. Dispara el hook de siempre.
        │                              y después RESPALDA en GitHub (origin/main → v2)
        ▼
   ~/carlos-opinion/repo.git  ──►  post-receive  ──►  la web publicada

   ~/carlos-opinion/generar/cola/     ← el panel deja aquí un pedido de borrador
        │
   carlos-opinion-generar.path        ← lo ve y arranca…
        ▼
   carlos-opinion-generar.service     ← …panel/generar.mjs: lanza generar.py,
                                        deja el resultado en hecho/, avisa por ntfy
```

**Escribir y publicar están separados a propósito.** Empujar dispara el hook, que
compila (~60 s en un dv6), y `git receive-pack` es hijo del push. Si eso pasara
dentro de la petición HTTP, escribir dos frases costaría un minuto mirando una
ruedecita — que es justo la fricción que este proyecto existe para quitar.

Por eso la interfaz dice **«se publica en ~2 min»** y nunca da a entender que ya
está en línea.

## Instalación

Ya está hecha. Queda aquí por si hay que rehacerla.

```bash
# 1. El clon de trabajo del panel (no es el mismo que ~/carlos-opinion/build)
git clone ~/carlos-opinion/repo.git ~/carlos-opinion/panel-work
cd ~/carlos-opinion/panel-work

# Sin recolector automático: git dispara `gc --auto` por su cuenta tras un
# fetch o un commit, y `pack-objects` no tiene techo de memoria. Dentro de un
# cgroup de 96 MB eso es un OOM esperando a pasar.
git config gc.auto 0

# 2. El token, fuera del repositorio (que es público en GitHub)
printf 'CO_PANEL_TOKEN=%s\n' "$(openssl rand -hex 24)" > ~/carlos-opinion/panel.env
chmod 600 ~/carlos-opinion/panel.env

# 3. Las unidades
sudo cp deploy/panel/carlos-opinion-*.{service,timer,path} /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now carlos-opinion-panel.service
sudo systemctl enable --now carlos-opinion-push.timer
sudo systemctl enable --now carlos-opinion-generar.path

# 4. La cola de borradores (el panel escribe, generar.service lee)
mkdir -p ~/carlos-opinion/generar/{cola,enmarcha,hecho}

# 5. La copia en GitHub: una clave SOLO para este repositorio
ssh-keygen -t ed25519 -N "" -C "carlos-opinion@pavilion (deploy key, solo este repo)" \
  -f ~/.ssh/carlos-opinion-github
ssh-keyscan -t ed25519,rsa github.com >> ~/.ssh/known_hosts   # el timer no puede escribirlo (ProtectHome)
cd ~/carlos-opinion/panel-work
git remote add github git@github.com:CarlosIn120FPS/Carlos-Opinion.git
git config core.sshCommand "ssh -i ~/.ssh/carlos-opinion-github -o IdentitiesOnly=yes -o BatchMode=yes -o ConnectTimeout=15 -o StrictHostKeyChecking=yes"
cat ~/.ssh/carlos-opinion-github.pub    # esto se registra en GitHub, ver abajo
```

`panel.env` lleva además `CO_ANILIST_USUARIO` (la bandeja de pendientes) y el
escritor recibe `CO_PANEL_GENERAR=/home/carlosalexei/carlos-opinion/generar`
en su unidad: sin esa variable el panel no ofrece pedir borradores.

## El otro paso que hace Carlos: la clave en GitHub

El timer empuja lo publicado a `github/v2` con la clave de arriba. GitHub tiene
que conocerla: en el repositorio, **Settings → Deploy keys → Add deploy key**,
pega el contenido de `~/.ssh/carlos-opinion-github.pub` y marca **Allow write
access**. Es una clave de despliegue, no la de tu cuenta: solo abre este
repositorio, y si un día Pavilion se pierde se borra de ahí y ya.

Hasta que esté registrada, cada intento falla con «Permission denied
(publickey)»: el timer lo apunta en `~/carlos-opinion/.github-fallo`, avisa por
ntfy y no vuelve a intentarlo hasta pasadas 3 horas. En cuanto la registres,
el siguiente ciclo (o `sudo systemctl start carlos-opinion-push`) la usa y la
copia se pone al día sola. Comprobar: `journalctl -u carlos-opinion-push -n 20`
debe decir «GitHub: v2 al día en …».

## El paso que hace Carlos: el Proxy Host

**Nginx Proxy Manager no se toca por línea de comandos.** Vive en `~/matrix-stack`
y es el punto único de fallo del acceso a todo el homelab. Esto lo añades tú por
la interfaz, y con copia previa:

```bash
cp ~/matrix-stack/npm/data/database.sqlite ~/backups/npm-$(date +%F).sqlite
```

Luego, en NPM:

1. **Hosts → Proxy Hosts → Add Proxy Host**
   - Domain: `panel.carlosin120fps.duckdns.org`
   - Scheme `http`, Forward Hostname `192.168.50.148`, Forward Port `8099`
   - Marca *Block Common Exploits* y *Websockets Support*
2. **SSL**: certificado de Let's Encrypt (el comodín que ya usas), *Force SSL*
   y *HTTP/2*.
3. **Access List**: crea una con tu usuario y contraseña, y asígnasela.

### Cómo comprobar que la lista de acceso funciona DE VERDAD

Esto importa: **probarlo desde el sofá no demuestra nada**. Si añades una regla
por IP con «Satisfy Any», el resultado desde casa es idéntico tanto si funciona
como si está abierta de par en par.

Hay que probarlo **desde datos móviles, con el wifi apagado**:

```bash
curl -sI https://panel.carlosin120fps.duckdns.org/            # debe dar 401
curl -sI -H 'X-Forwarded-For: 192.168.50.10' \
     https://panel.carlosin120fps.duckdns.org/                # TAMBIÉN debe dar 401
```

Si el segundo no da 401, la regla por IP se puede falsificar con una cabecera:
quita «Satisfy Any» y deja sólo usuario y contraseña.

## Cuando cambia el CÓDIGO del panel

Publicar (`npm run deploy`) actualiza la web, pero **no** el panel: el escritor
es un proceso de node que ya tiene cargado `panel/servidor.mjs`, y su clon
(`panel-work`) sólo se pone al día cuando alguien lo usa. Tras un cambio en
`panel/` hay que hacer las dos cosas a mano:

```bash
ssh pavilion 'cd ~/carlos-opinion/panel-work && git fetch origin main && git rebase origin/main \
  && sudo systemctl restart carlos-opinion-panel && systemctl is-active carlos-opinion-panel'
```

`empujar.mjs` y `generar.mjs` no necesitan reinicio: son `oneshot`, cada
ejecución carga el fichero que haya en `panel-work`. Un cambio en una unidad
(`deploy/panel/*.service|timer|path`) sí: `sudo cp` a `/etc/systemd/system/`,
`daemon-reload` y `restart` de esa unidad. Y un cambio en `generador/generar.py`
se copia a mano a `~/carlos-opinion/generador/generador/` (no es un checkout).

Si se olvida, el panel sigue funcionando con el código anterior y una ruta
nueva contesta `{"error":"ruta desconocida"}` — que es justo lo que pasó la
primera vez.

## Comprobar que está vivo

```bash
systemctl status carlos-opinion-panel.service
systemctl list-timers carlos-opinion-push.timer
systemctl status carlos-opinion-generar.path       # debe estar active (waiting)
journalctl -u carlos-opinion-panel -n 40
journalctl -u carlos-opinion-push -n 40
journalctl -u carlos-opinion-generar -n 40         # lo que dijo el generador
ls ~/carlos-opinion/generar/{cola,enmarcha,hecho}  # la cola de borradores

# Cuánta RAM consume de verdad (la regla del nodo son 100 MB)
systemctl show carlos-opinion-panel -p MemoryCurrent
```

Si un despliegue se cae, llega un aviso por **ntfy** al tema `carlos-opinion`,
desde el propio hook y, si el push vino del panel, también desde `empujar.mjs`.
Hace falta porque git **ignora el código de salida de `post-receive`**: un build
roto da un push con éxito y una web sin actualizar, en silencio. Por el mismo
tema llegan «Borrador listo», «Borrador: hay que elegir» y «Borrador fallido»
del generador, y el aviso de que la copia en GitHub no se pudo hacer.

### Los avisos no llegan hasta que exista el token (el paso que hace Carlos)

Descubierto el 4-9-2026: el ntfy de casa tiene `NTFY_AUTH_DEFAULT_ACCESS=deny-all`
y **ningún usuario tiene escritura en el tema `carlos-opinion`**, así que cada
aviso respondía 403 y nunca llegó ninguno. Está expuesto en
`ntfy.carlosin120fps.duckdns.org`, o sea que abrir el tema a anónimos no es
opción: cualquiera que supiera el nombre podría mandarte notificaciones.

El patrón que ya usas para `backups` (un bot que escribe, `movil` que lee) es
el bueno. En Pavilion:

```bash
docker exec ntfy ntfy user add --role=user carlos-opinion-bot      # te pide una contraseña; da igual cuál
docker exec ntfy ntfy access carlos-opinion-bot carlos-opinion write-only
docker exec ntfy ntfy access movil carlos-opinion read-only
docker exec ntfy ntfy token add carlos-opinion-bot                 # imprime tk_...
printf 'CO_PANEL_NTFY_TOKEN=tk_...\n' >> ~/carlos-opinion/panel.env
```

Y nada más: el hook lee `panel.env`, y las unidades del timer y del generador
lo cargan con `EnvironmentFile=`. **`panel.env` tiene que seguir siendo
`CLAVE=valor` a secas, una por línea, sin espacios ni comillas raras**: el hook
lo carga con `.` bajo `set -e`, y una línea que no sea shell válido mataría el
hook antes de `fallo()` — el push diría que todo fue bien sin haber publicado.
Comprobar:

```bash
. ~/carlos-opinion/panel.env && curl -s -H "Authorization: Bearer $CO_PANEL_NTFY_TOKEN" \
  -d "prueba" http://192.168.50.148:8090/carlos-opinion     # debe devolver un JSON, no 403
```

Mientras tanto los avisos salen por el `journalctl` de cada unidad con «(ntfy
respondió 403: el aviso no ha llegado)», que es la pista si se vuelve a olvidar.

## Decisiones que parecen olvidos y no lo son

- **El servicio que empuja NO lleva `MemoryMax`.** El límite de 100 MB del nodo
  va en el escritor, que es el que está siempre en pie. Dentro del que empuja
  corre `vite build` a través del hook: encerrarlo en 96 MB lo mataría por OOM a
  mitad de despliegue.
- **Tampoco lleva `TimeoutStartSec`.** En `Type=oneshot` el defecto ya es
  infinito. Ponerle uno mataría el cgroup entero al vencer —hook, npm y el rsync
  a medias—, que es el escenario que deja la web a medio copiar.
- **El que empuja también trae las portadas** (`scripts/portadas.mjs`) antes de
  mirar si hay algo que publicar. El escritor no puede: no tiene salida a
  internet a propósito. Así una ficha publicada desde el móvil deja de apuntar
  a AniList en el siguiente ciclo, y el commit «Portadas locales: …» sale solo.
- **El timer hace el ciclo completo** (fetch, rebase, push), no sólo el push. Si
  Carlos empuja desde el PC entre medias, un push a secas saldría rechazado y el
  contador de pendientes seguiría en pie: se reintentaría cada dos minutos para
  siempre y en silencio.
- **Un timer y no un hook sobre `.git/logs/HEAD`**: ese fichero lo escriben
  también el fetch y el rebase del propio escritor, así que se autoalimentaría.
- **El generador no lo lanza el escritor**, aunque esté en la misma máquina:
  el escritor no tiene salida a internet ni memoria para ello, y un pedido son
  minutos. Deja un fichero en `generar/cola/` y una unidad `.path` arranca otro
  servicio. Y ese servicio **saca el pedido de la cola antes de tocarlo**, pase
  lo que pase: `DirectoryNotEmpty` vuelve a disparar mientras la cola no esté
  vacía, y un pedido roto que se quedara dentro sería un bucle sin fin.
- **La copia en GitHub se hace desde el timer y con `origin/main`**, nunca con
  HEAD: si el push a casa falló, HEAD lleva commits que la web no tiene. Sin
  cambios no hay red (se comparan dos referencias locales), y tras un fallo se
  esperan 3 horas para no avisar cada dos minutos.
- **El token va en `X-Panel-Token`, no en `Authorization: Bearer`.** La Access
  List usa `auth_basic`: el navegador ya tiene un `Authorization: Basic` para
  este origen y mandar un Bearer encima haría que nginx devolviera 401 sin llegar
  al panel.
- **El escritor escucha en `192.168.50.148`, nunca en `0.0.0.0`.** Es el criterio
  del nodo, y el servicio se niega a arrancar si se le pasa `0.0.0.0` o un token
  corto.

## Volver atrás

```bash
sudo systemctl disable --now carlos-opinion-panel.service carlos-opinion-push.timer \
  carlos-opinion-generar.path
```

La web pública no se entera: son servicios independientes. Y el panel local
(`npm run panel`) sigue funcionando en el PC como plan B.
