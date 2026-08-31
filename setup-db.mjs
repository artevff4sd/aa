// setup-db.mjs — Creates SQLite tables manually (no drizzle-kit needed)
import initSqlJs from "sql.js";
import fs from "fs";
import path from "path";

const dbPath = process.env.DATABASE_PATH || "./data/bot.db";

// Ensure data directory exists
const dir = path.dirname(dbPath);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

const SQL = await initSqlJs();
const filebuffer = fs.existsSync(dbPath) ? fs.readFileSync(dbPath) : new Uint8Array(0);
const db = new SQL.Database(filebuffer);

// Create tables
db.run(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telegram_id INTEGER UNIQUE NOT NULL,
    username TEXT,
    first_name TEXT,
    state TEXT DEFAULT 'idle' NOT NULL,
    pending_gift_link TEXT,
    pending_star_count INTEGER,
    admin_state TEXT,
    admin_state_data TEXT,
    created_at INTEGER DEFAULT (unixepoch()) NOT NULL,
    updated_at INTEGER DEFAULT (unixepoch()) NOT NULL
  );
`);

db.run(`
  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    user_id INTEGER NOT NULL REFERENCES users(id),
    gift_link TEXT NOT NULL,
    gift_name TEXT,
    type TEXT DEFAULT 'gift' NOT NULL,
    star_count INTEGER NOT NULL,
    price_toman INTEGER NOT NULL,
    status TEXT DEFAULT 'pending' NOT NULL,
    receipt_file_id TEXT,
    reject_reason TEXT,
    created_at INTEGER DEFAULT (unixepoch()) NOT NULL,
    updated_at INTEGER DEFAULT (unixepoch()) NOT NULL
  );
`);

db.run(`
  CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT UNIQUE NOT NULL,
    value TEXT NOT NULL,
    updated_at INTEGER DEFAULT (unixepoch()) NOT NULL
  );
`);

db.run(`
  CREATE TABLE IF NOT EXISTS channels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    channel_id INTEGER UNIQUE NOT NULL,
    channel_name TEXT,
    is_active INTEGER DEFAULT 1,
    created_at INTEGER DEFAULT (unixepoch()) NOT NULL
  );
`);

// Save
const data = db.export();
const buffer = Buffer.from(data);
fs.writeFileSync(dbPath, buffer);

console.log("✅ Database created successfully at:", dbPath);
console.log("Tables: users, orders, settings, channels");
