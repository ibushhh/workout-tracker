import "dotenv/config";
import { readFileSync } from "fs";
import pool from "./src/db.js";

const sql = readFileSync(new URL("./schema.sql", import.meta.url), "utf8");

pool
  .query(sql)
  .then(() => {
    console.log("Schema applied.");
    return pool.end();
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
