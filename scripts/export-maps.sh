#!/usr/bin/env bash
# Exports CS2 maps to public/maps/<map>.glb with materials, then shrinks them for the browser
# (meshopt geometry, GPU instancing, WebP textures resized to TEX_SIZE).
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
MAPS=("$@")
[[ ${#MAPS[@]} -gt 0 ]] || MAPS=(de_ancient de_anubis de_dust2 de_inferno de_mirage de_nuke de_overpass de_train de_vertigo)

for map in "${MAPS[@]}"; do
    echo "== $map"
    tmp=$(mktemp -d)
    trap 'rm -rf "$tmp"' EXIT
    # Without --gltf_export_materials the GLB has no materials and renders white.
    "$S2V" -i "$CS2_GAME/maps/$map.vpk" --vpk_filepath "maps/$map/world.vwrld_c" -o "$tmp" -d \
        --gltf_export_format glb --gltf_export_materials --gltf_textures_adapt >/dev/null
    # The raw export references its textures as loose PNGs next to world.glb; optimize embeds them.
    NODE_OPTIONS=--max-old-space-size=16384 npx -y @gltf-transform/cli@4 optimize \
        "$tmp/maps/$map/world.glb" "$OUT/$map.part.glb" \
        --compress meshopt --texture-compress webp --texture-size "$TEX_SIZE" 2>&1 \
        | { grep -v "quantize: Skipping TEXCOORD" || true; }
    # Only replace the served file once the new one is complete.
    mv "$OUT/$map.part.glb" "$OUT/$map.glb"
    rm -rf "$tmp"
    trap - EXIT
    ls -l "$OUT/$map.glb"
done
