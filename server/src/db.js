import pg from "pg";

// pg's default DATE parser (OID 1082) returns a JS Date at LOCAL midnight,
// which every call site then has to convert back to a "YYYY-MM-DD" string —
// and doing that via .toISOString() re-interprets it as UTC, silently
// shifting the date by a day on any server not running at UTC+0. A SQL
// DATE has no timezone at all, so keep it as the plain string Postgres
// already sends instead of round-tripping through a Date object.
pg.types.setTypeParser(1082, (val) => val);

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL === "false" ? false : { rejectUnauthorized: false },
  max: process.env.PG_POOL_MAX ? Number(process.env.PG_POOL_MAX) : 5,
});

export default pool;
