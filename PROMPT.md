# Complete Project Specification: Telegram Gift & Star Sales Bot — Pepe Star

## 1. Project Overview

Build a full-stack Telegram bot + web admin panel for selling Telegram **gifts** and **stars** (premium stars) priced in Iranian Toman (IRR). The brand name is **Pepe Star**. The bot uses webhook mode. The web admin panel allows managing orders, settings, and viewing logs. Completed orders are automatically posted to a designated Telegram **log channel**.

**Key features:**
- Users send a gift link or a star count → get a price → pay via bank card → send receipt photo → admin approves → gift/star delivered
- Admin panel at `/admin` for managing orders, settings, and log channels
- Automatic log messages sent to a Telegram channel when orders are completed
- Two purchase modes: **Gift** (user sends a gift link) and **Star** (user sends a number)
- All UI is in **Persian (Farsi)**, **RTL layout**

---

## 2. Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, TypeScript) |
| Database | SQLite via `sql.js` (WebAssembly, no native compilation) |
| ORM | Drizzle ORM 0.45.2 |
| Styling | Tailwind CSS 4 via `@tailwindcss/postcss` |
| Bot | Telegram Bot API (webhook mode, no polling) |
| Language | TypeScript (strict mode) |
| Package Manager | npm |

**No Docker required.** Database is a single SQLite file at `./data/bot.db`.

---

## 3. Complete File Structure

```
project-root/
├── .env                          # Environment variables
├── .env.example                  # Example env file
├── .gitignore                    # Git ignore rules
├── drizzle.config.json           # Drizzle ORM config
├── package.json                  # Dependencies and scripts
├── SETUP.bat                     # Windows setup script (double-click to run)
├── setup.ps1                     # PowerShell setup script
├── next.config.ts                # Next.js config (minimal, no special settings)
├── tsconfig.json                 # TypeScript config
├── postcss.config.mjs            # PostCSS config for Tailwind
├── eslint.config.mjs             # ESLint config
└── src/
    ├── middleware.ts              # Admin auth middleware (token-based)
    ├── app/
    │   ├── globals.css           # Just: @import "tailwindcss";
    │   ├── layout.tsx            # Root layout (RTL, Persian, dark theme)
    │   ├── page.tsx              # Landing page
    │   ├── admin/
    │   │   └── page.tsx          # Admin panel (client component)
    │   ├── setup/
    │   │   └── page.tsx          # Setup guide page (client component)
    │   └── api/
    │       ├── health/route.ts   # Health check endpoint
    │       ├── bot-info/route.ts # Get bot username
    │       ├── admin/
    │       │   ├── auth/route.ts           # Admin login
    │       │   ├── orders/route.ts         # List orders (GET)
    │       │   ├── orders/[id]/route.ts    # Order actions (POST)
    │       │   ├── photo/[fileId]/route.ts # Proxy Telegram photos
    │       │   └── settings/route.ts       # Get/update settings
    │       └── telegram/
    │           ├── webhook/route.ts        # Main webhook handler
    │           └── setup/route.ts          # Set/check webhook
    ├── db/
    │   ├── schema.ts             # Drizzle schema (SQLite tables)
    │   └── index.ts              # Database connection (sql.js)
    └── lib/
        ├── constants.ts          # Admin IDs, statuses, default settings
        ├── telegram.ts           # Telegram API wrapper functions
        └── utils.ts              # Helper functions
```

---

## 4. Configuration Files

### `.env`
```
TELEGRAM_BOT_TOKEN=your_bot_token_here
DATABASE_PATH=./data/bot.db
ADMIN_PASSWORD=your_secure_password
WEBHOOK_URL=https://your-domain.com
```

### `.env.example`
```
TELEGRAM_BOT_TOKEN=your_bot_token_here
DATABASE_PATH=./data/bot.db
ADMIN_PASSWORD=your_secure_password
WEBHOOK_URL=https://your-domain.com
```

### `.gitignore`
```
node_modules/
data/
.env
.next/
```

### `drizzle.config.json`
```json
{
  "dialect": "sqlite",
  "schema": "./src/db/schema.ts",
  "dbCredentials": {
    "url": "./data/bot.db"
  }
}
```

### `tsconfig.json`
```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "incremental": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    },
    "plugins": [{ "name": "next" }]
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts", ".next/dev/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

### `postcss.config.mjs`
```js
const postcssConfig = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
export default postcssConfig;
```

### `eslint.config.mjs`
```js
import { defineConfig, globalIgnores } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

