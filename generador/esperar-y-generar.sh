#!/usr/bin/env bash
# Espera a que AniList levante el bloqueo de IP y entonces hace todo el trabajo.
# Lanzado en segundo plano: no hay que vigilarlo.
set -uo pipefail
cd "$HOME/carlos-opinion/generador"
LOG="$HOME/carlos-opinion/generador/auto.log"
exec >>"$LOG" 2>&1

echo "=== arrancado ==="

# 1. Esperar a AniList, pero SIN depender de el. Da mejores datos (generos,
# titulo nativo, numero de episodios), asi que merece la pena esperar un rato.
# Pasadas 3 horas se tira igual: el generador cae solo a animethemes, que agrupa
# la franquicia y trae los temas, que es lo importante.
for i in $(seq 1 18); do
  if python3 - <<'PY'
import json, sys, urllib.request
try:
    r = urllib.request.Request("https://graphql.anilist.co",
        data=json.dumps({"query":"query{Media(id:1,type:ANIME){id}}"}).encode(),
        headers={"Content-Type":"application/json","User-Agent":"carlos-opinion-generador/1.0"})
    urllib.request.urlopen(r, timeout=20).read()
    sys.exit(0)
except Exception:
    sys.exit(1)
PY
  then
    echo "[$(date -Is)] AniList responde tras $((i*10)) min de espera"
    break
  fi
  [ "$i" = 18 ] && echo "[$(date -Is)] 3 h y sigue bloqueado. Sigo igual con animethemes."
  sleep 600
done

# 2. Proponer los anilistIds de las fichas que aun no los declaran.
echo "[$(date -Is)] --- backfill-ids ---"
python3 generador/generar.py --backfill-ids public/data/anime.json > backfill-propuesta.txt 2>&1
echo "guardado en backfill-propuesta.txt"

# 3. Que hay en Jellyfin y no en la web.
echo "[$(date -Is)] --- pendientes ---"
python3 generador/generar.py --pendientes public/data/anime.json > pendientes.txt 2>&1
tail -5 pendientes.txt

# 4. Generar los borradores. Con la cache, las pasadas siguientes son baratas.
echo "[$(date -Is)] --- generando borradores ---"
python3 generador/generar.py --pendientes public/data/anime.json --generar
echo "[$(date -Is)] === terminado ==="
