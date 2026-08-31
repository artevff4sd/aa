import { drizzle } from "drizzle-orm/sql-js";
import initSqlJs, { Database as SqlJsDatabase } from "sql.js";
import fs from "fs";
import path from "path";

const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), "data", "bot.db");

// Ensure data directory exists
const dir = path.dirname(dbPath);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

// Initialize sql.js with WASM
const SQL = await initSqlJs();

// Load existing database or create new one
const filebuffer = fs.existsSync(dbPath) ? fs.readFileSync(dbPath) : new Uint8Array(0);
const sqlDb: SqlJsDatabase = new SQL.Database(filebuffer);

// Save database to disk
function saveDb() {
  const data = sqlDb.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
}

// Save on process exit
process.on("exit", saveDb);
process.on("SIGINT", () => { saveDb(); process.exit(); });
process.on("SIGTERM", () => { saveDb(); process.exit(); });

export const db = drizzle(sqlDb);
export { saveDb };
