# El panel privado

La herramienta de escritura de Carlos. Rellena los campos que sólo escribe él y
deja el diario mientras ve o lee algo, sin abrir un JSON a mano.

Es la pieza 2 de `docs/VERSION-2.md` y escribe contra el contrato de
`docs/esquema-ficha.md`.

## Usarlo

Está **alojado en Pavilion**, como la web:

- `https://panel.carlosin120fps.duckdns.org` — cuando añadas el Proxy Host
- `http://192.168.50.148:8099` — desde la LAN, ya funciona

Escribes, y se publica solo en un par de minutos. La barra lateral dice cuánto
queda por publicarse.

El montaje, las unidades de systemd y **el paso que tienes que dar tú en Nginx
Proxy Manager** están en [`deploy/panel/README.md`](../deploy/panel/README.md).

### Modo local, como plan B

```bash
npm run panel      # http://127.0.0.1:8099
```

Escribe en el árbol de trabajo y no commitea nada; publicar es `npm run deploy`.
Sirve si NPM se cae o si prefieres escribir sin publicar.

## Cómo está montado

```
panel/
  lib/secciones.mjs   el único mapa de secciones: ficheros, campos, orden de claves
  lib/aplicar.mjs     aplicar una operación. PURO: ni disco, ni red, ni reloj
  servidor.mjs        http de node, sin dependencias
  web/                la interfaz: un HTML y un módulo, sin compilar nada
  .copias/            copias automáticas antes de cada escritura (en .gitignore)
```

La lógica que escribe en los datos de Carlos vive en `lib/`, separada del
servidor, porque es la que hay que tener probada: `npm test` la comprueba con 55
casos, y el primero es que leer sus tres JSON y volver a serializarlos da los
**mismos bytes**.

### Un solo sitio donde está la verdad

El navegador importa `src/lib/entries.js`, `src/data/niveles.js` y
`src/lib/rating.js` **tal cual** — son ESM sin dependencias, y el servidor los
sirve bajo `/m/`. O sea que el agrupado del diario que ves en el panel es
literalmente el mismo código que pinta la web pública. Si algún día cambia el
esquema, cambian los dos a la vez o no cambia ninguno.

Por eso el panel no lleva Vite, ni React, ni un `dist/` que compilar: no le hace
falta, y así no acopla su compilación al despliegue de la web pública.

### Qué campos enseña, y por qué no los mismos en las tres secciones

Los declara `lib/secciones.mjs`. Anime tiene siete; manga y novelas, seis.

La diferencia es `willReadSource`, que **sólo existe en anime**: lo tienen las 8
fichas de anime y 0 de las otras dos. Ofrecerlo en manga sería inventarse un
campo que nadie pinta.

### Lo que rechaza a propósito

- Un campo que no sea de Carlos (`title`, `genres`...). El panel no edita datos
  objetivos: para eso está el generador.
- Una categoría que no esté declarada en el propio JSON.
- Un localizador que la sección no declare: un `season` en manga da **400**, no
  se guarda «por si acaso». Nada lo pintaría nunca y quedaría como basura
  silenciosa dentro de sus datos.
- Una entrada sin texto y sin nota: no dice nada.
- Una nota fuera de 0–10.

### Detalles que parecen tonterías y no lo son

- **La fecha la pone el panel, no Carlos.** Es lo que dice el esquema y lo que
  evita teclear una fecha para escribir dos frases.
- **La nota de una entrada es un número; la de la obra es una cadena** (`"9/10"`).
  Esa distinción es del esquema, no un descuido.
- **Al añadir una entrada, el último nivel se autoincrementa.** Escribes el
  episodio 8 y el campo se queda en el 9: mañana no hay que teclearlo.
- **Editar una entrada conserva su fecha original.** Corregir una errata no
  mueve la nota en el tiempo.
- **Un diario vacío no deja `entries: []`**, para que el diff de git no se llene
  de ruido.
- **Escritura atómica** (`.tmp` + `rename`) y copia previa en `.copias/`, de la
  que se guardan las 20 últimas por sección.

## Seguridad

En modo local escucha **sólo en 127.0.0.1**: no sale de la máquina. `listen(puerto)`
a secas en node abriría en `0.0.0.0`, y el criterio del nodo es no hacer eso nunca.

Los ficheros estáticos salen **sólo** de `panel/web/`, más una lista blanca
literal de tres módulos. No se sirve ningún directorio raíz: dentro del
repositorio está `.git/`.

## Lo que NO hace

**La IA no escribe aquí.** Ni una entrada, ni una nota, ni un resumen de las
entradas, ni una sugerencia. El generador rellena datos objetivos; esto es la voz
de Carlos y es todo el valor de la web.

## Lo que falta

Sólo el **Proxy Host en Nginx Proxy Manager**, que lo añade Carlos por la UI —
NPM no se toca por línea de comandos. Los pasos exactos, y la única forma de
comprobar la Access List que sirve de algo (desde datos móviles, con
`X-Forwarded-For` forjado), están en
[`deploy/panel/README.md`](../deploy/panel/README.md).

Mientras tanto el panel ya funciona desde la LAN en `http://192.168.50.148:8099`.
