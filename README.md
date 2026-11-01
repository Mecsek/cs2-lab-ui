# cs2-lab-ui

Web UI for **cs2-bot-lab**: watch running bot-vs-bot CS2 matches in 3D in real time, browse
finished matches and replay them, and (once the backend sends it) see a live CT win-probability
chart for the current round.

Stack: Vite + TypeScript + React 18 + react-three-fiber / drei + react-router. No chart library
(the win-prob chart is hand-rolled SVG). Vitest for unit tests.

## Quick start

```bash
pnpm install
pnpm dev:mock      # mock api on :8080 + Vite on :5173, no backend needed
# or, against the real api:
VITE_API_URL=http://localhost:8080 pnpm dev
```

| Command | What it does |
| --- | --- |
| `pnpm dev` | Vite dev server (expects the api at `VITE_API_URL`) |
| `pnpm dev:mock` | Mock api (`mock/server.mjs`, port `PORT`=8080) and Vite in one process |
| `pnpm mock` | Only the mock api |
| `pnpm typecheck` | `tsc` |
| `pnpm test` | Vitest (coordinate, team-prefix and interpolation helpers) |
| `pnpm build` | Type-check and build static files into `dist/` |

npm works too (`npm install`, `npm run dev:mock`, ...).

### Configuration

- `VITE_API_URL`: base URL of the api service, default `http://localhost:8080`. The WebSocket
  URL comes from it (`http` becomes `ws`, `https` becomes `wss`). Vite inlines it **at build time**.
  See `.env.example`.

## Layout

```
src/
  api/        wire types (types.ts mirrors lab-core live.rs), REST client, WS live client
              (auto-reconnect), replay loader, Playback store (frame buffer + render clock)
  scene/      three.js scene: map GLB / grid fallback, players, bomb, grenades, cameras,
              mapConfig.ts (map transform, the one place to adjust it)
  hud/        overlays: round info/clock/bomb timer, scoreboard, kill feed, economy,
              win-prob chart, camera bar, replay controls, connection badge
  lib/        pure helpers + tests: coords.ts, teams.ts, interp.ts, format.ts
  pages/      Lobby, LivePage, ReplayPage, MatchView (shared by live and replay)
mock/         sim.mjs (synthetic match), server.mjs (REST + WS), dev.mjs (mock + vite)
```

### Routes

- `/` is the lobby. Running matches (polls `/api/matches?status=running` every 3 s), finished
  matches, teams and head-to-head stats.
- `/live/:id` is the live 3D view over `WS /ws/live/:id`.
- `/replay/:id` is the replay of a finished match from `GET /api/matches/:id/replay`.

### Match view

- **Cameras:** Orbit (default, drag to rotate, right-drag to pan, wheel to zoom), Top-down, and
  Follow (click a player in 3D or a scoreboard row). `Esc` returns to orbit.
- **Interpolation:** the scene renders about 125 ms (`LIVE_DELAY_MS` in `src/config.ts`) behind the
  newest live frame and lerps positions and yaw between snapshots. Large jumps (respawns) snap.
- **Replay:** play/pause (`Space`), 0.5x to 4x, timeline scrubber with round markers.
- **Win-prob chart:** stays hidden until the first `win_prob` message arrives.

## Coordinates and map models

Source positions are Z-up inches. `src/lib/coords.ts` holds the only conversion:

```
three = (x, z, -y) * 0.0254      // Y-up, metres; a -90° rotation about X plus a scale
```

Yaw 0 points along Source +X, yaw 90 along +Y, and positive pitch looks down. Top-down view puts
Source +Y at the top of the screen, the same as radar images.

### Exporting map GLBs

The scene loads `public/maps/<map>.glb` (for example `public/maps/de_dust2.glb`). If the file is
missing, the UI draws a grid sized to the players' bounding box instead.

Use `scripts/export-maps.sh`. It needs
[Source2Viewer-CLI](https://github.com/ValveResourceFormat/ValveResourceFormat) and Node (`npx`):

```bash
scripts/export-maps.sh                  # all maps in the script's list
scripts/export-maps.sh de_dust2 de_nuke # just these
# env: S2V=/path/to/Source2Viewer-CLI  CS2_GAME=.../game/csgo  TEX_SIZE=1024
```

For each map it:

1. Exports `maps/<map>/world.vwrld_c` from `<CS2_GAME>/maps/<map>.vpk` as GLB **with
   `--gltf_export_materials`**. Without that flag the GLB has no materials and every surface
   renders white.
2. Shrinks the result with `gltf-transform optimize`: meshopt-compressed geometry, GPU instancing
   for repeated props, and WebP textures resized to `TEX_SIZE` (1024 px by default). de_mirage
   goes from about 350 MB (GLB plus loose PNGs) to about 38 MB. `useGLTF` decodes meshopt by
   default, so the UI needs no changes.
3. Writes `public/maps/<map>.glb`, replacing the old file only once the new one is complete.

The large maps need a lot of RAM while optimizing (the script allows Node 16 GB). The GLBs are
not committed (`.gitignore`).

**Alignment assumption:** VRF's glTF exporter is believed to convert to Y-up metres itself, mapping
Source `(x, y, z)` to glTF `(y, z, x) * 0.0254`. `src/scene/mapConfig.ts` therefore rotates the
GLB by +90° about Y so it lands in our `(x, z, -y)` frame. This has **not** been checked against a
real export. If players float next to the geometry, or the map looks mirrored, rotated or about 40x
off in size, change `DEFAULT_MAP_TRANSFORM` there (`scale`, `rotationY`, `mirrorZ`, `offset`) or
add a per-map entry in `MAP_TRANSFORMS`. A quick check is that bots at spawn should stand on the
spawn floor.

## Docker

```bash
docker build -t cs2-lab-ui --build-arg VITE_API_URL=http://my-api-host:8080 .
docker run -p 8081:80 cs2-lab-ui
```

This is a multi-stage build: Node builds the app and nginx serves `dist/` with an SPA fallback.
Map GLBs are **not** baked into the image (`.dockerignore` excludes `public/maps/*.glb`; they are
hundreds of MB each). Mount them at runtime instead with
`-v $PWD/public/maps:/usr/share/nginx/html/maps:ro`; the cs2-bot-lab `docker-compose.yml` already
mounts `../cs2-lab-ui/public/maps` this way, so a fresh export shows up without a rebuild. Missing
GLBs return a real 404 from nginx, so the UI uses the grid fallback.

## Mock backend

`mock/server.mjs` implements the api contract with two running synthetic matches (10 bots
wandering between spawns and two bombsites, shooting, planting and defusing, throwing grenades,
round and halftime logic, `win_prob` messages) and three finished matches. Two finished matches
have replays, generated on demand. The third returns 404 on `/replay`, which exercises the
"demo not processed yet" state. Its map is `de_mock`, which has no GLB, so the grid fallback is
used.

## Wire types

`src/api/types.ts` mirrors `cs2-bot-lab/crates/lab-core/src/live.rs` (and `TeamParams` from
`team.rs`). If you change the Rust types, update it to match.
