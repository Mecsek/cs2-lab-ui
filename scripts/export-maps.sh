#!/usr/bin/env bash
# Exports CS2 maps and builds the blockout model the UI draws, public/maps/<map>.blockout.glb
# (scripts/blockout-map.mjs).
#
# The full export (with materials, shrunk: meshopt geometry, GPU instancing, WebP textures
# resized to TEX_SIZE) is only an intermediate: it is kept in maps-cache/<map>.glb, outside
# public/, so blockouts can be rebuilt without Source2Viewer. The UI never loads it.
#
# Usage: scripts/export-maps.sh --derived-only [map ...]   rebuild only <map>.blockout.glb from
#        maps-cache/<map>.glb (no Source2Viewer needed)
#
# Usage: scripts/export-maps.sh [map ...]     (default: every map listed below)
# Env:   S2V       path to Source2Viewer-CLI   (default: ~/Downloads/cli-linux-x64/Source2Viewer-CLI)
#        CS2_GAME  CS2 game/csgo directory     (default: ../cs2-bot-lab/cs2-base/game/csgo)
#        TEX_SIZE  max texture edge in pixels  (default: 1024)
set -euo pipefail
cd "$(dirname "$0")/.."
S2V="${S2V:-$HOME/Downloads/cli-linux-x64/Source2Viewer-CLI}"
CS2_GAME="${CS2_GAME:-../cs2-bot-lab/cs2-base/game/csgo}"
TEX_SIZE="${TEX_SIZE:-1024}"
OUT="public/maps"
CACHE="maps-cache"
mkdir -p "$CACHE" "$OUT"
DERIVED_ONLY=0
if [[ "${1:-}" == "--derived-only" ]]; then DERIVED_ONLY=1; shift; fi
MAPS=("$@")
[[ ${#MAPS[@]} -gt 0 ]] || MAPS=(de_ancient de_anubis de_dust2 de_inferno de_mirage de_nuke de_overpass de_train de_vertigo)

derived() {  # blockout model from maps-cache/$1.glb
    node --max-old-space-size=16384 scripts/blockout-map.mjs "$CACHE/$1.glb" "$OUT/$1.blockout.part.glb"
    mv "$OUT/$1.blockout.part.glb" "$OUT/$1.blockout.glb"
}

for map in "${MAPS[@]}"; do
    echo "== $map"
    if [[ $DERIVED_ONLY == 1 ]]; then
        derived "$map"
        ls -l "$OUT/$map.blockout.glb"
        continue
    fi
    tmp=$(mktemp -d)
    trap 'rm -rf "$tmp"' EXIT
    # Without --gltf_export_materials the GLB has no materials and renders white.
    "$S2V" -i "$CS2_GAME/maps/$map.vpk" --vpk_filepath "maps/$map/world.vwrld_c" -o "$tmp" -d \
        --gltf_export_format glb --gltf_export_materials --gltf_textures_adapt >/dev/null
    # The raw export references its textures as loose PNGs next to world.glb; optimize embeds them.
    NODE_OPTIONS=--max-old-space-size=16384 npx -y @gltf-transform/cli@4 optimize \
        "$tmp/maps/$map/world.glb" "$CACHE/$map.part.glb" \
        --compress meshopt --texture-compress webp --texture-size "$TEX_SIZE" 2>&1 \
        | { grep -v "quantize: Skipping TEXCOORD" || true; }
    # Only replace files once the new ones are complete.
    mv "$CACHE/$map.part.glb" "$CACHE/$map.glb"
    rm -rf "$tmp"
    trap - EXIT
    derived "$map"
    ls -l "$CACHE/$map.glb" "$OUT/$map.blockout.glb"
done