export default defineConfig([
  ...nextCoreWebVitals,
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);
```

### `next.config.ts`
```ts
import type { NextConfig } from "next";
const nextConfig: NextConfig = {};
export default nextConfig;
```

### `package.json`
```json
{
  "name": "nextjs-postgresql-template",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "dotenv": "17.3.1",
    "drizzle-orm": "0.45.2",
    "next": "16.2.6",
    "react": "19.2.6",
    "react-dom": "19.2.6",
    "sql.js": "1.11.0"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "4.1.17",
    "@types/node": "22.19.15",
    "@types/react": "19.2.14",
    "@types/react-dom": "19.2.3",
    "drizzle-kit": "0.31.10",
    "eslint": "9.39.4",
    "eslint-config-next": "16.2.6",
    "postcss": "8.5.8",
    "tailwindcss": "4.1.17",
    "typescript": "5.9.3"
  }
}
```

### `globals.css`
```css
@import "tailwindcss";
```

---

## 5. Database Schema (Drizzle ORM — SQLite)

File: `src/db/schema.ts`

### Table: `users`
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `integer` | PK, autoIncrement | Internal ID |
| `telegram_id` | `integer` | UNIQUE, NOT NULL | Telegram user ID (number) |
| `username` | `text` | nullable | Telegram @username |
| `first_name` | `text` | nullable | Telegram display name |
| `state` | `text` | DEFAULT `'idle'`, NOT NULL | Conversation state |
| `pending_gift_link` | `text` | nullable | Gift link awaiting star count |
| `pending_star_count` | `integer` | nullable | Star count awaiting confirmation |
| `admin_state` | `text` | nullable | Admin conversation state |
| `admin_state_data` | `text` | nullable | Data for admin state |
| `created_at` | `integer` | mode: `timestamp`, DEFAULT `new Date()` | Created timestamp |
| `updated_at` | `integer` | mode: `timestamp`, DEFAULT `new Date()` | Updated timestamp |

### Table: `orders`
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `integer` | PK, autoIncrement | Internal ID |
| `code` | `text` | UNIQUE, NOT NULL | 6-char order code (e.g. A3BK7M) |
| `user_id` | `integer` | FK → `users.id`, NOT NULL | Owner user |
| `gift_link` | `text` | NOT NULL | Gift link URL or "سفارش دستی" for manual orders |
| `gift_name` | `text` | nullable | Gift slug name |
| `type` | `text` | DEFAULT `'gift'` | **NEW:** `'gift'` or `'star'` |
| `star_count` | `integer` | NOT NULL | Number of stars |
| `price_toman` | `integer` | NOT NULL | Price in Toman (no decimals) |
| `status` | `text` | DEFAULT `'pending'`, NOT NULL | Order status |
| `receipt_file_id` | `text` | nullable | Telegram file_id of receipt photo |
| `reject_reason` | `text` | nullable | Reason for rejection |
| `created_at` | `integer` | mode: `timestamp`, DEFAULT `new Date()` | Created timestamp |
| `updated_at` | `integer` | mode: `timestamp`, DEFAULT `new Date()` | Updated timestamp |

### Table: `settings`
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `integer` | PK, autoIncrement | Internal ID |
| `key` | `text` | UNIQUE, NOT NULL | Setting key |
| `value` | `text` | NOT NULL | Setting value |
| `updated_at` | `integer` | mode: `timestamp`, DEFAULT `new Date()` | Updated timestamp |

### Table: `channels` (NEW)
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `integer` | PK, autoIncrement | Internal ID |
| `channel_id` | `integer` | UNIQUE, NOT NULL | Telegram channel ID (negative number, e.g. -1001234567890) |
| `channel_name` | `text` | nullable | Display name for the channel |
| `is_active` | `integer` | DEFAULT `1` | 1 = active, 0 = inactive |
| `created_at` | `integer` | mode: `timestamp`, DEFAULT `new Date()` | Created timestamp |

**Drizzle imports for SQLite schema:**
```ts
import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";
```

---

## 6. Database Connection

File: `src/db/index.ts`

Uses `sql.js` (WebAssembly-based SQLite, no native compilation needed).

```ts
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
```

**Key points:**
- Uses top-level `await` for `initSqlJs()` (works with ES modules in Next.js 16)
- Saves to disk on process exit (SIGINT, SIGTERM, exit)
- WAL mode is not needed for sql.js (it's in-memory with file persistence)
- Foreign keys are enabled by default in sql.js

---

## 7. Constants

File: `src/lib/constants.ts`

```ts
export const ADMIN_IDS = [7184299507, 5851497957];

export const ORDER_STATUSES = {
  PENDING: "pending",
  RECEIPT_SENT: "receipt_sent",
  PENDING_APPROVAL: "pending_approval",
  APPROVED: "approved",
  REJECTED: "rejected",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
} as const;

export const USER_STATES = {
  IDLE: "idle",
  AWAITING_STAR_COUNT: "awaiting_star_count",
  AWAITING_RECEIPT: "awaiting_receipt",
  RECEIPT_SENT: "receipt_sent",
} as const;

export const ADMIN_STATES = {
  AWAITING_REJECT_REASON: "awaiting_reject_reason",
} as const;

export const DEFAULT_SETTINGS: Record<string, string> = {
  card_number: "0000-0000-0000-0000",
  card_holder_name: "نام صاحب کارت",
  exchange_rate: "5000",
};

export const STATUS_LABELS: Record<string, string> = {
  pending: "⏳ در انتظار رسید",
  receipt_sent: "📸 رسید ارسال شده",
  pending_approval: "🔍 در انتظار تایید ادمین",
  approved: "✅ تایید شده",
  rejected: "❌ رد شده",
  in_progress: "🔄 در حال انجام",
  completed: "✅ تکمیل شده",
  cancelled: "🚫 لغو شده",
};
```

---

## 8. Utility Functions

File: `src/lib/utils.ts`

```ts
import crypto from "crypto";

