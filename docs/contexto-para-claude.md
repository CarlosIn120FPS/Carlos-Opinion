# Contexto completo del proyecto, y qué darle a Claude en un proyecto nuevo

> Para arrancar una sesión nueva con todo el contexto, como ya tienes con el
> homelab. La primera parte es el mapa del proyecto; la segunda, lo que tienes
> que adjuntar o dar tú, porque no está en el repositorio ni Claude puede
> conseguirlo solo.

## 1. Qué es

**Carlos' Opinion**: la web donde Carlos comparte su opinión sobre los animes,
mangas y novelas ligeras que ve o lee. Lo que la hace valer son sus opiniones y
su diario episodio a episodio; todo lo demás (títulos, géneros, sinopsis,
portadas, episodios) es dato objetivo que puede venir de una máquina.

- Web pública: https://opinion.carlosin120fps.duckdns.org (estática, React +
  Vite + Tailwind + Framer Motion; el contenido son JSON cargados en tiempo de
  ejecución).
- Panel privado: https://panel.carlosin120fps.duckdns.org (Node sin
  dependencias, alojado en Pavilion, detrás de la Access List de NPM). Desde el
  móvil, recién visto el episodio.
- Generador de borradores: Python estándar, en Pavilion, con AniList,
  animethemes.moe y Ollama (en Strix). Importador de Whakoom en el PC.

## 2. Principios que no cambian

1. **La voz es suya.** La IA no escribe opiniones, notas, ni diario. Nunca.
2. **Tres modales con identidad propia**: cristal, viñeta, libro. El rediseño
   cambia lo que muestran, no su carácter.
3. **Estática y en casa.** Sin backend sirviendo la web; GitHub es copia de
   seguridad, nunca parte del camino.
4. **Enlaces explícitos**, nunca adivinados por título.
5. **Nada inventado en `public/data/`.** Los tests usan fichas sintéticas.
6. **Lo que se dice hecho, está hecho y visto**: tests que cazan el fallo
   reintroducido, capturas reales para lo visual, despliegue verificado.

## 3. Cómo está montado

```
PC (Windows) ──git push casa──► Pavilion: repo.git ──hook──► build ──► nginx :8098 ──► NPM (HTTPS)
     │                                   ▲                                    │
     │  git push github main:v2          │ timer cada 2 min (empujar.mjs)     │
     ▼                                   │  · trae portadas externas          ▼
   GitHub (copia)              panel-work ◄─ escritor del panel :8099 ◄── panel.carlosin120fps
                                              (commitea, no empuja)
Pavilion: generador/ (Python) ──► rama `borradores` ◄── el panel los publica
Strix: Ollama (qwen3.5) para traducir sinopsis y proponer descripciones
```

- **Datos**: `public/data/anime.json`, `manga.json`, `lightnovels.json`. Esquema
  en `docs/esquema-ficha.md`; orden de claves en `panel/lib/secciones.mjs`.
- **Registro de secciones**: `src/data/contentTypes.js` (slug, textos, modal) y
  `src/data/niveles.js` (`ESQUEMA`: niveles del diario, hermanas, banderas).
  Añadir una sección es una entrada en cada uno.
- **Panel**: núcleo puro y probado (`panel/lib/*.mjs`: aplicar, promover,
  hermanas, clonar, revisar, portadas, pendientes), servidor
  (`panel/servidor.mjs`), interfaz (`panel/web/`). Comparte módulos con la web
  bajo `/m/`. Dos modos: local (PC) y servidor (Pavilion).
- **Despliegue**: `deploy/post-receive` (build, guardas, rsync, `.deploy-ok`),
  `deploy/update` (nadie reescribe `main`), `scripts/deploy.mjs` (verifica).
  `deploy/panel/*.service|timer` son las unidades del panel.
- **Open Graph**: `scripts/og.mjs` escribe un HTML por ficha tras el build;
  nginx los sirve con `try_files $uri $uri.html`.
- **Tests**: `npm test` = 9 suites de Node más `test_whakoom.py`; 783
  comprobaciones. Sin frameworks: scripts que montan los componentes de verdad
  (esbuild + `renderToStaticMarkup`) y la interfaz del panel sobre un DOM mínimo.

## 4. Operación: lo que se olvida

| Situación | Qué hacer |
|---|---|
| Publicar la web | `node scripts/deploy.mjs` y `git push github main:v2` |
| Cambio en `panel/` | rebase en `~/carlos-opinion/panel-work` + `sudo systemctl restart carlos-opinion-panel` |
| Cambio en `deploy/nginx.conf` | `scp` a `~/carlos-opinion/nginx.conf` + `docker restart carlos-opinion` |
| Cambio en `generador/generar.py` | `cp ~/carlos-opinion/build/generador/generar.py ~/carlos-opinion/generador/generador/` (no es un checkout) |
| Portadas nuevas | solas, en el siguiente ciclo del timer; o `npm run portadas` en el PC |
| Ver un cambio de diseño | `node scripts/captura.mjs out.png http://localhost:4173/anime 390 844 dark` con `vite preview` |
| Pavilion no acepta subidas grandes | `deploy/README.md`, sección del kernel: arranca en 6.12.96 a propósito |
| sshd rechaza todo desde el PC | penalizaciones de OpenSSH 10; entra por `ssh -J strix pavilion` o por 192.168.50.28 |

