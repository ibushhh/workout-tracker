// Dev-only local test database: runs a real Postgres (compiled to WASM via
// PGlite) and exposes it over a TCP socket, so the ordinary `pg` client the
// production server uses can connect to it with a normal DATABASE_URL. Use
// this in place of installing a real local Postgres.
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";

const db = await PGlite.create();
const server = new PGLiteSocketServer({ db, port: 55433, host: "127.0.0.1" });
await server.start();
console.log("PGlite test database listening on 127.0.0.1:55433");

process.on("SIGINT", async () => {
  await server.stop();
  await db.close();
  process.exit(0);
});