// Generate 6-char order code from safe characters (no ambiguous chars like I/1/O/0)
export function generateOrderCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  const bytes = crypto.randomBytes(6);
  for (let i = 0; i < 6; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
}

// Format number with Persian locale separators
export function formatPrice(price: number): string {
  return price.toLocaleString("fa-IR");
}

// Parse gift link from various Telegram gift URL formats
export function parseGiftLink(text: string): string | null {
  const patterns = [
    /t\.me\/nft\/([^\s?]+)/,
    /telegram\.me\/nft\/([^\s?]+)/,
    /tg:\/\/nft\?slug=([^\s&]+)/,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1];
  }
  return null;
}

// Check if a Telegram user ID is an admin
export function isAdmin(telegramId: number): boolean {
  const adminIds = [7184299507, 5851497957];
  return adminIds.includes(telegramId);
}
```

---

## 9. Telegram API Wrapper

File: `src/lib/telegram.ts`

A thin wrapper around the Telegram Bot API. All functions call `callApi` which sends POST requests to `https://api.telegram.org/bot{token}/{method}`.

```ts
const TELEGRAM_API = "https://api.telegram.org";

function getBotToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is required");
  return token;
}

async function callApi(method: string, body?: Record<string, unknown>) {
  const token = getBotToken();
  const res = await fetch(`${TELEGRAM_API}/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!data.ok) console.error(`Telegram API error [${method}]:`, data);
  return data;
}
```

**Exported functions:**

| Function | Parameters | Description |
|----------|-----------|-------------|
| `sendMessage` | `(chatId: number, text: string, extra?: Record<string, unknown>)` | Send HTML message. Always includes `parse_mode: "HTML"`. Merges `extra` (e.g. `reply_markup`). |
| `sendPhoto` | `(chatId: number, photo: string, caption?: string, extra?: Record<string, unknown>)` | Send photo with HTML caption. |
| `editMessageText` | `(chatId: number, messageId: number, text: string, extra?: Record<string, unknown>)` | Edit existing message text. |
| `editMessageReplyMarkup` | `(chatId: number, messageId: number, replyMarkup?: Record<string, unknown>)` | Edit inline keyboard. Pass `undefined` to remove buttons. |
| `answerCallbackQuery` | `(callbackQueryId: string, text?: string, showAlert?: boolean)` | Answer callback query. `showAlert: true` shows alert popup. |
| `getFile` | `(fileId: string)` | Get file info from Telegram. |
| `getAvailableGifts` | `()` | Get list of available gifts from Telegram. |
| `getMe` | `()` | Get bot info (username etc). |
| `getFileUrl` | `(filePath: string): string` | Build file download URL from file path. |
| `forwardMessage` | `(chatId: number, fromChatId: number, messageId: number)` | Forward a message. |
| `sendDocument` | `(chatId: number, document: string, caption?: string, extra?: Record<string, unknown>)` | Send document with caption. |

---

## 10. Middleware (Admin Auth)

File: `src/middleware.ts`

Protects all `/api/admin/*` routes except `/api/admin/auth`.

```ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import crypto from "crypto";

// In-memory token store
const validTokens = new Set<string>();

export function verifyAdminToken(token: string): boolean {
  return validTokens.has(token);
}

export function registerAdminToken(token: string): void {
  validTokens.add(token);
  if (validTokens.size > 100) {
    const first = validTokens.values().next().value;
    if (first) validTokens.delete(first);
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api/admin")) {
    if (pathname === "/api/admin/auth") return NextResponse.next();

    const authHeader = request.headers.get("authorization");
    const cookieToken = request.cookies.get("admin_token")?.value;
    const token = authHeader?.replace("Bearer ", "") || cookieToken;

    if (!token || !verifyAdminToken(token)) {
      return NextResponse.json({ ok: false, message: "غیرمجاز." }, { status: 401 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/admin/:path*"],
};
```

**Key details:**
- Tokens stored in a `Set<string>` in memory (resets on server restart)
- Max 100 tokens stored (FIFO eviction)
- Auth via `Authorization: Bearer {token}` header OR `admin_token` cookie
- The auth check applies to all `/api/admin/*` routes EXCEPT `/api/admin/auth`

---

## 11. API Routes — Complete Specification

### 11.1 `POST /api/admin/auth` — Admin Login

**File:** `src/app/api/admin/auth/route.ts`

**Request body:** `{ password: string }`
**Response:** `{ ok: true, message: "ورود موفقیت‌آماده بود.", token: string }` or `{ ok: false, message: "رمز عبور اشتباه است." }` (401)

**Logic:**
1. Compare `password` with `process.env.ADMIN_PASSWORD` (fallback: `"admin123"`)
2. If match: generate random 32-byte hex token, register it via `registerAdminToken()`, return token
3. If no match: return 401 error

### 11.2 `GET /api/health` — Health Check

**File:** `src/app/api/health/route.ts`

**Response:** `{ ok: true }` or `{ ok: false }` (500)

**Logic:** Execute `SELECT 1` on the database. Return ok/error.

### 11.3 `GET /api/bot-info` — Get Bot Username

**File:** `src/app/api/bot-info/route.ts`

**Response:** `{ ok: true, username: string }` or `{ ok: false }` (500)

**Logic:** Call `getMe()` from telegram.ts, return `result.username`.

### 11.4 `GET/POST /api/telegram/setup` — Webhook Setup

**File:** `src/app/api/telegram/setup/route.ts`

**POST Request body:** `{ webhookUrl?: string }`
**POST Response:** `{ ok: true, message: string, webhook_url: string }` or error

**POST Logic:**
1. Get token from env
2. Use `webhookUrl` from body, or fallback to `process.env.WEBHOOK_URL`
3. Build full URL: `{url}/api/telegram/webhook`
4. Call `setWebhook` on Telegram API with `allowed_updates: ["message", "callback_query"]`
5. Return result

**GET Response:** `{ ok: true, info: WebhookInfo }` — calls `getWebhookInfo` from Telegram API

### 11.5 `GET /api/admin/settings` — Get Settings

**File:** `src/app/api/admin/settings/route.ts`

**Response:** `{ ok: true, settings: { card_number: string, card_holder_name: string, exchange_rate: string, log_channel_id?: string, log_channel_name?: string } }`

**Logic:**
1. Select all rows from `settings` table
2. Build key-value map
3. Set defaults for missing keys: `card_number` = "0000-0000-0000-0000", `card_holder_name` = "نام صاحب کارت", `exchange_rate` = "5000"
4. Also include `log_channel_id` and `log_channel_name` defaults (empty strings)

### 11.6 `POST /api/admin/settings` — Save Settings

**File:** `src/app/api/admin/settings/route.ts`

**Request body:** `{ card_number?: string, card_holder_name?: string, exchange_rate?: string, log_channel_id?: string, log_channel_name?: string }`
**Response:** `{ ok: true, message: "تنظیمات ذخیره شد." }`

**Logic:**
1. For each provided key-value pair:
   - Check if key exists in `settings` table
   - If exists: update value and `updated_at`
   - If not: insert new row
2. For `log_channel_id` and `log_channel_name`, save to the `channels` table instead (upsert by `channel_id`)
3. Return success

### 11.7 `GET /api/admin/orders` — List Orders

**File:** `src/app/api/admin/orders/route.ts`

**Query params:** `status?` (filter by status), `search?` (search by code/username/first_name)

**Response:** `{ ok: true, orders: OrderWithUser[] }`

**Logic:**
1. Select from `orders` LEFT JOIN `users` on `orders.user_id = users.id`
2. Select fields: `id, code, userId, giftLink, giftName, type, starCount, priceToman, status, receiptFileId, rejectReason, createdAt, updatedAt, userTelegramId, userUsername, userFirstName`
3. Order by `orders.id DESC`
4. Filter in JavaScript (not SQL) by status and search query
5. Search is case-insensitive substring match on `code`, `userUsername`, `userFirstName`

### 11.8 `POST /api/admin/orders/[id]` — Order Action

**File:** `src/app/api/admin/orders/[id]/route.ts`

**Request body:** `{ action: "approve" | "reject" | "complete" | "cancel", reason?: string }`

**Params:** `id` (order ID from URL)

**Logic per action:**

**approve:**
1. Set order status to `approved`, update `updated_at`
2. Find the order's user, get their `telegram_id`
3. Send message to user: order approved + code + instructions to contact `@samimige16`
4. Return `{ ok: true, message: "سفارش تایید شد." }`

**reject:**
1. Set order status to `rejected`, set `reject_reason` from body, update `updated_at`
2. Send message to user: order rejected + code + reason
3. Return `{ ok: true, message: "سفارش رد شد." }`

**complete:**
1. Set order status to `completed`, update `updated_at`
2. Send message to user: congratulations + code
3. **NEW:** Send log message to configured channel (see section 14)
4. Return `{ ok: true, message: "سفارش تکمیل شد." }`

**cancel:**
1. Set order status to `cancelled`, update `updated_at`
2. Send message to user: order cancelled + code
3. Return `{ ok: true, message: "سفارش لغو شد." }`

**Not found:** Return 404.

### 11.9 `GET /api/admin/photo/[fileId]` — Photo Proxy

**File:** `src/app/api/admin/photo/[fileId]/route.ts`

**Params:** `fileId` (URL-encoded Telegram file_id)

**Logic:**
1. Call `getFile(fileId)` to get file info from Telegram
2. If not found, return 404
3. Build file URL with `getFileUrl()`
4. Fetch the image from Telegram
5. Return the image buffer with appropriate `Content-Type` and `Cache-Control: public, max-age=3600`

---

## 12. Telegram Webhook Handler (Main Bot Logic)

File: `src/app/api/telegram/webhook/route.ts`

**Endpoint:** `POST /api/telegram/webhook`
**Always returns:** `{ ok: true }` (even on error, to prevent Telegram retries)

**Exports:** `export const dynamic = "force-dynamic";`

The handler processes two types of Telegram updates:
1. `update.message` → `handleMessage()`
2. `update.callback_query` → `handleCallbackQuery()`

### Helper Functions in webhook route:

```ts
async function getSetting(key: string): Promise<string>
```
Query `settings` table by key. Return value or fallback to defaults.

```ts
async function ensureUser(telegramId: number, username?: string, firstName?: string)
```
Find user by `telegramId`. If exists, update `username`, `firstName`, `updatedAt`. If not, insert new user. Return user row.

```ts
async function notifyAdmins(text: string, replyMarkup?: Record<string, unknown>)
```
Send message to ALL admin IDs defined in `ADMIN_IDS` constant.

```ts
async function notifyAdminsWithPhoto(photoId: string, caption: string, replyMarkup?: Record<string, unknown>)
```
Send photo with caption to ALL admin IDs.

### handleMessage() — Complete Flow

**Input:** `message` object from Telegram update

**Extract:** `chatId`, `telegramId`, `text`, `username`, `firstName`

**Step 1 — Ensure user exists:** Call `ensureUser()`

**Step 2 — Handle `/start`:**
- Reset user state to `idle`
- Send welcome message:
```
🎁 <b>به ربات خرید گیفت تلگرامی خوش آمدید!</b>

برای خرید گیفت، لینک گیفت رو بفرستید.
مثال: <code>https://t.me/nft/GiftName-12345</code>

یا تعداد ستاره گیفت مورد نظرتون رو بنویسید.
```

**Step 3 — Handle admin reject reason:**
- Condition: `isAdmin(telegramId)` AND `user.adminState === "awaiting_reject_reason"` AND `user.adminStateData` exists
- Parse order ID from `adminStateData`
- Set order status to `rejected`, set `rejectReason` to the text
- Reset admin state to null
- Notify the order's user with rejection message + reason
- Confirm to admin: "سفارش {code} رد شد و دلیل برای کاربر ارسال شد."

**Step 4 — Handle star count input (when awaiting):**
- Condition: `user.state === "awaiting_star_count"` AND `user.pendingGiftLink` exists
- Parse star count from text (must be positive integer)
- Calculate price: `starCount × exchange_rate`
- Create order: `type: "gift"`, `giftLink: user.pendingGiftLink`, `starCount`, `priceToman`, `status: "pending"`
- Reset user state to `idle`, clear `pendingGiftLink`
- Send order info + "🛒 خرید" inline button with `callback_data: "buy_{orderId}"`

**Step 5 — Handle photo (receipt):**
- Condition: `message.photo` exists AND `user.state === "awaiting_receipt"`
- Get the largest photo's `file_id`
- Find the user's most recent pending order (status = `pending`, ordered by `id DESC`, limit 1)
- Update order: set `receiptFileId`, status → `receipt_sent`
- Update user state → `receipt_sent`
- Send confirmation + "💳 پرداخت شد" button with `callback_data: "paid_{orderId}"`

**Step 6 — Handle photo when NOT awaiting receipt:**
- Send error: "📸 عکس رسید رو فقط بعد از زدن دکمه خرید و دیدن شماره کارت میتونید بفرستید."

**Step 7 — Handle gift link:**
- Try to parse gift link from text using `parseGiftLink()`
- If link found:
  - Try to get star count from Telegram's `getAvailableGifts` API
  - If found: create order immediately with `type: "gift"`, send info + buy button
  - If not found: set user state to `awaiting_star_count`, store link in `pendingGiftLink`, ask user for star count

**Step 8 — Handle number input (star purchase):**
- Condition: `user.state === "idle"` AND text is a pure number (`/^\d+$/`)
- Star count = parsed number (must be > 0 and <= 1,000,000)
- Calculate price: `starCount × exchange_rate`
- Create order: `type: "star"`, `giftLink: "سفارش دستی"`, `starCount`, `priceToman`, `status: "pending"`
- Send order info + "🛒 خرید" inline button

**Step 9 — Default help:**
```
❓ لطفاً لینک گیفت تلگرامی رو بفرستید یا تعداد ستاره رو وارد کنید.

مثال لینک: <code>https://t.me/nft/GiftName-12345</code>
مثال عدد: <code>100</code>
```

### handleCallbackQuery() — Complete Flow

**Input:** `callbackQuery` object from Telegram update

**Extract:** `data`, `chatId`, `messageId`, `telegramId`, `username`, `firstName`

**Ensure user exists.**

**`buy_{orderId}`:**
1. Find order by ID
2. Verify order exists and belongs to this user
3. Get card number and card holder from settings
4. Set user state to `awaiting_receipt`
5. Edit message to show payment info:
```
💳 <b>اطلاعات پرداخت:</b>

💳 شماره کارت: <code>{cardNumber}</code>
👤 صاحب کارت: {cardHolder}
💰 مبلغ: {price} تومان

⚠️ خرید توسط ادمین تایید میشه پس امکان داره طول بکشه.

📸 لطفاً بعد از پرداخت، عکس رسید رو بفرستید.
```
6. Answer callback query

**`paid_{orderId}`:**
1. Find order by ID, verify ownership
2. Verify order status is `receipt_sent`
3. Set order status → `pending_approval`
4. Set user state → `idle`
5. Remove inline keyboard from message
6. Send confirmation to user with order code
7. Notify ALL admins with order details + receipt photo (if available) + approve/reject buttons:
```
🔔 <b>سفارش جدید!</b>

👤 کاربر: @{username} ({firstName})
🆔 آیدی: {telegramId}
⭐ ستاره: {starCount}
💰 قیمت: {price} تومان
🔑 کد: <code>{code}</code>
```
Admin buttons: `[{ text: "✅ تایید", callback_data: "approve_{id}" }, { text: "❌ رد", callback_data: "reject_{id}" }]`

**`approve_{orderId}`:**
1. Verify sender is admin
2. Find order, verify status is `pending_approval`
3. Set order status → `approved`
4. Edit message to confirm approval
5. Notify user: approved + code + instructions to contact `@samimige16`

**`reject_{orderId}`:**
1. Verify sender is admin
2. Find order
3. Set admin user's state to `awaiting_reject_reason`, store order ID in `adminStateData`
4. Ask admin to write rejection reason

**`complete_{orderId}`:**
1. Verify sender is admin
2. Find order
3. Set order status → `completed`
4. Edit message to confirm completion
5. Notify user: congratulations
6. **NEW:** Send log message to configured channel (see section 14)

**`cancel_{orderId}`:**
1. Verify sender is admin
2. Find order
3. Set order status → `cancelled`
4. Edit message to confirm cancellation
5. Notify user: cancelled + code

---

## 13. Web Pages

### 13.1 Root Layout (`src/app/layout.tsx`)

```tsx
import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pepe Star - خرید گیفت و استار تلگرامی",
  description: "خرید گیفت‌ها و استارهای تلگرامی با قیمت مناسب - Pepe Star",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fa" dir="rtl">
      <body className="bg-slate-900 text-white antialiased">{children}</body>
    </html>
  );
}
```

### 13.2 Landing Page (`src/app/page.tsx`)

**Client component.** Dark gradient background (`from-slate-900 via-purple-900 to-slate-900`).

**Layout:**
- **Hero section** (centered, max-w-2xl):
  - Gift emoji 🎁 (text-8xl)
  - Title: "خرید گیفت و استار تلگرامی" (gradient text purple→pink)
  - Subtitle: "گیفت‌ها و استارهای تلگرامی رو با قیمت مناسب بخرید..."
  - Three buttons:
    - "🚀 شروع ربات" → `https://t.me/{botUsername}` (purple bg)
    - "🔐 پنل مدیریت" → `/admin` (white/10 bg)
    - "🛠️ راهنمای ست‌آپ" → `/setup` (white/10 bg)

- **Features section** (3-column grid, max-w-4xl):
  - 🔗 "ارسال لینک گیفت" — "لینک گیفت تلگرامی رو بفرستید و قیمت رو ببینید"
  - ⭐ "خرید استار" — "تعداد ستاره مورد نظرتون رو وارد کنید و سفارش بدید"
  - ✅ "تایید سریع" — "ادمین سفارش رو تایید میکنه و گیفت یا استار براتون ارسال میشه"

- **Footer:** "© Pepe Star — تمامی حقوق محفوظ است."

**Behavior:** On mount, fetch `/api/bot-info` to get bot username for the "شروع ربات" button link.

### 13.3 Admin Panel (`src/app/admin/page.tsx`)

**Client component.** Complex admin interface.

#### Login Screen
- Centered card with password input and "ورود" button
- On success: store token in `localStorage` as `admin_token`, set `isAuthed = true`
- On error: show error message

#### Header
- Title: "🎁 پنل مدیریت Pepe Star"
- Logout button (clears `localStorage` token)

#### Tabs
1. **⚙️ تنظیمات** — Settings form
2. **🔍 در انتظار تایید** — Orders with status `pending_approval`
3. **📂 سفارشات باز** — Orders with status `approved`
4. **📋 همه سفارشات** — All orders

#### Settings Tab
Form fields:
- 💳 شماره کارت (card number, `dir="ltr"`)
- 👤 نام صاحب کارت (card holder name)
- 💱 نرخ تبدیل (exchange rate, number input)
- **NEW — 📣 کانال گزارشات:**
  - آیدی عددی کانال (channel ID, `dir="ltr"`, placeholder: `-1001234567890`)
  - نام نمایشی کانال (channel display name, placeholder: `گزارشات خرید pepe star`)
  - Helper text: "ربات رو به‌عنوان ادمین با قابلیت ارسال پیام در کانال اضافه کنید"
- 💾 ذخیره تنظیمات button

#### Orders Tabs (all three)
- Search input: "🔍 جستجو با کد سفارش یا نام کاربر..."
- Loading state: "⏳ در حال بارگذاری..."
- Empty state: "📭 سفارشی یافت نشد."
- Order cards:
  - Code badge + status badge (colored)
  - Star count + price
  - User info (@username, first_name)
  - Date (Persian)
  - Receipt indicator (📸 رسید موجود)
  - Quick action buttons:
    - `pending_approval`: ✅ تایید, ❌ رد
    - `approved`: ✅ تکمیل, 🚫 لغو

#### Reject Modal
- Textarea for rejection reason
- "رد کردن" (red) + "انصراف" (gray) buttons

#### Detail Modal (click on order card)
- Full order details: code, user, ID, gift link, stars, price, status, reject reason, date
- Receipt photo (loaded via `/api/admin/photo/{fileId}`)
- Action buttons based on status:
  - `pending_approval`: ✅ تایید, ❌ رد
  - `approved`: ✅ تکمیل, 🚫 لغو
  - Always: بستن (close)

#### Order Interface
```ts
interface Order {
  id: number;
  code: string;
  userId: number;
  giftLink: string;
  giftName: string | null;
  type: string;        // "gift" or "star"
  starCount: number;
  priceToman: number;
  status: string;
  receiptFileId: string | null;
  rejectReason: string | null;
  createdAt: string;
  updatedAt: string;
  userTelegramId: number;
  userUsername: string | null;
  userFirstName: string | null;
}
```

#### Settings Interface
```ts
interface Settings {
  card_number: string;
  card_holder_name: string;
  exchange_rate: string;
  log_channel_id: string;     // NEW
  log_channel_name: string;   // NEW
}
```

#### Status Badges (colors)
```ts
const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  receipt_sent: "bg-blue-100 text-blue-800",
  pending_approval: "bg-orange-100 text-orange-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  in_progress: "bg-purple-100 text-purple-800",
  completed: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-gray-100 text-gray-800",
};
```

#### Auth Pattern
All API calls include: `{ "Authorization": "Bearer {token}" }` header. Token stored in `localStorage` as `admin_token`.

### 13.4 Setup Page (`src/app/setup/page.tsx`)

**Client component.** Five-step guide in Persian:

1. **ساخت ربات در تلگرام** — Instructions to create bot via @BotFather
2. **تنظیم متغیرهای محیطی** — How to edit `.env` file (shows env var explanations)
3. **ست کردن وب‌هوک** — Input for webhook URL + "🔗 ست وب‌هوک" button + "🔍 بررسی وضعیت وب‌هوک" button
4. **ست کردن منوی ربات** — Optional: set bot commands via BotFather (`start - شروع ربات`)
5. **ادمین‌ها** — List admin IDs with note about their capabilities

Links at bottom: صفحه اصلی → `/`, پنل مدیریت → `/admin`

---

## 14. Channel Log Feature (NEW)

### Purpose
When an admin marks an order as **completed**, a formatted log message is automatically sent to a configured Telegram channel. This serves as a public/semi-public record of completed sales.

### Setup Flow
1. Admin goes to `/admin` → Settings tab → "📣 کانال گزارشات" section
2. Enters the Telegram channel's numeric ID (e.g. `-1001234567890`)
3. Enters a display name (e.g. `گزارشات خرید pepe star`)
4. Adds the bot as an admin with "Post Messages" permission in the channel
5. Clicks "💾 ذخیره تنظیمات"
6. The channel info is saved to the `channels` table

### Log Message Format

When an order with `type: "gift"` is completed:
```
[{timestamp}] {channel_name}:

✅ #سفارش ( گیفت : {gift_name} ) تکمیل شد.

👤 ID : `{masked_telegram_id}`
👀 Count : `{star_count}`
⏳ Time : `{persian_date} - {time}`
💰 Price : `{formatted_price}`
```

When an order with `type: "star"` is completed:
```
[{timestamp}] {channel_name}:

✅ #سفارش ( 🌟 استارز تلگرام ) تکمیل شد.

👤 ID : `{masked_telegram_id}`
👀 Count : `{star_count}`
⏳ Time : `{persian_date} - {time}`
💰 Price : `{formatted_price}`
```

### Example Messages

**Gift order:**
```
[8/29/2026 10:05 PM] گزارشات خرید pepe star:

✅ #سفارش ( گیفت : 🧸 عروسک تدی ) تکمیل شد.

👤 ID : `7300******`
👀 Count : `1`
⏳ Time : `1405/06/07 - 22:05:29`
💰 Price : `62,000`
```

**Star order:**
```
[8/29/2026 10:06 PM] گزارشات خرید pepe star:

✅ #سفارش ( 🌟 استارز تلگرام ) تکمیل شد.

👤 ID : `9518****`
👀 Count : `150`
⏳ Time : `1405/06/07 - 22:06:06`
💰 Price : `652,500`
```

### Telegram ID Masking Logic
- If ID length > 8: show first 4 digits + `******` (e.g. `7300******`)
- If ID length <= 8: show first half + `****` (e.g. `9518****`)

### Date/Time Format
- Date in **Persian/Jalali calendar** (e.g. `1405/06/07`)
- Time in 24h format (e.g. `22:05:29`)
- Use a simple Jalali date converter function (no external library needed, implement manually)

### Price Format
- Use `toLocaleString("fa-IR")` for Persian number formatting with comma separators
- Example: `652500` → `652,500`

### Implementation in complete order action:
```ts
async function sendLogToChannel(order, user) {
  // Get channel settings from database
  const channelRows = await db.select().from(channels).where(eq(channels.is_active, 1));
  if (channelRows.length === 0) return;

  const channel = channelRows[0];
  const maskedId = maskTelegramId(user.telegramId);
  const persianDate = toPersianDate(new Date());
  const typeLabel = order.type === "star" ? "🌟 استارز تلگرام" : `گیفت : ${order.giftName || "نامشخص"}`;

  const message =
    `[${new Date().toLocaleDateString("en-US")} ${new Date().toLocaleTimeString("en-US")}] ${channel.channel_name}:\n\n` +
    `✅ #سفارش ( ${typeLabel} ) تکمیل شد.\n\n` +
    `👤 ID : \`${maskedId}\`\n` +
    `👀 Count : \`${order.starCount}\`\n` +
    `⏳ Time : \`${persianDate}\`\n` +
    `💰 Price : \`${formatPrice(order.priceToman)}\``;

  await sendMessage(channel.channel_id, message);
}
```

### Helper functions needed:
```ts
function maskTelegramId(id: number): string {
  const str = id.toString();
  if (str.length > 8) {
    return str.substring(0, 4) + "******";
  }
  return str.substring(0, Math.ceil(str.length / 2)) + "****";
}

function toPersianDate(date: Date): string {
  // Simple Jalali converter
  // Returns format: YYYY/MM/DD - HH:mm:ss
  // Implement using the standard Gregorian-to-Jalali algorithm
}
```

---

## 15. Complete Business Rules

1. **Exchange Rate:** Each star costs X Toman (configurable in admin panel, default 5000)
2. **Order Code:** 6 random characters from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (avoids ambiguous characters)
3. **Payment:** User transfers to bank card, sends receipt photo
4. **Approval:** Any admin can approve or reject orders
5. **Notifications:** ALL admins receive notifications for new orders
6. **Log Channel:** Only completed orders are posted to the log channel
7. **Brand Name:** Pepe Star (NOT "نامبروان" or any other name)
8. **Gift Link Formats:** `t.me/nft/{slug}`, `telegram.me/nft/{slug}`, `tg://nft?slug={slug}`
9. **Max Star Count:** 1,000,000 (for manual star orders)
10. **Token Eviction:** Admin auth tokens are evicted FIFO when count exceeds 100

---

## 16. Setup Scripts

### `SETUP.bat` (Windows batch)
1. Check Node.js is installed
2. Run `npm install`
3. Run `npx drizzle-kit push` (create SQLite tables)
4. Run `npm run dev`

**No Docker required.**

### `setup.ps1` (PowerShell)
1. Check/install Node.js (via winget or MSI download)
2. Run `npm install`
3. Run `npx drizzle-kit push`
4. Run `npm run dev`

**No Docker required.**

---

## 17. Additional Implementation Notes

### Persian/Jalali Date Converter
Implement a simple `toPersianDate(date: Date): string` function that converts Gregorian to Jalali. The standard algorithm:
1. Convert to Julian Day Number
2. Apply the Jalali calendar algorithm
3. Return formatted string: `YYYY/MM/DD - HH:mm:ss`

### Order Type Field
The `type` field in the `orders` table distinguishes between:
- `"gift"` — User sent a gift link (has `giftName` from Telegram API)
- `"star"` — User sent just a number (no gift link, `giftLink` = "سفارش دستی")

### Admin Action Flow (from both web panel and Telegram bot)
The same actions are available from:
1. **Telegram bot** — Inline buttons (approve/reject/complete/cancel)
2. **Web admin panel** — Quick action buttons + detail modal

Both paths update the database and send notifications identically.

### Database Persistence
Since `sql.js` runs in memory with file persistence:
- Data is saved to `./data/bot.db` on process exit (SIGINT, SIGTERM)
- During development with hot reload, data may be lost if the process is killed abruptly
- For production, consider switching to a server-based SQLite or adding periodic saves

### No External Dependencies for Date Conversion
Do NOT use `persian-date` or any npm package for Jalali dates. Implement the conversion algorithm directly in `src/lib/utils.ts`. The algorithm is well-documented and ~30 lines of code.

---

## 18. Testing Checklist

After building, verify:
- [ ] `/` loads with landing page, bot username fetched from API
- [ ] `/admin` shows login screen
- [ ] `/admin` login works with correct password
- [ ] Settings tab shows card number, card holder, exchange rate, channel config
- [ ] Settings can be saved and persist
- [ ] Orders list loads (empty initially)
- [ ] `/setup` shows 5-step guide
- [ ] Webhook can be set from setup page
- [ ] Bot responds to `/start`
- [ ] Gift link creates an order
- [ ] Number input creates a star order
- [ ] Receipt photo upload works
- [ ] Admin notifications arrive
- [ ] Approve/reject/complete/cancel work
- [ ] Log message sent to channel on order completion
- [ ] All Persian text renders RTL correctly