## 5. Decisiones tomadas y por qué

Están en `docs/estado-v2.md` (contra el plan) y en `docs/registro-2026-09-03.md`
(por orden, con commits). Las que más condicionan lo que venga:

- Crunchyroll **no** es fuente (sus condiciones lo prohíben); el buzón es
  AniList, sincronizado desde Jellyfin con el plugin Ani-Sync.
- Whakoom **no** tiene API y raspar está prohibido; la fuente es su exportación
  xlsx, procesada en el PC.
- TMDB nunca se usó; Ollama traduce y AniList da el alcance de la franquicia.
- Las portadas apaisadas se quedan en cascada (opción B), no en rejilla uniforme.
- `title` es el de AniList (para emparejar); `spanishTitle` es el de la edición.
- `hasAnime/hasManga/hasLightNovel` sólo cuentan relaciones que son la misma
  historia, no spin-offs.

## 6. Qué darle a Claude en un proyecto nuevo (esto lo pones tú)

Lo que el repositorio ya trae y Claude leerá solo: `CLAUDE.md` en la raíz, y
desde ahí este documento y el resto de `docs/`. Lo que **no** está en el
repositorio y tienes que aportar o habilitar tú:

1. **El documento de contexto del homelab** que ya tienes: nodos (Pavilion,
   Strix), red (192.168.50.x, la regla de nunca abrir en 0.0.0.0, el límite de
   100 MB por servicio), NPM y su Access List, ntfy, dónde vive cada servicio.
   Este proyecto depende de él y no lo describe entero.
2. **Acceso ssh** a `pavilion` y `strix` desde el PC donde corra Claude (los
   alias de `~/.ssh/config`, la clave ed25519). Sin eso no puede desplegar ni
   verificar nada. Y `sudo -n` para `systemctl`, `ip` y `ethtool` en Pavilion.
3. **Los dos remotos de git** ya configurados: `casa` (Pavilion) y `github`.
4. **Chrome instalado** en el PC (para `scripts/captura.mjs`); la extensión de
   Claude en Chrome es opcional, hoy no hizo falta.
5. **Python 3** en el PC (para el importador y sus tests) y **Node 22+**.
6. **La exportación de Whakoom** (`generador/coleccion/whakoom.xlsx`), cuando se
   vaya a trabajar con la colección. No está en git a propósito.
7. **Dónde están los secretos, sin pegarlos**: `~/carlos-opinion/panel.env` en
   Pavilion (token del panel, usuario de AniList), `~/carlos-opinion/generador/.env`
   (Ollama). Claude sólo necesita saber que existen y dónde.
8. **Tu cuenta de AniList** (`CarlosIn120FPS`) y que Jellyfin la sincroniza con
   Ani-Sync: es lo que alimenta la bandeja de pendientes.
9. **Capturas de pantalla** cuando algo se vea mal: hoy la de Oshi no Ko
   resolvió en un minuto lo que una descripción habría tardado diez.
10. **Tus decisiones de gusto** cuando toque diseño: qué es esencia y qué no.
    El resto lo decide Claude y te enseña antes y después.

Con esto, una sesión nueva puede desplegar, probar y ver la web desde el primer
minuto. Sin el punto 1 y el 2, sólo puede leer código.

## 7. ¿Hacer un `graphify` hoy?

Sí, pero **no en esta sesión**: mañana, con una sesión limpia. Motivos:

- Hoy se han escrito los documentos que un grafo cruzaría (`registro`,
  `estado-v2`, `esquema-ficha`, los README de `deploy/` y `generador/`). Con
  eso el grafo saldrá completo; hace una semana habría salido a medias.
- El código se extrae por AST, gratis; los documentos van por extracción
  semántica, que consume tokens. Después de una sesión larga es mejor no
  apilarle eso al mismo contexto.
- `graphify-out/` ya está en `.gitignore`: no ensucia el repositorio y se
  regenera con `/graphify --update` cuando cambie algo.

Cuándo compensa de verdad: si en las próximas sesiones vas a preguntar «qué
depende de qué» (por ejemplo, qué toca `related` de punta a punta) o a meter a
alguien nuevo en el proyecto. Si lo que viene es publicar borradores y escribir
opiniones, `CLAUDE.md` y `docs/` bastan.
