// `pnpm dev:mock`: starts the mock api (port 8080) and the Vite dev server in one process.
import { createServer } from "vite";

process.env.VITE_API_URL ??= `http://localhost:${process.env.PORT ?? 8080}`;
await import("./server.mjs");

const vite = await createServer();
await vite.listen();
vite.printUrls();
