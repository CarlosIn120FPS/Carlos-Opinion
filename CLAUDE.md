# Carlos' Opinion — instrucciones para Claude

Web personal de Carlos con sus opiniones sobre anime, manga y novelas ligeras,
alojada en su homelab. Léete `docs/contexto-para-claude.md` antes de tocar nada:
es el mapa entero (qué hay, dónde vive, cómo se publica, qué no se negocia).

## Lo que no se negocia

- **La voz es suya.** `category`, `rating`, `ratingFinal`, `personalOpinion`,
  `personalOpinionFinal`, `doIRecommend`, `willReadSource` y el diario
  (`entries`) los escribe Carlos. La IA rellena datos objetivos y nada más.
  Nunca escribas texto de ejemplo ni valores inventados en `public/data/*.json`.
- **Los tres modales conservan su carácter**: cristal (anime), viñeta (manga),
  libro (novela). Se cambia lo que muestran, no lo que son.
- **La web es estática** y **el alojamiento es suyo** (Pavilion). GitHub es copia.
- **Los enlaces entre fichas son explícitos** (`related`), nunca adivinados por
  título.

## Cómo se trabaja aquí

- `npm test` (sin `| grep`: mira el código de salida), `npm run lint`,
  `npm run build` antes de cada commit. Los tests que añadas tienen que
  **cazar el fallo** si lo reintroduces en local; compruébalo. Nunca
  reintroduzcas un fallo en Pavilion para verificar.
- Publicar: `node scripts/deploy.mjs` (push a `casa` y comprobación de
  `.deploy-ok`). Además `git push github main:v2`.
- Un cambio en `panel/` **no llega al panel** con el deploy: rebase en
  `~/carlos-opinion/panel-work` y `sudo systemctl restart carlos-opinion-panel`
  (`deploy/panel/README.md`). Un cambio en `deploy/nginx.conf` se copia a mano.
  Un cambio en `generador/generar.py` se copia a
  `~/carlos-opinion/generador/generador/` (no es un checkout). Un cambio en
  `deploy/post-receive` se copia a `~/carlos-opinion/repo.git/hooks/`. Un
  cambio en una unidad de `deploy/panel/` se copia a `/etc/systemd/system/`.
- Para mirar diseño: `node scripts/captura.mjs salida.png <url> [ancho] [alto] [dark]`
  hace capturas reales con Chrome headless. No publiques un cambio visual sin
  haberlo visto.
- Commits en español, con el porqué, y con lo que salió mal contado entero.
- Datos personales de Carlos (la colección de Whakoom, `panel.env`) no salen de
  donde están.

## Mapa rápido

| Qué | Dónde |
|---|---|
| Web (React + Vite + Tailwind) | `src/`, datos en `public/data/*.json`, portadas en `public/covers/` |
| Registro de secciones y niveles | `src/data/contentTypes.js`, `src/data/niveles.js` (`ESQUEMA`) |
| Panel privado (Node, sin deps) | `panel/`; lógica pura en `panel/lib/`, interfaz en `panel/web/`; `empujar.mjs` (timer: publica y respalda en GitHub) y `generar.mjs` (cola de borradores) corren en Pavilion |
| Generador de borradores (Python) | `generador/generar.py`; Whakoom en `generador/whakoom.py` |
| Despliegue | `deploy/` (hook, nginx, unidades systemd del panel), `scripts/deploy.mjs` |
| Páginas Open Graph, sitemap, feed RSS, robots | `scripts/og.mjs`, tras `vite build` |
| Tests | `scripts/test-*.mjs`, `generador/test_whakoom.py` |
| Documentos | `docs/` (`estado-v2.md` = estado; `registro-2026-09-03.md` = diario) |
