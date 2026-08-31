// bot.mjs — Pepe Star Telegram Bot (polling mode, standalone)
import "dotenv/config";
import Database from "sql.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// ==================== Config ====================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const DB_DIR = path.join(__dirname, "data");
const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), "data", "bot.db");
const API = `https://api.telegram.org/bot${BOT_TOKEN}`;
const ADMIN_IDS = process.env.ADMIN_IDS
  ? process.env.ADMIN_IDS.split(",").map(s => parseInt(s.trim())).filter(n => !isNaN(n))
  : [7184299507, 5851497957];
const SEPARATOR = "━━━━━━━━━━━━━━━━━━━━━━";

if (!BOT_TOKEN) { console.error("❌ TELEGRAM_BOT_TOKEN is not set"); process.exit(1); }

// ==================== Database ====================
const SQL = await Database();
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
const db = new SQL.Database(fs.existsSync(DB_PATH) ? fs.readFileSync(DB_PATH) : new Uint8Array(0));

function saveDb() { const d = db.export(); fs.writeFileSync(DB_PATH, Buffer.from(d)); }
let saveTimer = null;
let autosaveEnabled = true;
function dbSaveSoon() {
  if (!autosaveEnabled) return;
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try { saveDb(); console.log("💾 ذخیره شد"); }
    catch (e) { console.error("خطای ذخیره:", e.message); }
  }, 1500);
}

function shutdown(code = 0) { try { saveDb(); } catch {} process.exit(code); }
process.on("exit", () => { try { saveDb(); } catch {} });
process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
process.on("uncaughtException", (e) => { console.error(e); shutdown(1); });
process.on("unhandledRejection", (e) => console.error("Rejection:", e));

// Lock file to prevent multiple instances
const LOCK_PATH = path.join(DB_DIR, "bot.lock");
function acquireLock() {
  try {
    if (fs.existsSync(LOCK_PATH)) {
      const oldPid = parseInt(fs.readFileSync(LOCK_PATH, "utf8"));
      let alive = false;
      if (Number.isInteger(oldPid) && oldPid !== process.pid) {
        try { process.kill(oldPid, 0); alive = true; }
        catch (e) { alive = e.code === "EPERM"; }
      }
      if (alive) {
        console.error(`⛔ نسخه دیگری از ربات (PID ${oldPid}) همین دیتابیس را باز دارد. اول آن را ببندید.`);
        process.exit(1);
      }
    }
    fs.writeFileSync(LOCK_PATH, String(process.pid));
  } catch {}
  process.on("exit", () => { try { if (fs.existsSync(LOCK_PATH)) fs.unlinkSync(LOCK_PATH); } catch {} });
}

function dbRun(sql) {
  db.run(sql);
  dbSaveSoon();
}
function dbGet(sql) { const s = db.prepare(sql); let r = null; if (s.step()) r = s.getAsObject(); s.free(); return r; }
function dbAll(sql) { const s = db.prepare(sql); const r = []; while (s.step()) r.push(s.getAsObject()); s.free(); return r; }

// Create tables
dbRun(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, telegram_id INTEGER UNIQUE NOT NULL, username TEXT, first_name TEXT, state TEXT DEFAULT 'idle' NOT NULL, pending_gift_link TEXT, pending_star_count INTEGER, admin_state TEXT, admin_state_data TEXT, created_at INTEGER DEFAULT (unixepoch()), updated_at INTEGER DEFAULT (unixepoch()))`);
dbRun(`CREATE TABLE IF NOT EXISTS orders (id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT UNIQUE NOT NULL, user_id INTEGER NOT NULL, gift_link TEXT NOT NULL, gift_name TEXT, type TEXT DEFAULT 'gift' NOT NULL, star_count INTEGER NOT NULL, price_toman INTEGER NOT NULL, status TEXT DEFAULT 'pending' NOT NULL, receipt_file_id TEXT, reject_reason TEXT, created_at INTEGER DEFAULT (unixepoch()), updated_at INTEGER DEFAULT (unixepoch()))`);
dbRun(`CREATE TABLE IF NOT EXISTS settings (id INTEGER PRIMARY KEY AUTOINCREMENT, key TEXT UNIQUE NOT NULL, value TEXT NOT NULL, updated_at INTEGER DEFAULT (unixepoch()))`);
dbRun(`CREATE TABLE IF NOT EXISTS channels (id INTEGER PRIMARY KEY AUTOINCREMENT, channel_id INTEGER UNIQUE NOT NULL, channel_name TEXT, is_active INTEGER DEFAULT 1, created_at INTEGER DEFAULT (unixepoch()))`);

dbRun(`CREATE TABLE IF NOT EXISTS img_channel (id INTEGER PRIMARY KEY AUTOINCREMENT, channel_id INTEGER UNIQUE NOT NULL, channel_name TEXT, created_at INTEGER DEFAULT (unixepoch()))`);
try { dbRun("SELECT channel_id FROM img_channel LIMIT 1"); } catch { /* table exists */ }

dbRun(`CREATE TABLE IF NOT EXISTS must_channels (id INTEGER PRIMARY KEY AUTOINCREMENT, channel_id INTEGER UNIQUE NOT NULL, channel_name TEXT, created_at INTEGER DEFAULT (unixepoch()))`);
try { dbRun("SELECT channel_id FROM must_channels LIMIT 1"); } catch { dbRun("ALTER TABLE must_channels ADD COLUMN channel_name TEXT"); }

dbRun(`CREATE TABLE IF NOT EXISTS gifts (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, emoji TEXT DEFAULT '🎁', star_count INTEGER NOT NULL, gift_id TEXT, description TEXT, image_file_id TEXT, is_active INTEGER DEFAULT 1, sort_order INTEGER DEFAULT 0, created_at INTEGER DEFAULT (unixepoch()))`);

// Add missing columns if they don't exist
try { dbRun("SELECT gift_id FROM gifts LIMIT 1"); } catch { dbRun("ALTER TABLE gifts ADD COLUMN gift_id TEXT"); }
try { dbRun("SELECT description FROM gifts LIMIT 1"); } catch { dbRun("ALTER TABLE gifts ADD COLUMN description TEXT"); }
try { dbRun("SELECT image_file_id FROM gifts LIMIT 1"); } catch { dbRun("ALTER TABLE gifts ADD COLUMN image_file_id TEXT"); }

// Seed default gifts if empty
const giftCount = dbGet("SELECT COUNT(*) as c FROM gifts")?.c || 0;
if (giftCount === 0) {
  const defaultGifts = [
    { name: "گیفت طلـی", emoji: "💝", star_count: 10 },
    { name: "عروسک تدی", emoji: "🧸", star_count: 10 },
    { name: "گیفت جعبه کادو", emoji: "🎁", star_count: 15 },
    { name: "گیفت گل رز", emoji: "🌹", star_count: 15 },
    { name: "گیفت کیک تولد", emoji: "🎂", star_count: 25 },
    { name: "گیفت دسته گل", emoji: "💐", star_count: 25 },
    { name: "گیفت بطری نوشیدنی", emoji: "🥂", star_count: 25 },
    { name: "گیفت سفینه فضایی", emoji: "🚀", star_count: 25 },
    { name: "گیفت جام", emoji: "🏆", star_count: 50 },
    { name: "گیفت حلقه ازدواج", emoji: "💍", star_count: 50 },
    { name: "گیفت الماس", emoji: "💎", star_count: 50 },
  ];
  for (let i = 0; i < defaultGifts.length; i++) {
    const g = defaultGifts[i];
    dbRun(`INSERT INTO gifts (name, emoji, star_count, sort_order) VALUES ('${g.name.replace(/'/g, "''")}', '${g.emoji}', ${g.star_count}, ${i})`);
  }
  console.log("🎁 Default gifts added to database");
}

// ==================== Helpers ====================
function genCode() { const c = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; let r = ""; for (let i = 0; i < 6; i++) r += c[Math.floor(Math.random() * c.length)]; return r; }
function fmtPrice(p) { return p.toLocaleString("fa-IR"); }
function isAdmin(id) { return ADMIN_IDS.includes(id); }
function parseGiftLink(t) { for (const p of [/t\.me\/nft\/([^\s?]+)/, /telegram\.me\/nft\/([^\s?]+)/, /tg:\/\/nft\?slug=([^\s&]+)/]) { const m = t.match(p); if (m) return m[1]; } return null; }
function maskId(id) { const s = id.toString(); return s.length > 8 ? s.substring(0, 4) + "******" : s.substring(0, Math.ceil(s.length / 2)) + "****"; }
function parseNum(s) { return parseInt(String(s).replace(/[^\d]/g, "")); }
function typeIcon(type) { return type === "star" ? "⭐" : type === "member" ? "👤" : "🎁"; }
function typeLabel(type, name) { return type === "star" ? "⭐ استار" : type === "member" ? "👤 ممبر بدون ریزش" : `🎁 گیفت${name ? " " + name : ""}`; }
function countLabel(type) { return type === "member" ? "👥 تعداد ممبر" : "⭐ تعداد ستاره"; }
function orderTarget(o) { return o.type === "member" ? o.gift_link : o.gift_name || o.gift_link; }

// ---- UX Fix helpers ----
function esc(s) { return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
function extractEmoji(text) {
  const chars = Array.from(text ?? "");
  const RE = /(\p{Extended_Pictographic}(️|‍\p{Extended_Pictographic})*)/u;
  for (const ch of chars) {
    if (RE.test(ch)) return ch;
  }
  return null;
}
function normalizeDigits(s) {
  return String(s)
    .replace(/[۰-۹]/g, ch => "۰۱۲۳۴۵۶۷۸۹".indexOf(ch))
    .replace(/[٠-٩]/g, ch => "٠١٢٣٤٥٦٧٨٩".indexOf(ch));
}
function resetUserState(userId) {
  dbRun(`UPDATE users SET state='idle', pending_gift_link=NULL, updated_at=unixepoch() WHERE id=${userId}`);
}
function cancelStalePending(userId) {
  dbRun(`UPDATE orders SET status='cancelled', updated_at=unixepoch() WHERE user_id=${userId} AND status='pending'`);
}
function mainMenuKb() { return { reply_markup: { inline_keyboard: [
  btnRow(BTN.success("🎁  خرید گیفت تلگرام", "menu_gift")),
  btnRow(BTN.success("⭐️  خرید استار تلگرام", "menu_star")),
  btnRow(BTN.success("👤  خرید ممبر", "menu_member")),
  btnRow(BTN.primary("📦  سفارش‌های من", "menu_orders")),
  btnRow(BTN.primary("💬  پشتیبانی", "menu_support")),
]}}; }

function genFakeId() {
  const len = 8 + Math.floor(Math.random() * 2);
  let s = String(Math.floor(Math.random() * 9) + 1);
  for (let i = 1; i < len; i++) s += Math.floor(Math.random() * 10);
  return parseInt(s);
}

async function sendFakeReport(chatId, { fakeId, typeLabel, count, price }) {
  const ch = dbGet("SELECT * FROM channels WHERE is_active=1");
  if (!ch) { await send(chatId, "❌ <b>کانال گزارشات تنظیم نشده.</b>\nاول از تنظیمات ← «کانال گزارش» ثبتش کنید."); return false; }
  const code = genCode();
  const logMsg =
    `✅ <b>#سفارش تکمیل شد</b>\n` +
    `${SEPARATOR}\n\n` +
    `📦 <b>نوع:</b> ${typeLabel}\n` +
    `🔑 <b>کد:</b> <code>${code}</code>\n` +
    `👤 <b>آیدی:</b> <code>${maskId(fakeId)}</code>\n` +
    `👀 <b>تعداد:</b> <code>${count}</code>\n` +
    `💰 <b>مبلغ:</b> <code>${Number(price).toLocaleString("en-US")}</code> تومان\n` +
    `⏳ <b>زمان:</b> ${toJalali(new Date())}`;
  const r = await send(ch.channel_id, logMsg);
  if (!r.ok) { await send(chatId, `❌ <b>ارسال به کانال ناموفق:</b>\n${esc(r.description || "")}`); return false; }
  return true;
}

// جزئیات کامل سفارش — برای پنل ادمین و جستجو
async function renderOrderDetail(chatId, oId, msgId = null, fromStatus = null) {
  const o = dbGet(`SELECT * FROM orders WHERE id=${parseInt(oId)}`);
  if (!o) {
    const t = "❌ <b>سفارش یافت نشد.</b>";
    if (msgId) await edit(chatId, msgId, t); else await send(chatId, t);
    return;
  }
  const u = dbGet(`SELECT * FROM users WHERE id=${o.user_id}`);
  const SL = { pending_approval: "⏳ در انتظار تایید", approved: "✔️ تایید شده", completed: "✅ تکمیل شده", cancelled: "⚫ لغو شده" };
  const TL = { gift: "🎁 گیفت تلگرام", star: "⭐ استار تلگرام", member: "👤 ممبر" };
  const d = new Date((o.created_at || 0) * 1000);
  const du = new Date((o.updated_at || o.created_at || 0) * 1000);
  const tm = (x) => x ? `${x.toLocaleDateString("fa-IR")} - ${String(x.getHours()).padStart(2, "0")}:${String(x.getMinutes()).padStart(2, "0")}` : "—";

  let text =
    `🔍 <b>جزئیات سفارش</b>\n${SEPARATOR}\n\n` +
    `🔑 <b>کد:</b> <code>${o.code}</code>\n` +
    `📊 <b>وضعیت:</b> ${SL[o.status] || o.status}\n` +
    `📦 <b>نوع:</b> ${TL[o.type] || o.type || "—"}\n` +
    `⭐ <b>تعداد:</b> ${o.star_count ?? "—"}\n` +
    `💰 <b>مبلغ:</b> ${fmtPrice(o.price_toman)} تومان\n`;
  if (o.gift_link && o.gift_link !== "سفارش دستی")
    text += `🔗 <b>هدف/لینک:</b> ${esc(o.gift_link)}\n`;
  text +=
    `\n${SEPARATOR}\n\n` +
    `👤 <b>خریدار:</b> ${u?.username ? "@" + esc(u.username) : "بدون یوزرنیم"}\n` +
    `🆔 <b>تلگرام:</b> <code>${u?.telegram_id ?? "?"}</code>\n` +
    `📅 <b>ثبت:</b> ${tm(d)}\n` +
    `🕓 <b>آخرین تغییر:</b> ${tm(du)}\n\n${SEPARATOR}\n`;

  const rows = [];
  if (o.status === "pending_approval")
    rows.push(btnRow(BTN.success("✅ تایید", `approve_${o.id}`), BTN.danger("❌ رد", `rejectq_${o.id}`)));
  else if (o.status === "approved")
    rows.push(btnRow(BTN.success("✅ تکمیل", `complete_${o.id}`), BTN.danger("🚫 لغو", `cancel_${o.id}`)));
  else if (o.status === "cancelled")
    rows.push(btnRow(BTN.primary("♻️ بازگردانی به «تایید شده»", `restore_${o.id}`)));
  rows.push([BTN.neutral("🔙 بازگشت", fromStatus ? `adm_page_${fromStatus}_0` : "admin_back")]);

  const kb = { reply_markup: { inline_keyboard: rows } };
  if (msgId) await editSmart(chatId, msgId, text, kb);
  else await send(chatId, text, kb);
}

// ==================== Button Color System (native Telegram style) ====================
const BTN = {
  // style: "danger" — red background
  danger: (label, data) => ({ text: label, callback_data: data, style: "danger" }),
  // style: "success" — green background
  success: (label, data) => ({ text: label, callback_data: data, style: "success" }),
  // style: "primary" — blue background
  primary: (label, data) => ({ text: label, callback_data: data, style: "primary" }),
  // no style — default/neutral
  neutral: (label, data) => ({ text: label, callback_data: data }),
  // alias
  info: (label, data) => ({ text: label, callback_data: data }),
};
function btnRow(...buttons) { return buttons; }
function toJalali(date) {
  const gy = date.getFullYear(), gm = date.getMonth() + 1, gd = date.getDate();
  const g = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  let gy2 = gm > 2 ? gy + 1 : gy, days = 355666 + 365 * gy + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100) + Math.floor((gy2 + 399) / 400) + gd + g[gm - 1];
  let jy = -1595 + 33 * Math.floor(days / 12053); days %= 12053; jy += 4 * Math.floor(days / 1461); days %= 1461;
  if (days > 365) { jy += Math.floor((days - 1) / 365); days = (days - 1) % 365; }
  let jm, jd;
  if (days < 186) { jm = 1 + Math.floor(days / 31); jd = 1 + (days % 31); } else { jm = 7 + Math.floor((days - 186) / 30); jd = 1 + ((days - 186) % 30); }
  const pad = n => n.toString().padStart(2, "0");
  return `${jy}/${pad(jm)}/${pad(jd)} - ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}
const DEFAULT_SETTINGS = {
  card_number: "0000-0000-0000-0000",
  card_holder_name: "نام صاحب کارت",
  exchange_rate: "5000",
  member_price: "21000",
  support_username: "samimige16",
  bot_name: "Pepe Star",
};
function getSetting(key) { const r = dbGet(`SELECT value FROM settings WHERE key='${key}'`); return r ? r.value : (DEFAULT_SETTINGS[key] ?? ""); }
function getNumSetting(key) { const v = parseInt(getSetting(key)); return !isNaN(v) && v > 0 ? v : parseInt(DEFAULT_SETTINGS[key]); }
function setSetting(key, value) {
  const v = String(value).replace(/'/g, "''");
  const existing = dbGet(`SELECT * FROM settings WHERE key='${key}'`);
  if (existing) dbRun(`UPDATE settings SET value='${v}', updated_at=unixepoch() WHERE key='${key}'`);
  else dbRun(`INSERT INTO settings (key, value) VALUES ('${key}', '${v}')`);
}
const BOT_NAME = getSetting("bot_name") || "Pepe Star";
function ensureUser(tgId, username, firstName) {
  let u = dbGet(`SELECT * FROM users WHERE telegram_id=${tgId}`);
  if (u) { dbRun(`UPDATE users SET username='${(username || u.username || "").replace(/'/g, "''")}', first_name='${(firstName || u.first_name || "").replace(/'/g, "''")}', updated_at=unixepoch() WHERE id=${u.id}`); return dbGet(`SELECT * FROM users WHERE id=${u.id}`); }
  dbRun(`INSERT INTO users (telegram_id, username, first_name) VALUES (${tgId}, '${(username || "").replace(/'/g, "''")}', '${(firstName || "").replace(/'/g, "''")}')`);
  return dbGet(`SELECT * FROM users WHERE telegram_id=${tgId}`);
}

// ==================== Telegram API ====================
async function api(method, body) { try { const r = await fetch(`${API}/${method}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined }); return await r.json(); } catch (e) { return { ok: false }; } }
async function send(chatId, text, extra) { return api("sendMessage", { chat_id: chatId, text, parse_mode: "HTML", ...extra }); }
async function sendPhoto(chatId, photo, caption, extra) { return api("sendPhoto", { chat_id: chatId, photo, caption, parse_mode: "HTML", ...extra }); }
async function edit(chatId, msgId, text, extra) { return api("editMessageText", { chat_id: chatId, message_id: msgId, text, parse_mode: "HTML", ...extra }); }
async function editCaption(chatId, msgId, caption, extra) { return api("editMessageCaption", { chat_id: chatId, message_id: msgId, caption, parse_mode: "HTML", ...extra }); }
async function editSmart(chatId, msgId, text, extra) { const r = await edit(chatId, msgId, text, extra); if (!r.ok) return editCaption(chatId, msgId, text, extra); return r; }
async function editKb(chatId, msgId, kb) { return api("editMessageReplyMarkup", { chat_id: chatId, message_id: msgId, reply_markup: kb }); }
async function deleteMsg(chatId, msgId) { return api("deleteMessage", { chat_id: chatId, message_id: msgId }); }
async function answer(id, text, alert) { return api("answerCallbackQuery", { callback_query_id: id, text, show_alert: alert }); }


const STATUS_ICON = { pending: "🟡", receipt_sent: "🔵", pending_approval: "🟠", approved: "🟢", rejected: "🔴", completed: "✅", cancelled: "⚫" };
const STATUS_FA = { pending: "در انتظار رسید", receipt_sent: "رسید ارسال شده", pending_approval: "در انتظار تایید", approved: "تایید شده", rejected: "رد شده", completed: "تکمیل شده", cancelled: "لغو شده" };

// ==================== Auto Cleanup ====================
function cleanupOldOrders() {
  const tenDaysAgo = Math.floor(Date.now() / 1000) - (10 * 24 * 60 * 60);
  dbRun(`DELETE FROM orders WHERE status = 'cancelled' AND updated_at < ${tenDaysAgo}`);
  dbRun(`DELETE FROM orders WHERE status = 'completed'`);
}

// Run cleanup on start
cleanupOldOrders();
setInterval(cleanupOldOrders, 6 * 60 * 60 * 1000); // every 6 hours

// ==================== Admin Panel ====================
function settingsPanelKb() {
  return { reply_markup: { inline_keyboard: [
    [BTN.primary("💳 تغییر شماره کارت", "set_edit_card")],
    [BTN.primary("💱 تغییر نرخ تبدیل", "set_edit_rate")],
    [BTN.primary("👤 تغییر قیمت ممبر", "set_edit_member")],
    [BTN.primary("💬 تغییر پشتیبان", "set_edit_support")],
    [BTN.primary("📣 تغییر کانال گزارش", "set_edit_log")],
    [BTN.primary("🖼️ تغییر کانال عکس", "set_edit_img")],
    [BTN.primary("📢 مدیریت کانال‌های الزامی", "set_edit_must")],
    [BTN.neutral("🔄 بروزرسانی", "admin_settings")],
    [BTN.neutral("🔙 بازگشت", "admin_back")],
  ]}};
}
function settingsPanelText() {
  const cn = getSetting("card_number"), ch = getSetting("card_holder_name");
  const channel = dbGet("SELECT * FROM channels WHERE is_active=1");
  const imgChannel = dbGet("SELECT * FROM img_channel LIMIT 1");
  const mustChannels = dbAll("SELECT * FROM must_channels ORDER BY id ASC");
  const sup = (getSetting("support_username") || DEFAULT_SETTINGS.support_username).replace(/^@/, "");
  return (
    `⚙️ <b>تنظیمات فعلی</b>\n${SEPARATOR}\n\n` +
    `💳 <b>شماره کارت:</b>  <code>${cn}</code>\n` +
    `👤 <b>صاحب کارت:</b>  ${ch}\n` +
    `💱 <b>نرخ تبدیل:</b>  <code>${fmtPrice(getNumSetting("exchange_rate"))}</code> تومان/ستاره\n` +
    `👤 <b>قیمت ممبر (هر ۱۰۰):</b>  <code>${fmtPrice(getNumSetting("member_price"))}</code> تومان\n` +
    `💬 <b>پشتیبانی:</b>  @${sup}\n\n` +
    `📣 <b>کانال گزارشات:</b>  ${channel ? `<code>${channel.channel_id}</code> (${channel.channel_name || "-"})` : "❌ تنظیم نشده"}\n` +
    `🖼️ <b>کانال عکس گیفت‌ها:</b>  ${imgChannel ? `<code>${imgChannel.channel_id}</code> (${imgChannel.channel_name || "-"})` : "❌ تنظیم نشده"}\n` +
    `📢 <b>کانال‌های الزامی:</b>  ${mustChannels.length ? mustChannels.map(c => c.channel_name || c.channel_id).join(", ") : "❌ تنظیم نشده"}\n\n` +
    `${SEPARATOR}\nروی دکمه مورد نظر بزنید:`
  );
}

async function adminMenu(chatId) {
  const p = dbGet("SELECT COUNT(*) as c FROM orders WHERE status='pending_approval'")?.c || 0;
  const a = dbGet("SELECT COUNT(*) as c FROM orders WHERE status='approved'")?.c || 0;
  const t = dbGet("SELECT COUNT(*) as c FROM orders")?.c || 0;
  const co = dbGet("SELECT COUNT(*) as c FROM orders WHERE status='completed'")?.c || 0;
  const cn = dbGet("SELECT COUNT(*) as c FROM orders WHERE status='cancelled'")?.c || 0;
  const users = dbGet("SELECT COUNT(*) as c FROM users")?.c || 0;
  const gifts = dbGet("SELECT COUNT(*) as c FROM gifts WHERE is_active=1")?.c || 0;
  await send(chatId,
    `💫 <b>══════════════════════</b>\n` +
    `✨ <b>  ${BOT_NAME}  Panel  </b> ✨\n` +
    `💫 <b>══════════════════════</b>\n\n` +
    `📊 <b>آمار کلی</b>\n` +
    `${SEPARATOR}\n` +
    `🟠 <b>در انتظار تایید:</b>  <code>${p}</code>\n` +
    `🟢 <b>تایید شده:</b>       <code>${a}</code>\n` +
    `✅ <b>تکمیل شده:</b>       <code>${co}</code>\n` +
    `📋 <b>کل سفارشات:</b>     <code>${t}</code>\n` +
    `👥 <b>کل کاربران:</b>      <code>${users}</code>\n` +
    `🎁 <b>گیفت فعال:</b>       <code>${gifts}</code>\n` +
    `${SEPARATOR}\n\n` +
    `یکی از گزینه‌ها رو انتخاب کنید:`,
    { reply_markup: { inline_keyboard: [
      btnRow(BTN.danger(`🔍 در انتظار تایید  [${p}]`, "admin_pending")),
      btnRow(BTN.success(`🟢 تایید شده  [${a}]`, "admin_approved")),
      btnRow(BTN.success(`✅ تکمیل شده  [${co}]`, "admin_completed")),
      btnRow(BTN.primary(`📋 همه سفارشات  [${t}]`, "admin_all")),
      btnRow(BTN.neutral(`🚫 لغو شده  [${cn}]`, "admin_cancelled")),
      btnRow(BTN.primary(`📦 تکمیل سفارشات  [${a}]`, "admin_complete_list")),
      btnRow(BTN.primary("🎁 مدیریت گیفت‌ها", "admin_gifts")),
      btnRow(BTN.primary("⚙️ تنظیمات", "admin_settings")),
      btnRow(BTN.primary("📢 ارسال پیام همگانی", "admin_broadcast")),
      btnRow(BTN.info("📋 گزارش فیک", "admin_fake_report")),
      btnRow(BTN.primary("🔎 جستجوی سفارش", "admin_search")),
      btnRow(BTN.danger("⚠️ Danger Zone", "admin_danger")),
    ]}}
  );
}

async function showOrders(chatId, status, page = 0) {
  const ps = 5;
  const rows = status === "all" ? dbAll("SELECT * FROM orders ORDER BY id DESC") : dbAll(`SELECT * FROM orders WHERE status='${status}' ORDER BY id DESC`);
  const total = rows.length, pages = Math.ceil(total / ps);
  const pageRows = rows.slice(page * ps, (page + 1) * ps);
  if (!pageRows.length) { await send(chatId, "📭 <b>سفارشی یافت نشد.</b>", { reply_markup: { inline_keyboard: [[BTN.neutral("🔙 بازگشت", "admin_back")]] } }); return; }

  const statusTitle = { pending_approval: "در انتظار تایید", approved: "تایید شده", all: "همه سفارشات" };
  let text = `📋 <b>سفارشات ${statusTitle[status] || status}</b>\n${SEPARATOR}\n\n`;
  const nav = [];

  for (const o of pageRows) {
    const u = dbGet(`SELECT * FROM users WHERE id=${o.user_id}`);
    const icon = STATUS_ICON[o.status] || "❓";
    const tIcon = typeIcon(o.type);
    const d = new Date(o.created_at * 1000);
    const time = `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
    text += `${icon} <b><code>${o.code}</code></b>  ${tIcon}\n`;
    text += `   👤 <code>@${u?.username || "ندارد"}</code>\n`;
    text += `   ${countLabel(o.type)}: <code>${o.star_count}</code>  •  💰 <code>${fmtPrice(o.price_toman)}</code> تومان\n`;
    text += `   📅 ${d.toLocaleDateString("fa-IR")}  🕐 ${time}\n\n`;
    // Add detail button for all orders
    nav.push(btnRow(BTN.neutral(`👁 جزئیات ${o.code}`, `admin_order_${o.id}_${status}`)));
    // Add quick actions for approved orders
    if (o.status === "approved") {
      nav.push(btnRow(BTN.success(`✅ تکمیل ${o.code}`, `complete_${o.id}`), BTN.danger(`🚫 لغو ${o.code}`, `cancel_${o.id}`)));
    }
  }

  if (pages > 1) { const r = []; if (page > 0) r.push({ text: "◀️", callback_data: `admin_page_${status}_${page - 1}` }); r.push({ text: `📄 ${page + 1}/${pages}`, callback_data: "noop" }); if (page < pages - 1) r.push({ text: "▶️", callback_data: `admin_page_${status}_${page + 1}` }); nav.push(r); }
  nav.push(btnRow(BTN.neutral("🔙 بازگشت", "admin_back")));
  await send(chatId, text, { reply_markup: { inline_keyboard: nav } });
}

async function orderDetail(chatId, orderId) {
  const o = dbGet(`SELECT * FROM orders WHERE id=${orderId}`);
  if (!o) { await send(chatId, "❌ سفارش یافت نشد."); return; }
  const u = dbGet(`SELECT * FROM users WHERE id=${o.user_id}`);
  const tLabel = typeLabel(o.type, o.gift_name);
  const icon = STATUS_ICON[o.status] || "❓";
  let text =
    `💫 <b>══════════════════════</b>\n` +
    `📋 <b>  جزئیات سفارش  </b>\n` +
    `💫 <b>══════════════════════</b>\n\n` +
    `${icon} <b>وضعیت:</b> ${STATUS_FA[o.status] || o.status}\n` +
    `${SEPARATOR}\n` +
    `🔑 <b>کد سفارش:</b>  <code>${o.code}</code>\n` +
    `📦 <b>نوع:</b>  ${tLabel}\n` +
    `${countLabel(o.type)}:  <code>${o.star_count}</code>\n` +
    `💰 <b>قیمت:</b>  <code>${fmtPrice(o.price_toman)}</code> تومان\n` +
    `${SEPARATOR}\n` +
    `👤 <b>کاربر:</b>  @${u?.username || "ندارد"} (${u?.first_name || "-"})\n` +
    `🆔 <b>آیدی تلگرام:</b>  <code>${u?.telegram_id || "-"}</code>\n` +
    `📅 <b>تاریخ ثبت:</b>  ${new Date(o.created_at * 1000).toLocaleDateString("fa-IR")}  🕐 ${new Date(o.created_at * 1000).getHours().toString().padStart(2, "0")}:${new Date(o.created_at * 1000).getMinutes().toString().padStart(2, "0")}\n`;
  if (o.gift_link && o.gift_link !== "سفارش دستی") text += `🔗 <b>هدف:</b>  ${o.gift_link}\n`;
  if (o.reject_reason) text += `\n📝 <b>دلیل رد:</b>  ${o.reject_reason}\n`;

  const btns = [];
  if (o.status === "pending_approval") btns.push([BTN.success("✅ تایید سفارش", `approve_${o.id}`)]);
  if (o.status === "approved") btns.push([BTN.success("✅ تکمیل سفارش", `complete_${o.id}`), BTN.danger("🚫 لغو", `cancel_${o.id}`)]);
  if (o.status === "pending" || o.status === "receipt_sent") btns.push([BTN.danger("🚫 لغو", `cancel_${o.id}`)]);
  btns.push([BTN.neutral("🔙 بازگشت", "admin_back")]);

  if (o.receipt_file_id) await sendPhoto(chatId, o.receipt_file_id, text, { reply_markup: { inline_keyboard: btns } });
  else await send(chatId, text, { reply_markup: { inline_keyboard: btns } });
}

// ==================== Gift List Helper ====================
async function showGiftList(chatId, msgId, page = 0) {
  const gifts = dbAll("SELECT * FROM gifts WHERE is_active=1 ORDER BY sort_order ASC");
  if (!gifts.length) {
    const kb = { reply_markup: { inline_keyboard: [[BTN.neutral("🔙 بازگشت به منو", "menu_back")]] } };
    const r = await edit(chatId, msgId,
      `🎁 <b>خرید گیفت تلگرام</b>\n${SEPARATOR}\n\n` +
      `📭 <b>هنوز گیفتی اضافه نشده.</b>\n\n` +
      `لطفاً بعداً دوباره بررسی کنید.`, kb
    );
    if (!r.ok) await editCaption(chatId, msgId,
      `🎁 <b>خرید گیفت تلگرام</b>\n${SEPARATOR}\n\n` +
      `📭 <b>هنوز گیفتی اضافه نشده.</b>\n\n` +
      `لطفاً بعداً دوباره بررسی کنید.`, kb
    );
    return;
  }
  const rate = getNumSetting("exchange_rate");
  const perPage = 15;
  const totalPages = Math.ceil(gifts.length / perPage);
  const pageGifts = gifts.slice(page * perPage, (page + 1) * perPage);
  const buttons = [];
  for (const g of pageGifts) {
    const price = g.star_count * rate;
    buttons.push([{ text: `${g.emoji}  ${g.name} — ${fmtPrice(price)} ت`, callback_data: `gift_select_${g.id}` }]);
  }
  if (totalPages > 1) {
    const nav = [];
    if (page > 0) nav.push({ text: "◀️", callback_data: `gift_page_${page - 1}` });
    nav.push({ text: `📄 ${page + 1}/${totalPages}`, callback_data: "noop" });
    if (page < totalPages - 1) nav.push({ text: "▶️", callback_data: `gift_page_${page + 1}` });
    buttons.push(nav);
  }
  buttons.push([BTN.neutral("🔙 بازگشت به منو", "menu_back")]);
  const listText =
    `🎁 <b>خرید گیفت تلگرام</b>\n${SEPARATOR}\n\n` +
    `یکی از گیفت‌های زیر رو انتخاب کنید:\n` +
    `📊 <b>${gifts.length}</b> گیفت فعال`;
  const kb = { reply_markup: { inline_keyboard: buttons } };
  // Try editMessageText first, then editMessageCaption for photo messages
  const r = await edit(chatId, msgId, listText, kb);
  if (!r.ok) await editCaption(chatId, msgId, listText, kb);
}

// Send gift list as a new message (used after deleting photo messages)
async function showGiftListNew(chatId, page = 0) {
  const gifts = dbAll("SELECT * FROM gifts WHERE is_active=1 ORDER BY sort_order ASC");
  if (!gifts.length) {
    await send(chatId,
      `🎁 <b>خرید گیفت تلگرام</b>\n${SEPARATOR}\n\n` +
      `📭 <b>هنوز گیفتی اضافه نشده.</b>\n\n` +
      `لطفاً بعداً دوباره بررسی کنید.`,
      { reply_markup: { inline_keyboard: [[BTN.neutral("🔙 بازگشت به منو", "menu_back")]] } }
    );
    return;
  }
  const rate = getNumSetting("exchange_rate");
  const perPage = 15;
  const totalPages = Math.ceil(gifts.length / perPage);
  const pageGifts = gifts.slice(page * perPage, (page + 1) * perPage);
  const buttons = [];
  for (const g of pageGifts) {
    const price = g.star_count * rate;
    buttons.push([{ text: `${g.emoji}  ${g.name} — ${fmtPrice(price)} ت`, callback_data: `gift_select_${g.id}` }]);
  }
  if (totalPages > 1) {
    const nav = [];
    if (page > 0) nav.push({ text: "◀️", callback_data: `gift_page_${page - 1}` });
    nav.push({ text: `📄 ${page + 1}/${totalPages}`, callback_data: "noop" });
    if (page < totalPages - 1) nav.push({ text: "▶️", callback_data: `gift_page_${page + 1}` });
    buttons.push(nav);
  }
  buttons.push([BTN.neutral("🔙 بازگشت به منو", "menu_back")]);
  await send(chatId,
    `🎁 <b>خرید گیفت تلگرام</b>\n${SEPARATOR}\n\n` +
    `یکی از گیفت‌های زیر رو انتخاب کنید:\n` +
    `📊 <b>${gifts.length}</b> گیفت فعال`,
    { reply_markup: { inline_keyboard: buttons } }
  );
}

// ==================== Main Menu ====================
async function showMainMenu(chatId, tgId) {
  await send(chatId,
    `✨ <b>${BOT_NAME} Bot</b> ✨\n` +
    `🎁 خرید گیفت و استار تلگرام\n` +
    `${SEPARATOR}\n` +
    `🌟 از منوی زیر، سرویس موردنظرت رو انتخاب کن:\n` +
    `${SEPARATOR}\n` +
    `⚡️ سریع • امن • آسان`,
    { reply_markup: { inline_keyboard: [
      btnRow(BTN.success("🎁  خرید گیفت تلگرام", "menu_gift")),
      btnRow(BTN.success("⭐️  خرید استار تلگرام", "menu_star")),
      btnRow(BTN.success("👤  خرید ممبر", "menu_member")),
      btnRow(BTN.primary("📦  سفارش‌های من", "menu_orders")),
      btnRow(BTN.primary("💬  پشتیبانی", "menu_support")),
    ]}}
  );
}

// ==================== Message Handler ====================
async function handleMessage(msg) {
  // Handle channel posts (for gift images)
  if (msg.chat.type === "channel" || msg.sender_chat) {
    const imgChannel = dbGet("SELECT * FROM img_channel LIMIT 1");
    if (imgChannel && msg.chat.id === imgChannel.channel_id && msg.photo && msg.caption) {
      const captionNum = msg.caption.trim();
      if (/^\d+$/.test(captionNum)) {
        const fileId = msg.photo[msg.photo.length - 1].file_id;
        if (!globalThis.giftImageCache) globalThis.giftImageCache = {};
        globalThis.giftImageCache[captionNum] = fileId;
        console.log(`📸 Gift image cached: caption=${captionNum}, file_id=${fileId.substring(0, 20)}...`);
      }
    }
    return;
  }

  // Only process private messages
  if (msg.chat.type !== "private") return;
  // Ignore service messages
  if (!msg.from || (!msg.text && !msg.photo && !msg.document)) return;

  const chatId = msg.chat.id, tgId = msg.from.id, text = msg.text || "";
  const username = msg.from.username, firstName = msg.from.first_name || "کاربر";
  const user = ensureUser(tgId, username, firstName);
  const freshUser = dbGet(`SELECT * FROM users WHERE id=${user.id}`) || user;

  // Admin commands
  if (text === "/admin" || text === "/panel") { if (!isAdmin(tgId)) return send(chatId, "❌ <b>شما دسترسی ادمین ندارید.</b>"); await adminMenu(chatId); return; }
  if (text === "/pending") { if (!isAdmin(tgId)) return send(chatId, "❌ شما ادمین نیستید."); await showOrders(chatId, "pending_approval"); return; }
  if (text === "/orders") { if (!isAdmin(tgId)) return send(chatId, "❌ شما ادمین نیستید."); await showOrders(chatId, "all"); return; }

  // === تشخیص کانال ===
  if (text === "/chaninfo") {
    if (!isAdmin(tgId)) return send(chatId, "❌ شما ادمین نیستید.");
    const ch = getSetting("channel");
    if (!ch) return send(chatId, "❌ کانال گزارشات تنظیم نشده.");
    try {
      const c = await api("getChat", { chat_id: ch });
      await send(chatId, `✅ <b>کانال فعال بات:</b> <code>${ch}</code>\n📛 <b>عنوان:</b> ${c.result.title}`);
    } catch (e) {
      await send(chatId, `❌ <b>بات به این کانال دسترسی ندارد:</b>\n<code>${e.description || e.message || "خطای ناشناخته"}</code>`);
    }
    return;
  }

  if (text === "/chkeys") {
    if (!isAdmin(tgId)) return send(chatId, "❌ شما ادمین نیستید.");
    const res = db.exec(`SELECT key, value FROM settings WHERE key LIKE '%chan%' OR key LIKE '%channel%' OR key LIKE '%کانال%'`);
    const rows = res[0]?.values ?? [];
    await send(chatId, rows.length
      ? "🔑 کلیدهای کانال:\n" + rows.map(r => `${r[0]} = ${r[1]}`).join("\n")
      : "هیچ کلیدی با نام کانال پیدا نشد");
    return;
  }

  if (text.startsWith("/chtest")) {
    if (!isAdmin(tgId)) return send(chatId, "❌ شما ادمین نیستید.");
    const num = parseInt(text.split(/\s+/)[1]);
    const ch = getSetting("channel");
    if (!num) return send(chatId, "فرمت: /chtest 15");
    try {
      await api("copyMessage", { chat_id: tgId, from_chat_id: ch, message_id: num });
      await send(chatId, `✅ پست ${num} در کانال ${ch} پیدا شد`);
    } catch (e) {
      await send(chatId, `❌ کانال: ${ch}\nپست: ${num}\nخطا: ${e.description || e.message}`);
    }
    return;
  }

  // === Database migration commands ===
  if (text === "/dumpdb") {
    if (!isAdmin(tgId)) return send(chatId, "❌ ادمین نیستید.");
    try { saveDb(); } catch {}
    const fd = new FormData();
    fd.append("chat_id", String(chatId));
    fd.append("caption", "📦 پشتیبان دیتابیس — " + new Date().toISOString());
    fd.append("document", new Blob([fs.readFileSync(DB_PATH)]), "bot.db");
    const r = await fetch(`${API}/sendDocument`, { method: "POST", body: fd });
    const j = await r.json();
    if (!j.ok) await send(chatId, "❌ ارسال بکاپ ناموفق: " + (j.description || ""));
    return;
  }

  if (text === "/loaddb") {
    if (!isAdmin(tgId)) return send(chatId, "❌ ادمین نیستید.");
    dbRun(`UPDATE users SET admin_state='awaiting_db_load', updated_at=unixepoch() WHERE telegram_id=${tgId}`);
    await send(chatId, `📤 حالا فایل دیتابیس (.db) را در همین چت بفرستید.\n⚠️ دیتابیس فعلی بکاپ و بعد جایگزین می‌شود و ربات ری‌استارت می‌شود.`,
      { reply_markup: { inline_keyboard: [[BTN.danger("❌ انصراف", "admin_back")]] } });
    return;
  }

  if (msg.document && isAdmin(tgId) && user.admin_state === "awaiting_db_load") {
    dbRun(`UPDATE users SET admin_state=NULL, updated_at=unixepoch() WHERE telegram_id=${tgId}`);
    const meta = await api("getFile", { file_id: msg.document.file_id });
    if (!meta.ok) return send(chatId, "❌ getFile ناموفق: " + (meta.description || ""));
    const res = await fetch(`https://api.telegram.org/file/bot${BOT_TOKEN}/${meta.result.file_path}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.subarray(0, 16).toString("latin1") !== "SQLite format 3\0")
      return send(chatId, "❌ این فایل یک دیتابیس SQLite معتبر نیست.");
    try { fs.copyFileSync(DB_PATH, DB_PATH + ".bak-" + Date.now()); } catch {}
    autosaveEnabled = false;
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
    fs.writeFileSync(DB_PATH, buf);
    await send(chatId, "✅ دیتابیس جایگزین شد. ربات در حال ری‌استارت...");
    process.exit(2);
  }

  if (text.startsWith("/reimg")) {
    if (!isAdmin(tgId)) return send(chatId, "❌ ادمین نیستید.");
    const parts = text.trim().split(/\s+/);
    if (parts[1] === "list") {
      const missing = dbAll("SELECT id, name, emoji FROM gifts WHERE is_active=1 AND (image_file_id IS NULL OR image_file_id='')");
      return send(chatId, missing.length
        ? "📉 گیفت‌های بدون عکس:\n" + missing.map(g => `<code>${g.id}</code>: ${g.emoji} ${g.name}`).join("\n") + `\n\nعکس را با کپشن عددی در کانال عکس بگذارید، بعد:\n<code>/reimg &lt;id&gt; &lt;کپشن&gt;</code>`
        : "همه گیفت‌ها عکس دارند ✅");
    }
    const gid = parseInt(parts[1]); const cap = (parts[2] || "").trim();
    if (!gid || !cap) return send(chatId, "فرمت: <code>/reimg 3 5</code>\nیا: <code>/reimg list</code>");
    const fid = globalThis.giftImageCache?.[cap];
    if (!fid) return send(chatId, `❌ عکسی با کپشن ${cap} در کش نیست.\nعکس را در کانال عکس (تنظیم‌شده با /setimgchannel) با کپشن عددی ${cap} پست کنید و دوباره امتحان کنید.`);
    dbRun(`UPDATE gifts SET image_file_id='${fid}' WHERE id=${gid}`);
    await send(chatId, `✅ عکس گیفت ${gid} ست شد.`);
    return;
  }

  // Admin: Add gift step-by-step
  if (text === "/addgift") {
    if (!isAdmin(tgId)) return send(chatId, "❌ شما ادمین نیستید.");
    dbRun(`UPDATE users SET admin_state='addgift_name', updated_at=unixepoch() WHERE telegram_id=${tgId}`);
    await send(chatId,
      `🎁 <b>اضافه کردن گیفت جدید</b>\n${SEPARATOR}\n\n` +
      `📝 <b>مرحله ۱ از ۵:</b>\n\nاسم گیفت رو بنویسید:\n(مثال: گیفت طلایی)`,
      { reply_markup: { inline_keyboard: [[BTN.danger("❌ انصراف", "admin_cancel_addgift")]] } }
    );
    return;
  }

  // Admin: Add gift step 2 (star count)
  if (freshUser.admin_state === "addgift_name") {
    if (!isAdmin(tgId)) return send(chatId, "❌ شما ادمین نیستید.");
    const giftName = text.trim().replace(/\|/g, "").slice(0, 100);
    if (!giftName) return send(chatId, "❌ اسم نامعتبره. دوباره بنویسید:");
    dbRun(`UPDATE users SET admin_state='addgift_star', admin_state_data='${giftName.replace(/'/g, "''")}', updated_at=unixepoch() WHERE telegram_id=${tgId}`);
    await send(chatId,
      `🎁 <b>اضافه کردن گیفت جدید</b>\n${SEPARATOR}\n\n` +
      `📝 <b>مرحله ۲ از ۵:</b>\n\nاسم: <b>${giftName}</b>\n\nتعداد ستاره رو بنویسید:\n(مثال: 25)`,
      { reply_markup: { inline_keyboard: [[BTN.danger("❌ انصراف", "admin_cancel_addgift")]] } }
    );
    return;
  }

  // Admin: Add gift step 3 (emoji)
  if (freshUser.admin_state === "addgift_star") {
    if (!isAdmin(tgId)) return send(chatId, "❌ شما ادمین نیستید.");
    const starCount = parseNum(normalizeDigits(text));
    if (isNaN(starCount) || starCount <= 0) return send(chatId, "❌ تعداد ستاره نامعتبر. یک عدد وارد کنید.");
    dbRun(`UPDATE users SET admin_state='addgift_emoji', admin_state_data='${freshUser.admin_state_data}|${starCount}', updated_at=unixepoch() WHERE telegram_id=${tgId}`);
    await send(chatId,
      `🎁 <b>اضافه کردن گیفت جدید</b>\n${SEPARATOR}\n\n` +
      `📝 <b>مرحله ۳ از ۵:</b>\n\nاسم: <b>${freshUser.admin_state_data}</b>\nستاره: <b>${starCount}</b>\n\nیک ایموجی بفرستید:\n(مثال: 🎁)`,
      { reply_markup: { inline_keyboard: [[BTN.danger("❌ انصراف", "admin_cancel_addgift")]] } }
    );
    return;
  }

  // Admin: Add gift step 4 (description — optional, shown to users)
  if (freshUser.admin_state === "addgift_emoji") {
    if (!isAdmin(tgId)) return send(chatId, "❌ شما ادمین نیستید.");
    const parts = String(freshUser.admin_state_data || "").split("|");
    const giftName = parts[0], starCount = parseInt(parts[1]);
    const emoji = extractEmoji(text) || "🎁";
    dbRun(`UPDATE users SET admin_state='addgift_desc', admin_state_data='${parts.join("|").replace(/'/g, "''")}|${emoji.replace(/'/g, "''")}', updated_at=unixepoch() WHERE telegram_id=${tgId}`);
    await send(chatId,
      `🎁 <b>اضافه کردن گیفت جدید</b>\n${SEPARATOR}\n\n` +
      `📝 <b>مرحله ۴ از ۵:</b>\n\n` +
      `اسم: <b>${giftName}</b>\nستاره: <b>${starCount}</b>\nایموجی: <b>${emoji}</b>\n\n` +
      `📝 <b>توضیحات گیفت</b> رو بنویسید:\n(برای کاربر موقع خرید نمایش داده میشه — اختیاری، تا ۵۰۰ حرف)`,
      { reply_markup: { inline_keyboard: [
        [BTN.neutral("⏭ بدون توضیحات", "addgift_desc_skip")],
        [BTN.danger("❌ انصراف", "admin_cancel_addgift")],
      ]}}
    );
    return;
  }

  // Admin: Add gift step 5 prompt (description received → ask caption number)
  if (freshUser.admin_state === "addgift_desc") {
    if (!isAdmin(tgId)) return send(chatId, "❌ شما ادمین نیستید.");
    const desc = text.trim().replace(/\|/g, "").replace(/</g, "&lt;").replace(/>/g, "&gt;").slice(0, 500);
    const parts = String(freshUser.admin_state_data || "").split("|");
    const base = parts.slice(0, 3).join("|"); // name|star|emoji
    const newData = `${base}|${desc}`;
    dbRun(`UPDATE users SET admin_state='addgift_id', admin_state_data='${newData.replace(/'/g, "''")}', updated_at=unixepoch() WHERE telegram_id=${tgId}`);
    await send(chatId,
      `🎁 <b>اضافه کردن گیفت جدید</b>\n${SEPARATOR}\n\n` +
      `📝 <b>مرحله ۵ از ۵:</b>\n\n` +
      `اسم: <b>${parts[0]}</b>\nستاره: <b>${parts[1]}</b>\nایموجی: <b>${parts[2]}</b>\n` +
      `توضیحات: <b>${desc ? "✅ ذخیره شد" : "—"}</b>\n\n` +
      `🔢 عددی که زیر عکس توی کانال گذاشتید رو بنویسید:\n(مثال: 1)`,
      { reply_markup: { inline_keyboard: [[BTN.danger("❌ انصراف", "admin_cancel_addgift")]] } }
    );
    return;
  }

  // Admin: Add gift final (caption number received → show preview)
  if (freshUser.admin_state === "addgift_id") {
    if (!isAdmin(tgId)) return send(chatId, "❌ شما ادمین نیستید.");
    const captionNum = text.trim();
    const raw = String(freshUser.admin_state_data || "");
    if (raw.split("|").length !== 4) {
      dbRun(`UPDATE users SET admin_state=NULL, admin_state_data=NULL, updated_at=unixepoch() WHERE telegram_id=${tgId}`);
      await send(chatId, "⚠️ داده ویزارد منقضی شد. دوباره /addgift بزنید.");
      return;
    }
    const [giftName, starCount, emoji, desc] = raw.split("|");

    // Get cached image
    const imageFileId = globalThis.giftImageCache?.[captionNum] || null;
    const rate = getNumSetting("exchange_rate");
    const price = starCount * rate;

    // Store preview data for confirmation
    dbRun(`UPDATE users SET admin_state='addgift_confirm', admin_state_data='${giftName.replace(/'/g, "''")}|${starCount}|${emoji}|${desc}|${captionNum.replace(/'/g, "''")}', updated_at=unixepoch() WHERE telegram_id=${tgId}`);

    const previewText =
      `👀 <b>پیش‌نمایش گیفت</b>\n${SEPARATOR}\n\n` +
      `${emoji} <b>${giftName}</b>\n` +
      (desc ? `<i>${desc}</i>\n` : "") +
      `⭐ <b>ستاره:</b> ${starCount}\n` +
      `💰 <b>قیمت:</b> ${fmtPrice(price)} تومان\n` +
      `🖼️ <b>عکس:</b> ${imageFileId ? "✅ پیدا شد" : "⚠️ یافت نشد"}\n\n` +
      `${SEPARATOR}\n` +
      `آیا مطمئن هستید؟`;

    if (imageFileId) {
      await sendPhoto(chatId, imageFileId, previewText,
        { reply_markup: { inline_keyboard: [
          [BTN.success("✅ تایید و ذخیره", "admin_confirm_gift")],
          [BTN.danger("❌ انصراف", "admin_cancel_addgift")],
        ]}}
      );
    } else {
      await send(chatId, previewText,
        { reply_markup: { inline_keyboard: [
          [BTN.success("✅ تایید و ذخیره", "admin_confirm_gift")],
          [BTN.danger("❌ انصراف", "admin_cancel_addgift")],
        ]}}
      );
    }
    return;
  }

  // Admin: List gifts
  if (text === "/gifts") {
    if (!isAdmin(tgId)) return send(chatId, "❌ شما ادمین نیستید.");
    const gifts = dbAll("SELECT * FROM gifts ORDER BY sort_order ASC");
    if (!gifts.length) return send(chatId, "📭 گیفتی وجود ندارد.");
    let text = `🎁 <b>لیست گیفت‌ها</b>\n${SEPARATOR}\n\n`;
    for (const g of gifts) {
      const status = g.is_active ? "🟢" : "🔴";
      text += `${status} <b>${g.emoji} ${g.name}</b> — ⭐ ${g.star_count}\n`;
      text += `   🆔 <code>${g.id}</code> | 📊 مرتبه: ${g.sort_order}\n\n`;
    }
    text += `${SEPARATOR}\n`;
    text += `📝 حذف: <code>/delgift [ID]</code>\n`;
    text += `📝 اضافه: <code>/addgift 🎁 نام 25</code>`;
    await send(chatId, text);
    return;
  }

  // Admin: Delete gift
  if (text.startsWith("/delgift")) {
    if (!isAdmin(tgId)) return send(chatId, "❌ شما ادمین نیستید.");
    const giftId = parseNum(text.replace("/delgift", "").trim());
    if (isNaN(giftId)) return send(chatId, "📝 <b>فرمت:</b>\n<code>/delgift [ID]</code>\n\nID گیفت رو از /gifts بگیرید.");
    const gift = dbGet(`SELECT * FROM gifts WHERE id=${giftId}`);
    if (!gift) return send(chatId, "❌ گیفت یافت نشد.");
    dbRun(`DELETE FROM gifts WHERE id=${giftId}`);
    await send(chatId, `🗑️ <b>گیفت حذف شد:</b>\n${gift.emoji} ${gift.name}`);
    return;
  }

  // Admin: Toggle gift active/inactive
  if (text.startsWith("/tgift")) {
    if (!isAdmin(tgId)) return send(chatId, "❌ شما ادمین نیستید.");
    const giftId = parseNum(text.replace("/tgift", "").trim());
    if (isNaN(giftId)) return send(chatId, "📝 <b>فرمت:</b>\n<code>/tgift [ID]</code>");
    const gift = dbGet(`SELECT * FROM gifts WHERE id=${giftId}`);
    if (!gift) return send(chatId, "❌ گیفت یافت نشد.");
    const newStatus = gift.is_active ? 0 : 1;
    dbRun(`UPDATE gifts SET is_active=${newStatus} WHERE id=${giftId}`);
    await send(chatId, `${newStatus ? "🟢" : "🔴"} <b>${gift.name}</b> ${newStatus ? "فعال" : "غیرفعال"} شد.`);
    return;
  }

  // Admin: Set card number (two-step: card → name)
  if (text.startsWith("/setcard")) {
    if (!isAdmin(tgId)) return send(chatId, "❌ شما ادمین نیستید.");
    const card = text.replace("/setcard", "").trim();
    if (!card) return send(chatId, "📝 <b>فرمت:</b>\n<code>/setcard 6037-1234-5678-9012</code>");
    // Save card number, then ask for name
    setSetting("card_number", card);
    dbRun(`UPDATE users SET admin_state='awaiting_card_name', updated_at=unixepoch() WHERE telegram_id=${tgId}`);
    await send(chatId,
      `✅ <b>شماره کارت ذخیره شد:</b>\n<code>${card}</code>\n\n` +
      `📝 حالا <b>نام صاحب کارت</b> رو بنویسید:\n` +
      `(مثال: علی رضایی)`,
      { reply_markup: { inline_keyboard: [[BTN.danger("❌ انصراف", "admin_back")]] } }
    );
    return;
  }

  // Admin: Set card holder name (received after /setcard)
  if (user.admin_state === "awaiting_card_name") {
    if (!isAdmin(tgId)) return send(chatId, "❌ شما ادمین نیستید.");
    const name = text.trim();
    dbRun(`UPDATE users SET admin_state=NULL, updated_at=unixepoch() WHERE telegram_id=${tgId}`);
    if (!name) {
      await send(chatId, `⚠️ نام خالی بود. عملیات لغو شد.`);
      return;
    }
    setSetting("card_holder_name", name);
    const card = getSetting("card_number");
    await send(chatId,
      `✅ <b>اطلاعات کارت بروزرسانی شد:</b>\n\n` +
      `💳 شماره کارت: <code>${card}</code>\n` +
      `👤 صاحب کارت: ${name}`
    );
    return;
  }

  // Admin: Set exchange rate
  if (text.startsWith("/setrate")) {
    if (!isAdmin(tgId)) return send(chatId, "❌ شما ادمین نیستید.");
    const rate = parseNum(text.replace("/setrate", "").trim());
    if (isNaN(rate) || rate <= 0) return send(chatId, "📝 <b>فرمت:</b>\n<code>/setrate 5000</code>");
    setSetting("exchange_rate", rate);
    await send(chatId, `✅ <b>نرخ تبدیل بروزرسانی شد:</b>\nهر ستاره = <code>${fmtPrice(rate)}</code> تومان`);
    return;
  }

  // Admin: Set log channel
  if (text.startsWith("/setlogchannel")) {
    if (!isAdmin(tgId)) return send(chatId, "❌ شما ادمین نیستید.");
    const parts = text.replace("/setlogchannel", "").trim().split(/\s+/);
    if (parts.length < 1) return send(chatId, "📝 <b>فرمت:</b>\n<code>/setlogchannel @pepestarLOG</code>\nیا\n<code>/setlogchannel -1001234567890 نام کانال</code>");
    const channelInput = parts[0];
    let channelId, channelName;
    if (channelInput.startsWith("@")) {
      const chatRes = await api("getChat", { chat_id: channelInput });
      if (!chatRes.ok) return send(chatId, `❌ کانال <code>${channelInput}</code> یافت نشد.\n\n📌 مطمئن شوید ربات به‌عنوان ادمین در کانال اضافه شده.`);
      channelId = chatRes.result.id;
      channelName = channelInput.replace("@", "");
    } else {
      channelId = parseInt(channelInput);
      channelName = parts.slice(1).join(" ") || "";
      if (isNaN(channelId)) return send(chatId, "❌ آیدی یا یوزرنیم کانال نامعتبر.");
    }
    const existing = dbGet(`SELECT * FROM channels WHERE channel_id=${channelId}`);
    if (existing) dbRun(`UPDATE channels SET channel_name='${channelName.replace(/'/g, "''")}', is_active=1 WHERE channel_id=${channelId}`);
    else dbRun(`INSERT INTO channels (channel_id, channel_name) VALUES (${channelId}, '${channelName.replace(/'/g, "''")}')`);
    const all = dbAll("SELECT * FROM channels");
    for (const ch of all) { if (ch.channel_id !== channelId) dbRun(`UPDATE channels SET is_active=0 WHERE id=${ch.id}`); }
    await send(chatId, `✅ <b>کانال گزارشات بروزرسانی شد:</b>\n\n📛 <b>نام:</b> ${channelName}\n🆔 <b>آیدی:</b> <code>${channelId}</code>\n\n📌 ربات رو به‌عنوان ادمین با قابلیت ارسال پیام در کانال اضافه کنید.`);
    return;
  }

  // Admin: Set image channel
  if (text.startsWith("/setimgchannel")) {
    if (!isAdmin(tgId)) return send(chatId, "❌ شما ادمین نیستید.");
    const parts = text.replace("/setimgchannel", "").trim().split(/\s+/);
    if (parts.length < 1) return send(chatId, "📝 <b>فرمت:</b>\n<code>/setimgchannel @giftschannel</code>\nیا\n<code>/setimgchannel -1001234567890</code>");
    const channelInput = parts[0];
    let channelId, channelName;
    if (channelInput.startsWith("@")) {
      const chatRes = await api("getChat", { chat_id: channelInput });
      if (!chatRes.ok) return send(chatId, `❌ کانال <code>${channelInput}</code> یافت نشد.\n\n📌 مطمئن شوید ربات به‌عنوان ادمین در کانال اضافه شده.`);
      channelId = chatRes.result.id;
      channelName = channelInput.replace("@", "");
    } else {
      channelId = parseInt(channelInput);
      channelName = parts.slice(1).join(" ") || "کانال عکس گیفت‌ها";
      if (isNaN(channelId)) return send(chatId, "❌ آیدی یا یوزرنیم کانال نامعتبر.");
    }
    // Check if exists
    const existing = dbGet(`SELECT * FROM img_channel WHERE channel_id=${channelId}`);
    if (existing) dbRun(`UPDATE img_channel SET channel_name='${channelName.replace(/'/g, "''")}' WHERE channel_id=${channelId}`);
    else {
      dbRun("DELETE FROM img_channel");
      dbRun(`INSERT INTO img_channel (channel_id, channel_name) VALUES (${channelId}, '${channelName.replace(/'/g, "''")}')`);
    }
    await send(chatId, `✅ <b>کانال عکس گیفت‌ها بروزرسانی شد:</b>\n\n📛 <b>نام:</b> ${channelName}\n🆔 <b>آیدی:</b> <code>${channelId}</code>\n\n📌 ربات رو به‌عنوان ادمین با قابلیت <b>خواندن پیام</b> در کانال اضافه کنید.\n\n💡 حالا عکس گیفت‌ها رو با عدد توی این کانال بذارید.`);
    return;
  }

  // Admin: Set mandatory channels
  if (text.startsWith("/setmustchannel")) {
    if (!isAdmin(tgId)) return send(chatId, "❌ شما ادمین نیستید.");
    const args = text.replace("/setmustchannel", "").trim();
    // List current must channels
    if (!args || args === "list") {
      const list = dbAll("SELECT * FROM must_channels ORDER BY id ASC");
      if (!list.length) return send(chatId, "📭 کانال الزامی تنظیم نشده.\n\n📝 <b>افزودن:</b>\n<code>/setmustchannel add @channelname</code>\n📝 <b>حذف:</b>\n<code>/setmustchannel remove @channelname</code>");
      let text = `📢 <b>کانال‌های الزامی</b>\n${SEPARATOR}\n\n`;
      for (const ch of list) {
        const username = ch.channel_name ? ch.channel_name.replace("@", "") : "";
        const link = username ? `https://t.me/${username}` : `https://t.me/c/${ch.channel_id.toString().replace("-100", "")}`;
        text += `• <a href="${link}">${ch.channel_name || ch.channel_id}</a>\n`;
      }
      text += `\n${SEPARATOR}\n`;
      text += `📝 <b>افزودن:</b> <code>/setmustchannel add @channelname</code>\n`;
      text += `📝 <b>حذف:</b> <code>/setmustchannel remove @channelname</code>\n`;
      text += `🗑️ <b>پاک کردن همه:</b> <code>/setmustchannel clear</code>`;
      await send(chatId, text);
      return;
    }
    // Clear all
    if (args === "clear") {
      dbRun("DELETE FROM must_channels");
      await send(chatId, "✅ همه کانال‌های الزامی پاک شدند.");
      return;
    }
    // Add or remove
    const action = args.split(/\s+/)[0];
    const channelInput = args.split(/\s+/)[1];
    if (!action || !channelInput || !["add", "remove"].includes(action)) {
      return send(chatId, "📝 <b>فرمت:</b>\n<code>/setmustchannel add @channelname</code>\n<code>/setmustchannel remove @channelname</code>");
    }
    let channelId, channelName;
    if (channelInput.startsWith("@")) {
      const chatRes = await api("getChat", { chat_id: channelInput });
      if (!chatRes.ok) return send(chatId, `❌ کانال <code>${channelInput}</code> یافت نشد.\n\n📌 مطمئن شوید ربات به‌عنوان ادمین در کانال اضافه شده.`);
      channelId = chatRes.result.id;
      channelName = channelInput;
    } else {
      channelId = parseInt(channelInput);
      channelName = "";
      if (isNaN(channelId)) return send(chatId, "❌ آیدی یا یوزرنیم کانال نامعتبر.");
    }
    if (action === "add") {
      const existing = dbGet(`SELECT * FROM must_channels WHERE channel_id=${channelId}`);
      if (existing) return send(chatId, `⚠️ کانال <code>${channelName || channelId}</code> اضافه شده.`);
      dbRun(`INSERT INTO must_channels (channel_id, channel_name) VALUES (${channelId}, '${channelName.replace(/'/g, "''")}')`);
      await send(chatId, `✅ <b>کانال الزامی اضافه شد:</b>\n${channelName || channelId}`);
    } else {
      const existing = dbGet(`SELECT * FROM must_channels WHERE channel_id=${channelId}`);
      if (!existing) return send(chatId, `⚠️ کانال <code>${channelName || channelId}</code> در لیست نیست.`);
      dbRun(`DELETE FROM must_channels WHERE channel_id=${channelId}`);
      await send(chatId, `🗑️ <b>کانال الزامی حذف شد:</b>\n${channelName || channelId}`);
    }
    return;
  }

  // Admin: Broadcast message
  if (user.admin_state === "awaiting_broadcast") {
    dbRun(`UPDATE users SET admin_state=NULL, updated_at=unixepoch() WHERE telegram_id=${tgId}`);
    const users = dbAll("SELECT telegram_id FROM users");
    let sent = 0, failed = 0;
    for (const u of users) {
      try { await send(u.telegram_id, text); sent++; } catch { failed++; }
    }
    await send(chatId, `📢 <b>ارسال همگانی انجام شد!</b>\n\n✅ موفق: <code>${sent}</code>\n❌ ناموفق: <code>${failed}</code>`);
    return;
  }

  // Fake Report Wizard — star/member count received
  if (user.admin_state === "fr_count") {
    if (!isAdmin(tgId)) return send(chatId, "❌ شما ادمین نیستید.");
    dbRun(`UPDATE users SET admin_state=NULL, admin_state_data=NULL, updated_at=unixepoch() WHERE telegram_id=${tgId}`);
    const n = parseInt(normalizeDigits(text).replace(/[^\d]/g, ""));
    if (!n || n <= 0) { await send(chatId, "❌ <b>عدد نامعتبر بود — گزارش فیک لغو شد.</b>"); return; }
    const [fakeIdStr, type] = String(user.admin_state_data || "").split("|");
    const fakeId = parseInt(fakeIdStr);
    if (!fakeId || !["star", "member"].includes(type)) { await send(chatId, "⚠️ داده منقضی شد. دوباره از منو شروع کنید."); return; }

    let count, price, typeLabel;
    if (type === "star") {
      count = n;
      price = n * getNumSetting("exchange_rate");
      typeLabel = "🌟 استارز تلگرام";
    } else {
      if (n < 100 || n % 100 !== 0) { await send(chatId, "❌ <b>تعداد ممبر باید مضرب ۱۰۰ و حداقل ۱۰۰ باشه — لغو شد.</b>"); return; }
      count = n;
      price = Math.ceil(n / 100) * getNumSetting("member_price");
      typeLabel = "👤 ممبر بدون ریزش";
    }

    const ok = await sendFakeReport(chatId, { fakeId, typeLabel, count, price });
    if (ok) await send(chatId,
      `✅ <b>گزارش فیک ارسال شد!</b>\n${SEPARATOR}\n\n` +
      `📦 ${typeLabel}\n` +
      `👀 تعداد: <code>${count}</code>\n` +
      `💰 مبلغ: <code>${Number(price).toLocaleString("en-US")}</code> تومان\n` +
      `👤 <code>${maskId(fakeId)}</code>`);
    return;
  }

  // Admin: Danger zone confirm
  if (user.admin_state === "awaiting_danger_confirm") {
    dbRun(`UPDATE users SET admin_state=NULL, updated_at=unixepoch() WHERE telegram_id=${tgId}`);
    if (text === "DangerZone") {
      // Preserve admin IDs
      const adminIdsStr = JSON.stringify(ADMIN_IDS);
      // Reset database
      dbRun("DELETE FROM orders");
      dbRun("DELETE FROM users");
      dbRun("DELETE FROM settings");
      // Re-create default settings
      for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) setSetting(k, v);
      await send(chatId,
        `✅ <b>دیتابیس ریست شد!</b>\n${SEPARATOR}\n\n` +
        `🗑️ <b>حذف شد:</b>\n` +
        `   • همه سفارشات\n` +
        `   • همه کاربران\n` +
        `   • همه تنظیمات\n\n` +
        `🔒 <b>حفظ شد:</b>\n` +
        `   • توکن ربات\n` +
        `   • آیدی ادمین‌ها\n` +
        `   • لیست گیفت‌ها\n` +
        `   • کانال گزارشات\n\n` +
        `${SEPARATOR}\n` +
        `💡 تنظیمات پیش‌فرض بازگردانده شد.`
      );
    } else {
      await send(chatId, `❌ <b>کلمه عبور اشتباه است!</b>\n\nعملیات لغو شد.`);
    }
    return;
  }

  // ==================== SETTINGS STATE HANDLERS ====================

  // Awaiting card number
  if (user.admin_state === "set_awaiting_card") {
    if (!isAdmin(tgId)) return send(chatId, "❌ شما ادمین نیستید.");
    const card = text.trim();
    dbRun(`UPDATE users SET admin_state='set_awaiting_card_name', admin_state_data='${card.replace(/'/g, "''")}', updated_at=unixepoch() WHERE telegram_id=${tgId}`);
    await send(chatId,
      `✅ <b>شماره کارت ذخیره شد:</b>\n<code>${card}</code>\n\n` +
      `📝 حالا <b>نام صاحب کارت</b> رو بنویسید:\n(مثال: علی رضایی)`,
      { reply_markup: { inline_keyboard: [[BTN.danger("❌ انصراف", "admin_settings")]] } }
    );
    return;
  }

  // Awaiting card holder name
  if (user.admin_state === "set_awaiting_card_name") {
    if (!isAdmin(tgId)) return send(chatId, "❌ شما ادمین نیستید.");
    const name = text.trim();
    const card = user.admin_state_data;
    dbRun(`UPDATE users SET admin_state=NULL, admin_state_data=NULL, updated_at=unixepoch() WHERE telegram_id=${tgId}`);
    if (!name) {
      await send(chatId, `⚠️ نام خالی بود. عملیات لغو شد.`);
      return;
    }
    setSetting("card_number", card);
    setSetting("card_holder_name", name);
    await send(chatId, `✅ <b>اطلاعات کارت بروزرسانی شد.</b>`);
    await send(chatId, settingsPanelText(), settingsPanelKb());
    return;
  }

  // Awaiting exchange rate
  if (user.admin_state === "set_awaiting_rate") {
    if (!isAdmin(tgId)) return send(chatId, "❌ شما ادمین نیستید.");
    const rate = parseNum(text.trim());
    dbRun(`UPDATE users SET admin_state=NULL, updated_at=unixepoch() WHERE telegram_id=${tgId}`);
    if (isNaN(rate) || rate <= 0) {
      await send(chatId, `❌ عدد نامعتبر بود. عملیات لغو شد.`);
      return;
    }
    setSetting("exchange_rate", rate);
    await send(chatId, `✅ <b>نرخ تبدیل بروزرسانی شد.</b>`);
    await send(chatId, settingsPanelText(), settingsPanelKb());
    return;
  }

  // Awaiting member price
  if (user.admin_state === "set_awaiting_member") {
    if (!isAdmin(tgId)) return send(chatId, "❌ شما ادمین نیستید.");
    const mp = parseNum(text.trim());
    dbRun(`UPDATE users SET admin_state=NULL, updated_at=unixepoch() WHERE telegram_id=${tgId}`);
    if (isNaN(mp) || mp <= 0) {
      await send(chatId, `❌ عدد نامعتبر بود. عملیات لغو شد.`);
      return;
    }
    setSetting("member_price", mp);
    await send(chatId, `✅ <b>قیمت ممبر بروزرسانی شد.</b>`);
    await send(chatId, settingsPanelText(), settingsPanelKb());
    return;
  }

  // Awaiting support username
  if (user.admin_state === "set_awaiting_support") {
    if (!isAdmin(tgId)) return send(chatId, "❌ شما ادمین نیستید.");
    dbRun(`UPDATE users SET admin_state=NULL, updated_at=unixepoch() WHERE telegram_id=${tgId}`);
    const sup = text.trim().replace(/^@/, "");
    if (!sup || !/^[A-Za-z0-9_]{4,32}$/.test(sup)) {
      await send(chatId, `❌ یوزرنیم نامعتبر بود. عملیات لغو شد.`);
      return;
    }
    setSetting("support_username", sup);
    await send(chatId, `✅ <b>پشتیبانی بروزرسانی شد:</b> @${sup}`);
    await send(chatId, settingsPanelText(), settingsPanelKb());
    return;
  }

  // Awaiting log channel
  if (user.admin_state === "set_awaiting_log") {
    if (!isAdmin(tgId)) return send(chatId, "❌ شما ادمین نیستید.");
    dbRun(`UPDATE users SET admin_state=NULL, updated_at=unixepoch() WHERE telegram_id=${tgId}`);
    const channelInput = text.trim();
    let channelId, channelName;
    if (channelInput.startsWith("@")) {
      const chatRes = await api("getChat", { chat_id: channelInput });
      if (!chatRes.ok) return send(chatId, `❌ کانال <code>${channelInput}</code> یافت نشد.`);
      channelId = chatRes.result.id;
      channelName = channelInput.replace("@", "");
    } else {
      channelId = parseInt(channelInput);
      channelName = "";
      if (isNaN(channelId)) return send(chatId, `❌ آیدی نامعتبر بود. عملیات لغو شد.`);
    }
    const existing = dbGet(`SELECT * FROM channels WHERE channel_id=${channelId}`);
    if (existing) dbRun(`UPDATE channels SET channel_name='${channelName.replace(/'/g, "''")}', is_active=1 WHERE channel_id=${channelId}`);
    else dbRun(`INSERT INTO channels (channel_id, channel_name) VALUES (${channelId}, '${channelName.replace(/'/g, "''")}')`);
    const all = dbAll("SELECT * FROM channels");
    for (const ch of all) { if (ch.channel_id !== channelId) dbRun(`UPDATE channels SET is_active=0 WHERE id=${ch.id}`); }
    await send(chatId, `✅ <b>کانال گزارشات بروزرسانی شد.</b>`);
    await send(chatId, settingsPanelText(), settingsPanelKb());
    return;
  }

  // Awaiting image channel
  if (user.admin_state === "set_awaiting_img") {
    if (!isAdmin(tgId)) return send(chatId, "❌ شما ادمین نیستید.");
    dbRun(`UPDATE users SET admin_state=NULL, updated_at=unixepoch() WHERE telegram_id=${tgId}`);
    const channelInput = text.trim();
    let channelId, channelName;
    if (channelInput.startsWith("@")) {
      const chatRes = await api("getChat", { chat_id: channelInput });
      if (!chatRes.ok) return send(chatId, `❌ کانال <code>${channelInput}</code> یافت نشد.`);
      channelId = chatRes.result.id;
      channelName = channelInput;
    } else {
      channelId = parseInt(channelInput);
      channelName = "کانال عکس گیفت‌ها";
      if (isNaN(channelId)) return send(chatId, `❌ آیدی نامعتبر بود. عملیات لغو شد.`);
    }
    const existing = dbGet(`SELECT * FROM img_channel WHERE channel_id=${channelId}`);
    if (existing) dbRun(`UPDATE img_channel SET channel_name='${channelName.replace(/'/g, "''")}' WHERE channel_id=${channelId}`);
    else { dbRun("DELETE FROM img_channel"); dbRun(`INSERT INTO img_channel (channel_id, channel_name) VALUES (${channelId}, '${channelName.replace(/'/g, "''")}')`); }
    await send(chatId, `✅ <b>کانال عکس گیفت‌ها بروزرسانی شد.</b>`);
    await send(chatId, settingsPanelText(), settingsPanelKb());
    return;
  }

  // Awaiting must channel add
  if (user.admin_state === "set_awaiting_must_add") {
    if (!isAdmin(tgId)) return send(chatId, "❌ شما ادمین نیستید.");
    dbRun(`UPDATE users SET admin_state=NULL, updated_at=unixepoch() WHERE telegram_id=${tgId}`);
    const channelInput = text.trim();
    let channelId, channelName;
    if (channelInput.startsWith("@")) {
      const chatRes = await api("getChat", { chat_id: channelInput });
      if (!chatRes.ok) return send(chatId, `❌ کانال <code>${channelInput}</code> یافت نشد.`);
      channelId = chatRes.result.id;
      channelName = channelInput;
    } else {
      channelId = parseInt(channelInput);
      channelName = "";
      if (isNaN(channelId)) return send(chatId, `❌ آیدی نامعتبر بود. عملیات لغو شد.`);
    }
    const existing = dbGet(`SELECT * FROM must_channels WHERE channel_id=${channelId}`);
    if (existing) return send(chatId, `⚠️ این کانال اضافه شده.`);
    dbRun(`INSERT INTO must_channels (channel_id, channel_name) VALUES (${channelId}, '${channelName.replace(/'/g, "''")}')`);
    await send(chatId, `✅ <b>کانال الزامی اضافه شد:</b>\n${channelName || channelId}`);
    return;
  }

  // /start
  if (text === "/start") {
    // Cancel any pending orders and reset everything for a clean start
    dbRun(`UPDATE orders SET status='cancelled', updated_at=unixepoch() WHERE user_id=${user.id} AND status='pending'`);
    dbRun(`UPDATE users SET state='idle', pending_gift_link=NULL, pending_star_count=NULL, admin_state=NULL, admin_state_data=NULL, updated_at=unixepoch() WHERE id=${user.id}`);

    // Check mandatory channel membership
    const mustChannels = dbAll("SELECT * FROM must_channels");
    if (mustChannels.length) {
      const notJoined = [];
      for (const ch of mustChannels) {
        const member = await api("getChatMember", { chat_id: ch.channel_id, user_id: tgId });
        if (!member.ok || !["member", "administrator", "creator"].includes(member.result?.status)) {
          notJoined.push(ch);
        }
      }
      if (notJoined.length) {
        let text = `🔒 <b>عضویت در کانال‌های زیر الزامی است!</b>\n${SEPARATOR}\n\n`;
        const buttons = [];
        for (const ch of notJoined) {
          const channelUsername = ch.channel_name ? ch.channel_name.replace("@", "") : "";
          const channelLink = channelUsername
            ? `https://t.me/${channelUsername}`
            : `https://t.me/c/${ch.channel_id.toString().replace("-100", "")}`;
          text += `📢 <a href="${channelLink}">${channelUsername ? "@" + channelUsername : ch.channel_name || "کانال"}</a>\n`;
          buttons.push([{ text: `📢 ${ch.channel_name || "کانال"}`, url: channelLink }]);
        }
        text += `\n${SEPARATOR}\nبعد از عضویت، دکمه زیر رو بزنید:`;
        buttons.push([BTN.success("✅  بررسی عضویت", "check_member")]);
        await send(chatId, text, { reply_markup: { inline_keyboard: buttons } });
        return;
      }
    }

    // Show main menu
    await showMainMenu(chatId, tgId);
    return;
  }

  // /help
  if (text === "/help") {
    await send(chatId,
      `📖 <b>راهنمای ربات</b>\n${SEPARATOR}\n\n` +
      `🎁 <b>لینک گیفت</b> → خرید گیفت\n` +
      `⭐ <b>عدد</b> → خرید استار\n` +
      `📸 <b>عکس</b> → ارسال رسید پرداخت\n\n` +
      `${SEPARATOR}\n` +
      `💬 دستورات:\n` +
      `/start  — شروع مجدد\n` +
      `/help   — راهنما\n` +
      `/admin  — پنل مدیریت (ادمین)` +
      (isAdmin(tgId) ? `\n/pending — سفارشات در انتظار\n/orders — همه سفارشات\n/setcard — تنظیم کارت\n/setrate — تنظیم نرخ\n/setlogchannel — کانال گزارش\n/setimgchannel — کانال عکس\n/setmustchannel — کانال‌های الزامی` : "")
    );
    return;
  }

  // Await star count
  if (user.state === "awaiting_star_count" && user.pending_gift_link) {
    const sc = parseNum(normalizeDigits(text));
    if (isNaN(sc) || sc <= 0) return send(chatId, `❌ <b>لطفاً یک عدد معتبر وارد کنید.</b>\nمثال: <code>100</code>`);
    cancelStalePending(user.id);
    const rate = getNumSetting("exchange_rate"), price = sc * rate, code = genCode();
    dbRun(`INSERT INTO orders (code, user_id, gift_link, type, star_count, price_toman, status) VALUES ('${code}', ${user.id}, '${user.pending_gift_link.replace(/'/g, "''")}', 'gift', ${sc}, ${price}, 'pending')`);
    const o = dbGet(`SELECT * FROM orders WHERE code='${code}'`);
    dbRun(`UPDATE users SET state='idle', pending_gift_link=NULL, updated_at=unixepoch() WHERE id=${user.id}`);
    await send(chatId,
      `🎁 <b>اطلاعات گیفت</b>\n${SEPARATOR}\n\n` +
      `⭐ <b>تعداد ستاره:</b>  <code>${sc}</code>\n` +
      `💰 <b>قیمت:</b>  <code>${fmtPrice(price)}</code> تومان\n\n` +
      `${SEPARATOR}\n` +
      `برای ادامه خرید دکمه زیر رو بزنید:`,
      { reply_markup: { inline_keyboard: [
        [BTN.success("🛒  شروع خرید", `buy_${o.id}`)],
        [BTN.danger("❌  انصراف", `cancel_order_${o.id}`)],
      ]}}
    );
    return;
  }

  // Awaiting member target (channel/group link)
  if (user.state === "awaiting_member_target" && user.pending_gift_link) {
    const count = parseInt(user.pending_gift_link);
    const target = text.trim();
    if (!target) return send(chatId, "❌ لطفاً لینک کانال یا گروه رو بفرستید.");
    if (!/^(https?:\/\/)?(t\.me|telegram\.me)\/\S+$/i.test(target) && !target.startsWith("@"))
      return send(chatId, "❌ <b>لینک نامعتبره.</b>\nمثال درست: <code>@channelname</code> یا <code>https://t.me/channelname</code>");
    // Clean up link
    let cleanTarget = target.replace("https://", "").replace("http://", "").replace("t.me/", "").replace("telegram.me/", "").replace("@", "");
    const memberPrice = getNumSetting("member_price");
    const totalPrice = Math.ceil(count / 100) * memberPrice;
    cancelStalePending(user.id);
    const code = genCode();
    dbRun(`INSERT INTO orders (code, user_id, gift_link, gift_name, type, star_count, price_toman, status) VALUES ('${code}', ${user.id}, '${cleanTarget.replace(/'/g, "''")}', 'عضویت ممبر', 'member', ${count}, ${totalPrice}, 'pending')`);
    const o = dbGet(`SELECT * FROM orders WHERE code='${code}'`);
    dbRun(`UPDATE users SET state='idle', pending_gift_link=NULL, updated_at=unixepoch() WHERE id=${user.id}`);
    await send(chatId,
      `👤 <b>اطلاعات سفارش ممبر</b>\n${SEPARATOR}\n\n` +
      `📍 <b>هدف:</b>  <code>${cleanTarget}</code>\n` +
      `👥 <b>تعداد:</b>  <code>${fmtPrice(count)}</code> ممبر\n` +
      `💰 <b>قیمت:</b>  <code>${fmtPrice(totalPrice)}</code> تومان\n\n` +
      `${SEPARATOR}\n` +
      `📌 کنسل ندارد ●\n` +
      `تکمیلی سریع ⚡️\n\n` +
      `برای ادامه خرید:`,
      { reply_markup: { inline_keyboard: [
        [BTN.success("🛒  شروع خرید", `buy_${o.id}`)],
        [BTN.danger("❌  انصراف", `cancel_order_${o.id}`)],
      ]}}
    );
    return;
  }

  // Photo (receipt)
  if (msg.photo && user.state === "awaiting_receipt") {
    const fileId = msg.photo[msg.photo.length - 1].file_id;
    const o = dbGet(`SELECT * FROM orders WHERE user_id=${user.id} AND status='pending' ORDER BY id DESC LIMIT 1`);
    if (!o) return send(chatId, `❌ <b>سفارش فعالی یافت نشد.</b>`);
    dbRun(`UPDATE orders SET receipt_file_id='${fileId}', status='receipt_sent', updated_at=unixepoch() WHERE id=${o.id}`);
    dbRun(`UPDATE users SET state='receipt_sent', updated_at=unixepoch() WHERE id=${user.id}`);
    await send(chatId,
      `📸 <b>رسید دریافت شد!</b>\n${SEPARATOR}\n\n` +
      `🔑 کد سفارش: <code>${o.code}</code>\n` +
      `💰 مبلغ: <code>${fmtPrice(o.price_toman)}</code> تومان\n\n` +
      `برای تایید نهایی و ارسال به ادمین:`,
      { reply_markup: { inline_keyboard: [
        [BTN.success("💳  تایید و ارسال", `paid_${o.id}`)],
        [BTN.danger("❌  انصراف", `cancel_order_${o.id}`)],
      ]}}
    );
    return;
  }
  if (msg.photo) {
    if (isAdmin(tgId)) return send(chatId, `❌ <b>ورودی تصویر پشتیبانی نمی‌شود.</b>\nلطفاً فقط از طریق منوی اصلی خرید کنید.`);
    return send(chatId,
      `📸 <b>عکس رسید پرداخت</b>\n${SEPARATOR}\n\n` +
      `رسید فقط بعد از زدن «🛒 شروع خرید» و دیدن شماره کارت قابل قبوله.\nاز منوی زیر شروع کنید:`,
      mainMenuKb()
    );
  }

  // Gift link
  const slug = parseGiftLink(text);
  if (slug) {
    let sc = null;
    let giftName = slug;
    try {
      const res = await fetch(`${API}/getAvailableGifts`);
      const d = await res.json();
      if (d.ok && d.result?.gifts) {
        // Try exact match first
        let g = d.result.gifts.find(g => g.id === slug);
        // Try case-insensitive
        if (!g) g = d.result.gifts.find(g => g.id.toLowerCase() === slug.toLowerCase());
        // Try partial match (slug starts with gift id or vice versa)
        if (!g) g = d.result.gifts.find(g => slug.toLowerCase().includes(g.id.toLowerCase()) || g.id.toLowerCase().includes(slug.toLowerCase()));
        // Try matching by name/description
        if (!g) g = d.result.gifts.find(g => g.name && slug.toLowerCase().includes(g.name.toLowerCase()));
        if (g) { sc = g.star_count; giftName = g.name || slug; }
      }
    } catch (e) { console.error("Gift lookup error:", e.message); }

    if (sc) {
      cancelStalePending(user.id);
      const rate = getNumSetting("exchange_rate"), price = sc * rate, code = genCode();
      dbRun(`INSERT INTO orders (code, user_id, gift_link, gift_name, type, star_count, price_toman, status) VALUES ('${code}', ${user.id}, '${text.replace(/'/g, "''")}', '${giftName.replace(/'/g, "''")}', 'gift', ${sc}, ${price}, 'pending')`);
      const o = dbGet(`SELECT * FROM orders WHERE code='${code}'`);
      await send(chatId,
        `🎁 <b>گیفت پیدا شد!</b>\n${SEPARATOR}\n\n` +
        `🏷️ <b>نام:</b>  <code>${giftName}</code>\n` +
        `⭐ <b>ستاره:</b>  <code>${sc}</code>\n` +
        `💰 <b>قیمت:</b>  <code>${fmtPrice(price)}</code> تومان\n\n` +
        `${SEPARATOR}\n` +
        `برای ادامه خرید:`,
        { reply_markup: { inline_keyboard: [
        [BTN.success("🛒  شروع خرید", `buy_${o.id}`)],
        [BTN.danger("❌  انصراف", `cancel_order_${o.id}`)],
      ]}}
      );
    } else {
      dbRun(`UPDATE users SET state='awaiting_star_count', pending_gift_link='${text.replace(/'/g, "''")}', updated_at=unixepoch() WHERE id=${user.id}`);
      await send(chatId, `🎁 <b>لینک گیفت دریافت شد!</b>\n\n⚠️ تعداد ستاره این گیفت پیدا نشد.\nلطفاً تعداد ستاره رو وارد کنید:\n(مثال: <code>100</code>)`);
    }
    return;
  }

  // Number (star purchase)
  const normText = normalizeDigits(text);
  if (user.state === "idle" && /^\d+$/.test(normText)) {
    const sc = parseNum(normText);
    if (sc > 0 && sc <= 1000000) {
      cancelStalePending(user.id);
      const rate = getNumSetting("exchange_rate"), price = sc * rate, code = genCode();
      dbRun(`INSERT INTO orders (code, user_id, gift_link, type, star_count, price_toman, status) VALUES ('${code}', ${user.id}, 'سفارش دستی', 'star', ${sc}, ${price}, 'pending')`);
      const o = dbGet(`SELECT * FROM orders WHERE code='${code}'`);
      await send(chatId,
        `🌟 <b>سفارش استار</b>\n${SEPARATOR}\n\n` +
        `⭐ <b>تعداد ستاره:</b>  <code>${sc}</code>\n` +
        `💰 <b>قیمت:</b>  <code>${fmtPrice(price)}</code> تومان\n\n` +
        `${SEPARATOR}\n` +
        `برای ادامه خرید:`,
        { reply_markup: { inline_keyboard: [
        [BTN.success("🛒  شروع خرید", `buy_${o.id}`)],
        [BTN.danger("❌  انصراف", `cancel_order_${o.id}`)],
      ]}}
      );
      return;
    }
  }

  // Admin: order search input
  if (freshUser.admin_state === "admin_search") {
    if (!isAdmin(tgId)) return send(chatId, "❌ شما ادمین نیستید.");
    if (text.startsWith("/")) {
      dbRun(`UPDATE users SET admin_state=NULL, admin_state_data=NULL WHERE telegram_id=${tgId}`);
      if (text !== "/cancel") await send(chatId, "🔎 جستجو لغو شد.");
      return;
    }
    const q = normalizeDigits(text).trim().replace(/^#/, "").toUpperCase();
    let o = null;
    if (/^\d+$/.test(q)) o = dbGet(`SELECT * FROM orders WHERE id=${parseInt(q)}`);
    else {
      const qq = q.replace(/'/g, "''");
      o = dbGet(`SELECT * FROM orders WHERE UPPER(code)='${qq}'`);
    }
    if (!o) { await send(chatId, `❌ سفارشی برای «${esc(q)}» پیدا نشد.\nدوباره کد رو بفرستید یا <code>/cancel</code> بزنید.`); return; }
    dbRun(`UPDATE users SET admin_state=NULL, admin_state_data=NULL, updated_at=unixepoch() WHERE telegram_id=${tgId}`);
    await renderOrderDetail(chatId, o.id);
    return;
  }

  // Admin: direct order lookup /order CODE
  if (text.startsWith("/order ")) {
    if (!isAdmin(tgId)) return send(chatId, "❌ شما ادمین نیستید.");
    const q = normalizeDigits(text.slice(7)).trim().replace(/^#/, "").toUpperCase();
    if (!q) return send(chatId, "❌ فرمت: <code>/order QP4PGV</code>");
    let o = /^\d+$/.test(q) ? dbGet(`SELECT * FROM orders WHERE id=${parseInt(q)}`)
                            : dbGet(`SELECT * FROM orders WHERE UPPER(code)='${q.replace(/'/g, "''")}'`);
    if (!o) return send(chatId, `❌ سفارشی برای «${esc(q)}» پیدا نشد.`);
    await renderOrderDetail(chatId, o.id);
    return;
  }

  // Default - invalid input (show guidance to all users)
  await send(chatId,
    `🤖 <b>متوجه نشدم!</b>\n${SEPARATOR}\n` +
    `از دکمه‌های زیر استفاده کنید یا عدد ستاره بفرستید:`,
    { reply_markup: { inline_keyboard: [
      [BTN.success("🎁  خرید گیفت", "menu_gift"), BTN.success("⭐️  خرید استار", "menu_star")],
      [BTN.primary("📦  سفارش‌های من", "menu_orders"), BTN.primary("💬  پشتیبانی", "menu_support")],
    ]}}
  );
}

// ==================== Callback Handler ====================
async function handleCallback(cq) {
  // Only process private chats
  if (cq.message.chat.type !== "private") return;
  const data = cq.data, chatId = cq.message.chat.id, msgId = cq.message.message_id;
  const tgId = cq.from.id, username = cq.from.username, firstName = cq.from.first_name || "کاربر";
  const user = ensureUser(tgId, username, firstName);

  // Channel membership check
  if (data === "check_member") {
    const mustChannels = dbAll("SELECT * FROM must_channels");
    if (mustChannels.length) {
      const notJoined = [];
      for (const ch of mustChannels) {
        const member = await api("getChatMember", { chat_id: ch.channel_id, user_id: tgId });
        if (!member.ok || !["member", "administrator", "creator"].includes(member.result?.status)) {
          notJoined.push(ch);
        }
      }
      if (notJoined.length) {
        let text = `🔒 <b>هنوز عضو کانال‌های زیر نیستید!</b>\n${SEPARATOR}\n\n`;
        const buttons = [];
        for (const ch of notJoined) {
          const channelUsername = ch.channel_name ? ch.channel_name.replace("@", "") : "";
          const channelLink = channelUsername
            ? `https://t.me/${channelUsername}`
            : `https://t.me/c/${ch.channel_id.toString().replace("-100", "")}`;
          text += `📢 <a href="${channelLink}">${channelUsername ? "@" + channelUsername : ch.channel_name || "کانال"}</a>\n`;
          buttons.push([{ text: `📢 ${ch.channel_name || "کانال"}`, url: channelLink }]);
        }
        text += `\n${SEPARATOR}\nبعد از عضویت، دکمه زیر رو بزنید:`;
        buttons.push([BTN.success("✅  بررسی عضویت", "check_member")]);
        await answer(cq.id, "❌ هنوز عضو همه کانال‌ها نیستید!", true);
        await edit(chatId, msgId, text, { reply_markup: { inline_keyboard: buttons } });
      } else {
        await showMainMenu(chatId, tgId);
      }
    } else {
      await showMainMenu(chatId, tgId);
    }
    return answer(cq.id);
  }

  // Main menu callbacks
  if (data === "menu_back") {
    // Reset conversation state and cancel any pending orders
    dbRun(`UPDATE users SET state='idle', pending_gift_link=NULL, pending_star_count=NULL, admin_state=NULL, admin_state_data=NULL, updated_at=unixepoch() WHERE telegram_id=${tgId}`);
    dbRun(`UPDATE orders SET status='cancelled', updated_at=unixepoch() WHERE user_id=${user.id} AND status='pending'`);
    await editSmart(chatId, msgId,
      `✨ <b>${BOT_NAME} Bot</b> ✨\n` +
      `🎁 خرید گیفت و استار تلگرام\n` +
      `${SEPARATOR}\n` +
      `🌟 از منوی زیر، سرویس موردنظرت رو انتخاب کن:\n` +
      `${SEPARATOR}\n` +
      `⚡️ سریع • امن • آسان`,
      { reply_markup: { inline_keyboard: [
        btnRow(BTN.success("🎁  خرید گیفت تلگرام", "menu_gift")),
        btnRow(BTN.success("⭐️  خرید استار تلگرام", "menu_star")),
        btnRow(BTN.success("👤  خرید ممبر", "menu_member")),
        btnRow(BTN.primary("📦  سفارش‌های من", "menu_orders")),
        btnRow(BTN.primary("💬  پشتیبانی", "menu_support")),
      ]}}
    );
    return answer(cq.id);
  }
  if (data === "menu_star") {
    // Reset state and cancel pending orders
    dbRun(`UPDATE users SET state='idle', pending_gift_link=NULL, pending_star_count=NULL, admin_state=NULL, admin_state_data=NULL, updated_at=unixepoch() WHERE telegram_id=${tgId}`);
    dbRun(`UPDATE orders SET status='cancelled', updated_at=unixepoch() WHERE user_id=${user.id} AND status='pending'`);
    const rate = getNumSetting("exchange_rate");
    await editSmart(chatId, msgId,
      `⭐ <b>خرید استار تلگرام</b>\n${SEPARATOR}\n\n` +
      `💱 <b>نرخ هر ستاره:</b> <code>${fmtPrice(rate)}</code> تومان\n\n` +
      `${SEPARATOR}\n\n` +
      `تعداد ستاره مورد نظرتون رو بنویسید:\n` +
      `(مثال: <code>100</code>, <code>500</code>, <code>1000</code>)`,
      { reply_markup: { inline_keyboard: [
        [BTN.success("⭐ 50", "star_q_50"), BTN.success("⭐ 100", "star_q_100"), BTN.success("⭐ 250", "star_q_250")],
        [BTN.success("⭐ 500", "star_q_500"), BTN.success("⭐ 1000", "star_q_1000")],
        [BTN.neutral("🔙 بازگشت به منو", "menu_back")],
      ]}}
    );
    return answer(cq.id);
  }
  if (data === "menu_gift") {
    // Reset state and cancel pending orders
    dbRun(`UPDATE users SET state='idle', pending_gift_link=NULL, pending_star_count=NULL, admin_state=NULL, admin_state_data=NULL, updated_at=unixepoch() WHERE telegram_id=${tgId}`);
    dbRun(`UPDATE orders SET status='cancelled', updated_at=unixepoch() WHERE user_id=${user.id} AND status='pending'`);
    await showGiftList(chatId, msgId, 0);
    return answer(cq.id);
  }
  // Gift list pagination
  if (data.startsWith("gift_page_")) {
    const page = parseInt(data.replace("gift_page_", ""));
    await showGiftList(chatId, msgId, page);
    return answer(cq.id);
  }
  // Gift list back from detail — delete photo message, send new list
  if (data === "gift_list_back") {
    try { await deleteMsg(chatId, msgId); } catch {}
    await showGiftListNew(chatId, 0);
    return answer(cq.id);
  }

  // Member purchase flow
  if (data === "menu_member") {
    // Reset state and cancel pending orders
    dbRun(`UPDATE users SET state='idle', pending_gift_link=NULL, pending_star_count=NULL, admin_state=NULL, admin_state_data=NULL, updated_at=unixepoch() WHERE telegram_id=${tgId}`);
    dbRun(`UPDATE orders SET status='cancelled', updated_at=unixepoch() WHERE user_id=${user.id} AND status='pending'`);
    const memberPrice = getNumSetting("member_price");
    const pricePer100 = fmtPrice(memberPrice);
    await editSmart(chatId, msgId,
      `👤 <b>خرید ممبر بدون ریزش</b>\n${SEPARATOR}\n\n` +
      `تکمیلی سریع ⚡️\n` +
      `هدف : کانال | گروه 📍\n` +
      `کنسل ندارد ●\n` +
      `قیمت هر ۱۰۰ ممبر : <code>${pricePer100}</code> تومان 💸\n` +
      `حداقل سفارش : ۱۰۰ عدد\n\n` +
      `${SEPARATOR}\n\n` +
      `🔹 تعداد مورد نظر خود را از بین ۱۰۰ تا ۱٬۰۰۰ انتخاب کنید:`,
      { reply_markup: { inline_keyboard: [
        [BTN.success("100", "member_count_100"), BTN.success("250", "member_count_250"), BTN.success("500", "member_count_500")],
        [BTN.success("750", "member_count_750"), BTN.success("1000", "member_count_1000")],
        [BTN.neutral("🔙 بازگشت به منو", "menu_back")],
      ]}}
    );
    return answer(cq.id);
  }

  // Member count selection
  if (data.startsWith("member_count_")) {
    const count = parseInt(data.replace("member_count_", ""));
    if (count < 100 || count > 1000) return answer(cq.id, "تعداد نامعتبر.", true);
    const memberPrice = getNumSetting("member_price");
    const totalPrice = Math.ceil(count / 100) * memberPrice;
    dbRun(`UPDATE users SET state='awaiting_member_target', pending_gift_link='${count}', updated_at=unixepoch() WHERE telegram_id=${tgId}`);
    await edit(chatId, msgId,
      `👤 <b>خرید ممبر بدون ریزش</b>\n${SEPARATOR}\n\n` +
      `🔹 تعداد: <b>${fmtPrice(count)}</b> ممبر\n` +
      `💰 قیمت: <b>${fmtPrice(totalPrice)}</b> تومان\n\n` +
      `${SEPARATOR}\n\n` +
      `📍 لینک کانال یا گروه مورد نظر رو بفرستید:\n(مثال: <code>@channelname</code> یا <code>https://t.me/channelname</code>)`,
      { reply_markup: { inline_keyboard: [[BTN.danger("❌ انصراف", "menu_back")]] } }
    );
    return answer(cq.id);
  }

  if (data === "menu_support") {
    // Reset state
    resetUserState(user.id);
    const sup = (getSetting("support_username") || DEFAULT_SETTINGS.support_username).replace(/^@/, "");
    await editSmart(chatId, msgId,
      `💬 <b>پشتیبانی ${BOT_NAME}</b>\n${SEPARATOR}\n\n` +
      `برای ارتباط با پشتیبانی:\n\n` +
      `👤 <a href="https://t.me/${sup}">@${sup}</a>\n\n` +
      `${SEPARATOR}\n` +
      `⏰ پاسخگویی: ۹ صبح تا ۱۲ شب`,
      { reply_markup: { inline_keyboard: [
        [{ text: "💬  ارسال پیام به پشتیبانی", url: `https://t.me/${sup}`, style: "primary" }],
        [BTN.neutral("🔙 بازگشت به منو", "menu_back")],
      ]}}
    );
    return answer(cq.id);
  }
  if (data === "menu_orders") {
    const u = dbGet(`SELECT * FROM users WHERE telegram_id=${tgId}`);
    if (u) {
      const rows = dbAll(`SELECT * FROM orders WHERE user_id=${u.id} ORDER BY id DESC LIMIT 10`);
      if (!rows.length) {
        await editSmart(chatId, msgId,
          `📦 <b>سفارش‌های من</b>\n${SEPARATOR}\n\n` +
          `📭 <b>هنوز سفارشی ثبت نکردید.</b>\n\n` +
          `از منوی اصلی خرید کنید!`,
          { reply_markup: { inline_keyboard: [[BTN.neutral("🔙 بازگشت به منو", "menu_back")]] } }
        );
      } else {
        const si = { pending: "🟡", receipt_sent: "🔵", pending_approval: "🟠", approved: "🟢", rejected: "🔴", completed: "✅", cancelled: "⚫" };
        const sf = { pending: "در انتظار رسید", receipt_sent: "رسید ارسال شده", pending_approval: "در انتظار تایید", approved: "تایید شده", rejected: "رد شده", completed: "تکمیل شده", cancelled: "لغو شده" };
        let text = `📦 <b>سفارش‌های من</b>\n${SEPARATOR}\n\n`;
        for (const o of rows) {
          const icon = si[o.status] || "❓";
          const tIcon = typeIcon(o.type);
          const d = new Date(o.created_at * 1000);
          const time = `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
          text += `${icon} <b><code>${o.code}</code></b> ${tIcon}\n`;
          text += `   📊 ${sf[o.status] || o.status}\n`;
          text += `   💰 ${fmtPrice(o.price_toman)} تومان  •  ${countLabel(o.type)}: <code>${o.star_count}</code>\n`;
          text += `   📅 ${d.toLocaleDateString("fa-IR")}  🕐 ${time}\n\n`;
        }
        await editSmart(chatId, msgId, text, { reply_markup: { inline_keyboard: [[BTN.neutral("🔙 بازگشت به منو", "menu_back")]] } });
      }
    }
    return answer(cq.id);
  }

  // Gift selection from list
  if (data.startsWith("gift_select_")) {
    const giftId = parseInt(data.replace("gift_select_", ""));
    const gift = dbGet(`SELECT * FROM gifts WHERE id=${giftId} AND is_active=1`);
    if (!gift) return answer(cq.id, "گیفت یافت نشد.", true);
    cancelStalePending(user.id);
    const rate = getNumSetting("exchange_rate");
    const price = gift.star_count * rate;
    const code = genCode();
    dbRun(`INSERT INTO orders (code, user_id, gift_link, gift_name, type, star_count, price_toman, status) VALUES ('${code}', ${user.id}, 'سفارش گیفت', '${gift.name.replace(/'/g, "''")}', 'gift', ${gift.star_count}, ${price}, 'pending')`);
    const o = dbGet(`SELECT * FROM orders WHERE code='${code}'`);
    const giftInfo =
      `${gift.emoji} <b>${gift.name}</b>\n${SEPARATOR}\n\n` +
      (gift.description ? `📝 ${gift.description}\n\n` : "") +
      `⭐ <b>تعداد ستاره:</b>  <code>${gift.star_count}</code>\n` +
      `💰 <b>قیمت:</b>  <code>${fmtPrice(price)}</code> تومان\n\n` +
      `${SEPARATOR}\n` +
      `برای ادامه خرید:`;
    const kb = { reply_markup: { inline_keyboard: [
      [BTN.success("🛒  شروع خرید", `buy_${o.id}`)],
      [BTN.neutral("🔙 بازگشت به لیست گیفت‌ها", "gift_list_back")],
    ]}};
    if (gift.image_file_id) {
      const r = await sendPhoto(chatId, gift.image_file_id, giftInfo, kb);
      if (r.ok) {
        try { await deleteMsg(chatId, msgId); } catch {}
      } else {
        console.warn(`⚠️ sendPhoto failed for gift ${gift.id}:`, r.description);
        dbRun(`UPDATE gifts SET image_file_id=NULL WHERE id=${gift.id}`);
        await editSmart(chatId, msgId, giftInfo + `\n⚠️ <i>عکس این گیفت موقتاً در دسترس نیست.</i>`, kb);
      }
    } else {
      await editSmart(chatId, msgId, giftInfo, kb);
    }
    return answer(cq.id);
  }

  // User cancel order
  if (data.startsWith("cancel_order_")) {
    const oId = parseInt(data.replace("cancel_order_", ""));
    const o = dbGet(`SELECT * FROM orders WHERE id=${oId}`);
    if (!o) return answer(cq.id, "سفارش یافت نشد.", true);
    if (o.user_id !== user.id) return answer(cq.id, "این سفارش مال شما نیست.", true);
    dbRun(`UPDATE orders SET status='cancelled', updated_at=unixepoch() WHERE id=${oId}`);
    try { await deleteMsg(chatId, msgId); } catch (e) { await edit(chatId, msgId, `❌ <b>سفارش لغو شد. از منوی اصلی خرید کنید.</b>`); }
    await answer(cq.id, "سفارش لغو شد ✅");
    return;
  }

  // Admin callbacks (edit existing message)
  if (data === "admin_back") { if (isAdmin(tgId)) { const p = dbGet("SELECT COUNT(*) as c FROM orders WHERE status='pending_approval'")?.c || 0; const a = dbGet("SELECT COUNT(*) as c FROM orders WHERE status='approved'")?.c || 0; const t = dbGet("SELECT COUNT(*) as c FROM orders")?.c || 0; const co = dbGet("SELECT COUNT(*) as c FROM orders WHERE status='completed'")?.c || 0; const cn = dbGet("SELECT COUNT(*) as c FROM orders WHERE status='cancelled'")?.c || 0; const users = dbGet("SELECT COUNT(*) as c FROM users")?.c || 0; const gifts = dbGet("SELECT COUNT(*) as c FROM gifts WHERE is_active=1")?.c || 0; await edit(chatId, msgId, `💫 <b>══════════════════════</b>\n✨ <b>  ${BOT_NAME}  Panel  </b> ✨\n💫 <b>══════════════════════</b>\n\n📊 <b>آمار کلی</b>\n${SEPARATOR}\n🟠 <b>در انتظار تایید:</b>  <code>${p}</code>\n🟢 <b>تایید شده:</b>       <code>${a}</code>\n✅ <b>تکمیل شده:</b>       <code>${co}</code>\n📋 <b>کل سفارشات:</b>     <code>${t}</code>\n🚫 <b>لغو شده:</b>         <code>${cn}</code>\n👥 <b>کل کاربران:</b>      <code>${users}</code>\n🎁 <b>گیفت فعال:</b>       <code>${gifts}</code>\n${SEPARATOR}\n\nیکی از گزینه‌ها رو انتخاب کنید:`, { reply_markup: { inline_keyboard: [
        btnRow(BTN.danger(`🔍 در انتظار تایید  [${p}]`, "admin_pending")),
        btnRow(BTN.success(`🟢 تایید شده  [${a}]`, "admin_approved")),
        btnRow(BTN.success(`✅ تکمیل شده  [${co}]`, "admin_completed")),
        btnRow(BTN.primary(`📋 همه سفارشات  [${t}]`, "admin_all")),
        btnRow(BTN.neutral(`🚫 لغو شده  [${cn}]`, "admin_cancelled")),
        btnRow(BTN.primary(`📦 تکمیل سفارشات  [${a}]`, "admin_complete_list")),
        btnRow(BTN.primary("🎁 مدیریت گیفت‌ها", "admin_gifts")),
        btnRow(BTN.primary("⚙️ تنظیمات", "admin_settings")),
        btnRow(BTN.primary("📢 ارسال پیام همگانی", "admin_broadcast")),
        btnRow(BTN.info("📋 گزارش فیک", "admin_fake_report")),
        btnRow(BTN.primary("🔎 جستجوی سفارش", "admin_search")),
        btnRow(BTN.danger("⚠️ Danger Zone", "admin_danger")),
      ]}}); } return answer(cq.id); }
  if (data === "admin_pending") { if (isAdmin(tgId)) { const rows = dbAll("SELECT * FROM orders WHERE status='pending_approval' ORDER BY id DESC"); const ps = 5; const pages = Math.ceil(rows.length / ps); const pageRows = rows.slice(0, ps); let text = `📋 <b>سفارشات در انتظار تایید</b>\n${SEPARATOR}\n\n`; const nav = []; for (const o of pageRows) { const u = dbGet(`SELECT * FROM users WHERE id=${o.user_id}`); const d = new Date(o.created_at * 1000); const time = `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`; const tIcon = typeIcon(o.type); text += `🟠 <b><code>${o.code}</code></b>  ${tIcon}\n   👤 @${u?.username || "ندارد"}  •  ⭐ ${o.star_count}  •  💰 ${fmtPrice(o.price_toman)}\n   📅 ${d.toLocaleDateString("fa-IR")}  🕐 ${time}\n\n`; nav.push(btnRow(BTN.success(`✅ تایید ${o.code}`, `approve_${o.id}`))); } if (pages > 1) { const r = []; if (0 > 0) r.push({ text: "◀️", callback_data: "admin_page_pending_approval_0" }); r.push({ text: `📄 1/${pages}`, callback_data: "noop" }); if (0 < pages - 1) r.push({ text: "▶️", callback_data: "admin_page_pending_approval_1" }); nav.push(r); } nav.push([BTN.neutral("🔙 بازگشت", "admin_back")]); await edit(chatId, msgId, text, { reply_markup: { inline_keyboard: nav } }); } return answer(cq.id); }
  if (data === "admin_approved") { if (isAdmin(tgId)) { const rows = dbAll("SELECT * FROM orders WHERE status='approved' ORDER BY id DESC"); const ps = 5; const pages = Math.ceil(rows.length / ps); const pageRows = rows.slice(0, ps); let text = `📋 <b>سفارشات تایید شده</b>\n${SEPARATOR}\n\n`; const nav = []; for (const o of pageRows) { const u = dbGet(`SELECT * FROM users WHERE id=${o.user_id}`); const d = new Date(o.created_at * 1000); const time = `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`; const tIcon = typeIcon(o.type); text += `🟢 <b><code>${o.code}</code></b>  ${tIcon}\n   👤 @${u?.username || "ندارد"}  •  ⭐ ${o.star_count}  •  💰 ${fmtPrice(o.price_toman)}\n   📅 ${d.toLocaleDateString("fa-IR")}  🕐 ${time}\n\n`; nav.push(btnRow(BTN.success(`✅ تکمیل ${o.code}`, `complete_${o.id}`), BTN.danger(`🚫 لغو ${o.code}`, `cancel_${o.id}`))); } nav.push([BTN.neutral("🔙 بازگشت", "admin_back")]); await edit(chatId, msgId, text, { reply_markup: { inline_keyboard: nav } }); } return answer(cq.id); }
  if (data === "admin_completed") { if (isAdmin(tgId)) { const rows = dbAll("SELECT * FROM orders WHERE status='completed' ORDER BY id DESC"); const ps = 5; const pages = Math.ceil(rows.length / ps); const pageRows = rows.slice(0, ps); let text = `📋 <b>سفارشات تکمیل شده</b>\n${SEPARATOR}\n\n`; const nav = []; for (const o of pageRows) { const u = dbGet(`SELECT * FROM users WHERE id=${o.user_id}`); const d = new Date(o.created_at * 1000); const time = `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`; const tIcon = typeIcon(o.type); text += `✅ <b><code>${o.code}</code></b>  ${tIcon}\n   👤 @${u?.username || "ندارد"}  •  ⭐ ${o.star_count}  •  💰 ${fmtPrice(o.price_toman)}\n   📅 ${d.toLocaleDateString("fa-IR")}  🕐 ${time}\n\n`; } nav.push([BTN.neutral("🔙 بازگشت", "admin_back")]); await edit(chatId, msgId, text, { reply_markup: { inline_keyboard: nav } }); } return answer(cq.id); }

  // Admin gift management
  if (data === "admin_gifts") {
    if (!isAdmin(tgId)) return answer(cq.id);
    const gifts = dbAll("SELECT * FROM gifts ORDER BY sort_order ASC");
    let text = `🎁 <b>مدیریت گیفت‌ها</b>\n${SEPARATOR}\n\n`;
    if (gifts.length) {
      for (const g of gifts) {
        const st = g.is_active ? "🟢" : "🔴";
        text += `${st} <code>${g.id}</code> ${g.emoji} <b>${g.name}</b> — ⭐${g.star_count}\n`;
      }
    } else {
      text += `📭 گیفتی وجود ندارد.\n`;
    }
    text += `\n${SEPARATOR}\n`;
    text += `📝 <b>دستورات:</b>\n`;
    text += `<code>/addgift</code> — اضافه کردن (مرحله‌ای)\n`;
    text += `<code>/delgift [ID]</code> — حذف\n`;
    text += `<code>/tgift [ID]</code> — فعال/غیرفعال`;
    await send(chatId, text, { reply_markup: { inline_keyboard: [
      [BTN.success("🎁 اضافه کردن گیفت جدید", "admin_addgift")],
      [BTN.neutral("🔙 بازگشت", "admin_back")],
    ]}});
    return answer(cq.id);
  }

  // Admin: Add gift callback
  if (data === "admin_addgift") {
    if (!isAdmin(tgId)) return answer(cq.id);
    dbRun(`UPDATE users SET admin_state='addgift_name', updated_at=unixepoch() WHERE telegram_id=${tgId}`);
    await send(chatId, `🎁 <b>اضافه کردن گیفت جدید</b>\n${SEPARATOR}\n\n📝 <b>مرحله ۱ از ۴:</b>\n\nاسم گیفت رو بنویسید:\n(مثال: گیفت طلایی)`,
      { reply_markup: { inline_keyboard: [[BTN.danger("❌ انصراف", "admin_cancel_addgift")]] } }
    );
    return answer(cq.id);
  }

  // Admin: Skip description in addgift wizard
  if (data === "addgift_desc_skip") {
    if (!isAdmin(tgId)) return answer(cq.id);
    if (user.admin_state !== "addgift_desc") return answer(cq.id, "منقضی شد — دوباره /addgift بزنید.", true);
    const base = String(user.admin_state_data || "").split("|").slice(0, 3).join("|");
    dbRun(`UPDATE users SET admin_state='addgift_id', admin_state_data='${base}|', updated_at=unixepoch() WHERE telegram_id=${tgId}`);
    await edit(chatId, msgId,
      `🎁 <b>اضافه کردن گیفت جدید</b>\n${SEPARATOR}\n\n` +
      `📝 <b>مرحله ۵ از ۵:</b>\n\n` +
      `توضیحات: —\n\n` +
      `🔢 عددی که زیر عکس توی کانال گذاشتید رو بنویسید:\n(مثال: 1)`,
      { reply_markup: { inline_keyboard: [[BTN.danger("❌ انصراف", "admin_cancel_addgift")]] } }
    );
    return answer(cq.id);
  }

  // Admin: Cancel add gift
  if (data === "admin_cancel_addgift") {
    if (!isAdmin(tgId)) return answer(cq.id);
    dbRun(`UPDATE users SET admin_state=NULL, admin_state_data=NULL, updated_at=unixepoch() WHERE telegram_id=${tgId}`);
    await edit(chatId, msgId, `❌ <b>اضافه کردن گیفت لغو شد.</b>`);
    await answer(cq.id);
    return;
  }

  // Admin: Confirm add gift
  if (data === "admin_confirm_gift") {
    if (!isAdmin(tgId)) return answer(cq.id);
    const freshUserData = dbGet(`SELECT * FROM users WHERE id=${user.id}`) || user;
    const parts = String(freshUserData.admin_state_data || "").split("|");
    if (parts.length !== 5) {
      dbRun(`UPDATE users SET admin_state=NULL, admin_state_data=NULL WHERE telegram_id=${tgId}`);
      return answer(cq.id, "منقضی شد — دوباره /addgift بزنید.", true);
    }
    const giftName = parts[0], starCount = parseInt(parts[1]), emoji = parts[2], desc = parts[3], captionNum = parts[4];
    dbRun(`UPDATE users SET admin_state=NULL, admin_state_data=NULL, updated_at=unixepoch() WHERE telegram_id=${tgId}`);
    const imageFileId = globalThis.giftImageCache?.[captionNum] || null;
    const maxOrder = dbGet("SELECT MAX(sort_order) as m FROM gifts")?.m || 0;
    dbRun(`INSERT INTO gifts (name, emoji, star_count, gift_id, description, image_file_id, sort_order) VALUES ('${giftName.replace(/'/g, "''")}', '${emoji}', ${starCount}, '${captionNum.replace(/'/g, "''")}', ${desc ? `'${desc.replace(/'/g, "''")}'` : "NULL"}, ${imageFileId ? `'${imageFileId}'` : "NULL"}, ${maxOrder + 1})`);
    const rate = getNumSetting("exchange_rate");
    const price = starCount * rate;
    if (imageFileId) {
      await edit(chatId, msgId, `✅ <b>گیفت ذخیره شد!</b>\n\n${emoji} <b>${giftName}</b> — ⭐ ${starCount} — 💰 ${fmtPrice(price)} تومان`);
      await sendPhoto(chatId, imageFileId, `${emoji} <b>${giftName}</b>\n⭐ ${starCount} ستاره — 💰 ${fmtPrice(price)} تومان`,
        { reply_markup: { inline_keyboard: [[BTN.success("🎁 اضافه کردن گیفت جدید", "admin_addgift")], [{ text: "🔙 بازگشت به منو", callback_data: "admin_back" }]] } }
      );
    } else {
      await edit(chatId, msgId, `✅ <b>گیفت ذخیره شد!</b>\n\n${emoji} <b>${giftName}</b> — ⭐ ${starCount} — 💰 ${fmtPrice(price)} تومان`,
        { reply_markup: { inline_keyboard: [[BTN.success("🎁 اضافه کردن گیفت جدید", "admin_addgift")], [{ text: "🔙 بازگشت به منو", callback_data: "admin_back" }]] } }
      );
    }
    return answer(cq.id);
  }

  // Admin: Complete orders list
  if (data === "admin_complete_list") {
    if (!isAdmin(tgId)) return answer(cq.id);
    const rows = dbAll("SELECT * FROM orders WHERE status='approved' ORDER BY id DESC");
    if (!rows.length) {
      await send(chatId, `📭 <b>سفارش تایید شده‌ای برای تکمیل وجود ندارد.</b>`, { reply_markup: { inline_keyboard: [[BTN.neutral("🔙 بازگشت", "admin_back")]] } });
      return answer(cq.id);
    }
    let text = `📦 <b>سفارشات آماده تکمیل</b>\n${SEPARATOR}\n\n`;
    const buttons = [];
    for (const o of rows) {
      const u = dbGet(`SELECT * FROM users WHERE id=${o.user_id}`);
      const tIcon = typeIcon(o.type);
      const d = new Date(o.created_at * 1000);
      const time = `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
      text += `🟢 <b><code>${o.code}</code></b> ${tIcon}\n`;
      text += `   👤 @${u?.username || "ندارد"}  •  ⭐ ${o.star_count}  •  💰 ${fmtPrice(o.price_toman)}\n`;
      text += `   📅 ${d.toLocaleDateString("fa-IR")}  🕐 ${time}\n\n`;
      buttons.push(btnRow(BTN.success(`✅ تکمیل ${o.code}`, `complete_${o.id}`), BTN.danger(`🚫 لغو ${o.code}`, `cancel_${o.id}`)));
    }
    buttons.push([BTN.neutral("🔙 بازگشت", "admin_back")]);
    await send(chatId, text, { reply_markup: { inline_keyboard: buttons } });
    return answer(cq.id);
  }

  // Admin broadcast
  if (data === "admin_broadcast") {
    if (!isAdmin(tgId)) return answer(cq.id);
    dbRun(`UPDATE users SET admin_state='awaiting_broadcast', updated_at=unixepoch() WHERE telegram_id=${tgId}`);
    await send(chatId,
      `📢 <b>ارسال پیام همگانی</b>\n${SEPARATOR}\n\n` +
      `پیامی که می‌خواهید به همه کاربران ارسال شه رو بنویسید:\n\n` +
      `💡 از HTML استفاده کنید:\n` +
      `<code>&lt;b&gt;بولد&lt;/b&gt;</code>\n` +
      `<code>&lt;a href="url"&gt;لینک&lt;/a&gt;</code>`,
      { reply_markup: { inline_keyboard: [[BTN.danger("انصراف", "admin_back")]] } }
    );
    return answer(cq.id);
  }

  // ===== Fake Report Wizard — step 1: fake ID + product type =====
  if (data === "admin_fake_report") {
    if (!isAdmin(tgId)) return answer(cq.id);
    const ch = dbGet("SELECT * FROM channels WHERE is_active=1");
    if (!ch) return answer(cq.id, "❌ اول کانال گزارشات رو تنظیم کنید.", true);
    const fakeId = genFakeId();
    dbRun(`UPDATE users SET admin_state='fr_type', admin_state_data='${fakeId}', updated_at=unixepoch() WHERE telegram_id=${tgId}`);
    await edit(chatId, msgId,
      `📋 <b>گزارش فیک</b>\n${SEPARATOR}\n\n` +
      `👤 آیدی فیک ساخته شد: <code>${maskId(fakeId)}</code>\n\n` +
      `گزارش برای چه محصولیه؟`,
      { reply_markup: { inline_keyboard: [
        [BTN.success("⭐ استار", "fr_type_star"), BTN.success("👤 ممبر", "fr_type_member")],
        [BTN.success("🎁 گیفت", "fr_type_gift")],
        [BTN.danger("❌ انصراف", "fr_cancel")],
      ]}}
    );
    return answer(cq.id);
  }

  // ===== Fake Report Wizard — step 2: product chosen =====
  if (data.startsWith("fr_type_")) {
    if (!isAdmin(tgId)) return answer(cq.id, "ادمین نیستید.", true);
    if (user.admin_state !== "fr_type") return answer(cq.id, "منقضی شد — دوباره از منو شروع کنید.", true);
    const fakeId = String(user.admin_state_data);
    const type = data.replace("fr_type_", "");

    if (type === "gift") {
      const gifts = dbAll("SELECT * FROM gifts WHERE is_active=1 ORDER BY sort_order ASC");
      if (!gifts.length) {
        dbRun(`UPDATE users SET admin_state=NULL, updated_at=unixepoch() WHERE telegram_id=${tgId}`);
        await edit(chatId, msgId, "📭 هیچ گیفی ثبت نشده. اول با /addgift گیفت اضافه کنید.");
        return answer(cq.id);
      }
      dbRun(`UPDATE users SET admin_state='fr_gift', updated_at=unixepoch() WHERE telegram_id=${tgId}`);
      const buttons = gifts.map(g => [BTN.neutral(`${g.emoji} ${g.name}  (⭐${g.star_count})`, `fr_gift_${g.id}`)]);
      buttons.push([BTN.danger("❌ انصراف", "fr_cancel")]);
      await edit(chatId, msgId,
        `📋 <b>گزارش فیک — انتخاب گیفت</b>\n${SEPARATOR}\n\nکدوم گیفت گزارش بشه؟`,
        { reply_markup: { inline_keyboard: buttons } }
      );
      return answer(cq.id);
    }

    // star / member → عدد لازمه
    dbRun(`UPDATE users SET admin_state='fr_count', admin_state_data='${fakeId}|${type}', updated_at=unixepoch() WHERE telegram_id=${tgId}`);
    const label = type === "star"
      ? `⭐ <b>تعداد ستاره</b> رو بفرستید:\n(مثال: <code>500</code>)`
      : `👥 <b>تعداد ممبر</b> رو بفرستید (مضرب ۱۰۰):\n(مثال: <code>500</code>)`;
    await edit(chatId, msgId,
      `📋 <b>گزارش فیک — ${type === "star" ? "استار" : "ممبر"}</b>\n${SEPARATOR}\n\n${label}`,
      { reply_markup: { inline_keyboard: [[BTN.danger("❌ انصراف", "fr_cancel")]] } }
    );
    return answer(cq.id);
  }

  // ===== Fake Report Wizard — step 3: gift selected → send =====
  if (data.startsWith("fr_gift_")) {
    if (!isAdmin(tgId)) return answer(cq.id, "ادمین نیستید.", true);
    if (user.admin_state !== "fr_gift") return answer(cq.id, "منقضی شد.", true);
    const fakeId = parseInt(user.admin_state_data);
    const g = dbGet(`SELECT * FROM gifts WHERE id=${parseInt(data.replace("fr_gift_", ""))} AND is_active=1`);
    if (!g || !fakeId) return answer(cq.id, "منقضی شد — دوباره از منو شروع کنید.", true);
    dbRun(`UPDATE users SET admin_state=NULL, admin_state_data=NULL, updated_at=unixepoch() WHERE telegram_id=${tgId}`);
    const rate = getNumSetting("exchange_rate");
    const ok = await sendFakeReport(chatId, {
      fakeId,
      typeLabel: `🎁 گیفت : ${g.emoji} ${esc(g.name)}`,
      count: g.star_count,
      price: g.star_count * rate,
    });
    if (ok) await edit(chatId, msgId,
      `✅ <b>گزارش فیک ارسال شد!</b>\n\n📦 ${esc(g.name)}  •  ⭐ ${g.star_count}\n👤 <code>${maskId(fakeId)}</code>`);
    return answer(cq.id, ok ? "ارسال شد ✅" : undefined);
  }

  // ===== Fake Report Wizard — cancel =====
  if (data === "fr_cancel") {
    if (!isAdmin(tgId)) return answer(cq.id);
    dbRun(`UPDATE users SET admin_state=NULL, admin_state_data=NULL, updated_at=unixepoch() WHERE telegram_id=${tgId}`);
    await edit(chatId, msgId, `❌ <b>گزارش فیک لغو شد.</b>`);
    return answer(cq.id);
  }

  // Admin: Danger zone
  if (data === "admin_danger") {
    if (!isAdmin(tgId)) return answer(cq.id);
    dbRun(`UPDATE users SET admin_state='awaiting_danger_confirm', updated_at=unixepoch() WHERE telegram_id=${tgId}`);
    await send(chatId,
      `🔴 <b>Danger Zone</b>\n${SEPARATOR}\n\n` +
      `⚠️ <b>هشدار:</b> این عملیات غیرقابل بازگشت است!\n\n` +
      `🗑️ <b>چیزی که حذف میشه:</b>\n` +
      `   • همه سفارشات\n` +
      `   • همه کاربران\n` +
      `   • همه تنظیمات\n\n` +
      `🔒 <b>چیزی که حفظ میشه:</b>\n` +
      `   • توکن ربات\n` +
      `   • آیدی ادمین‌ها\n` +
      `   • لیست گیفت‌ها\n` +
      `   • کانال گزارشات\n\n` +
      `${SEPARATOR}\n` +
      `📝 برای تایید، کلمه رو بفرستید:\n` +
      `<code>DangerZone</code>`,
      { reply_markup: { inline_keyboard: [[BTN.danger("انصراف", "admin_back")]] } }
    );
    return answer(cq.id);
  }

  if (data === "admin_all") { if (isAdmin(tgId)) await showOrders(chatId, "all"); return answer(cq.id); }
  if (data === "admin_cancelled") { if (isAdmin(tgId)) await showOrders(chatId, "cancelled"); return answer(cq.id); }
  if (data === "admin_settings") {
    if (isAdmin(tgId)) {
      await editSmart(chatId, msgId, settingsPanelText(), settingsPanelKb());
    }
    return answer(cq.id);
  }
  if (data.startsWith("admin_page_")) { if (isAdmin(tgId)) { const p = data.split("_"); await showOrders(chatId, p[2], parseInt(p[3]) || 0); } return answer(cq.id); }
  if (data.startsWith("admin_order_")) { if (isAdmin(tgId)) await orderDetail(chatId, parseInt(data.replace("admin_order_", ""))); return answer(cq.id); }

  // ==================== SETTINGS EDIT CALLBACKS ====================

  // Edit card number
  if (data === "set_edit_card") {
    if (!isAdmin(tgId)) return answer(cq.id);
    dbRun(`UPDATE users SET admin_state='set_awaiting_card', updated_at=unixepoch() WHERE telegram_id=${tgId}`);
    await send(chatId,
      `💳 <b>تغییر شماره کارت</b>\n${SEPARATOR}\n\n` +
      `شماره کارت فعلی: <code>${getSetting("card_number")}</code>\n\n` +
      `📝 شماره کارت جدید رو بفرستید:\n(مثال: <code>6037-1234-5678-9012</code>)`,
      { reply_markup: { inline_keyboard: [[BTN.danger("❌ انصراف", "admin_settings")]] } }
    );
    return answer(cq.id);
  }

  // Edit exchange rate
  if (data === "set_edit_rate") {
    if (!isAdmin(tgId)) return answer(cq.id);
    dbRun(`UPDATE users SET admin_state='set_awaiting_rate', updated_at=unixepoch() WHERE telegram_id=${tgId}`);
    await send(chatId,
      `💱 <b>تغییر نرخ تبدیل</b>\n${SEPARATOR}\n\n` +
      `نرخ فعلی: <code>${fmtPrice(getNumSetting("exchange_rate"))}</code> تومان/ستاره\n\n` +
      `📝 نرخ جدید (تومان به ازای هر ستاره) رو بفرستید:\n(مثال: <code>5000</code>)`,
      { reply_markup: { inline_keyboard: [[BTN.danger("❌ انصراف", "admin_settings")]] } }
    );
    return answer(cq.id);
  }

  // Edit member price
  if (data === "set_edit_member") {
    if (!isAdmin(tgId)) return answer(cq.id);
    dbRun(`UPDATE users SET admin_state='set_awaiting_member', updated_at=unixepoch() WHERE telegram_id=${tgId}`);
    await send(chatId,
      `👤 <b>تغییر قیمت ممبر</b>\n${SEPARATOR}\n\n` +
      `قیمت فعلی (هر ۱۰۰ ممبر): <code>${fmtPrice(getNumSetting("member_price"))}</code> تومان\n\n` +
      `📝 قیمت جدید (تومان به ازای هر ۱۰۰ ممبر) رو بفرستید:\n(مثال: <code>21000</code>)`,
      { reply_markup: { inline_keyboard: [[BTN.danger("❌ انصراف", "admin_settings")]] } }
    );
    return answer(cq.id);
  }

  // Edit support username
  if (data === "set_edit_support") {
    if (!isAdmin(tgId)) return answer(cq.id);
    const sup = (getSetting("support_username") || DEFAULT_SETTINGS.support_username).replace(/^@/, "");
    dbRun(`UPDATE users SET admin_state='set_awaiting_support', updated_at=unixepoch() WHERE telegram_id=${tgId}`);
    await send(chatId,
      `💬 <b>تغییر پشتیبانی</b>\n${SEPARATOR}\n\n` +
      `پشتیبان فعلی: <code>@${sup}</code>\n\n` +
      `📝 یوزرنیم پشتیبان جدید رو بفرستید:\n(مثال: <code>@support_admin</code>)`,
      { reply_markup: { inline_keyboard: [[BTN.danger("❌ انصراف", "admin_settings")]] } }
    );
    return answer(cq.id);
  }

  // Edit log channel
  if (data === "set_edit_log") {
    if (!isAdmin(tgId)) return answer(cq.id);
    const channel = dbGet("SELECT * FROM channels WHERE is_active=1");
    dbRun(`UPDATE users SET admin_state='set_awaiting_log', updated_at=unixepoch() WHERE telegram_id=${tgId}`);
    await send(chatId,
      `📣 <b>تغییر کانال گزارشات</b>\n${SEPARATOR}\n\n` +
      `کانال فعلی: ${channel ? `<code>${channel.channel_id}</code> (${channel.channel_name || "-"})` : "❌ تنظیم نشده"}\n\n` +
      `📝 آیدی یا یوزرنیم کانال جدید رو بفرستید:\n(مثال: <code>@pepestarLOG</code> یا <code>-1001234567890</code>)\n\n` +
      `📌 ربات رو به‌عنوان ادمین با قابلیت ارسال پیام در کانال اضافه کنید.`,
      { reply_markup: { inline_keyboard: [[BTN.danger("❌ انصراف", "admin_settings")]] } }
    );
    return answer(cq.id);
  }

  // Edit image channel
  if (data === "set_edit_img") {
    if (!isAdmin(tgId)) return answer(cq.id);
    const imgChannel = dbGet("SELECT * FROM img_channel LIMIT 1");
    dbRun(`UPDATE users SET admin_state='set_awaiting_img', updated_at=unixepoch() WHERE telegram_id=${tgId}`);
    await send(chatId,
      `🖼️ <b>تغییر کانال عکس گیفت‌ها</b>\n${SEPARATOR}\n\n` +
      `کانال فعلی: ${imgChannel ? `<code>${imgChannel.channel_id}</code> (${imgChannel.channel_name || "-"})` : "❌ تنظیم نشده"}\n\n` +
      `📝 آیدی یا یوزرنیم کانال جدید رو بفرستید:\n(مثال: <code>@giftschannel</code> یا <code>-1001234567890</code>)\n\n` +
      `📌 ربات رو به‌عنوان ادمین با قابلیت <b>خواندن پیام</b> در کانال اضافه کنید.`,
      { reply_markup: { inline_keyboard: [[BTN.danger("❌ انصراف", "admin_settings")]] } }
    );
    return answer(cq.id);
  }

  // Edit must-join channels
  if (data === "set_edit_must") {
    if (!isAdmin(tgId)) return answer(cq.id);
    const list = dbAll("SELECT * FROM must_channels ORDER BY id ASC");
    let text = `📢 <b>کانال‌های الزامی</b>\n${SEPARATOR}\n\n`;
    const buttons = [];
    if (list.length) {
      for (const ch of list) {
        const username = ch.channel_name ? ch.channel_name.replace("@", "") : "";
        const link = username ? `https://t.me/${username}` : `https://t.me/c/${ch.channel_id.toString().replace("-100", "")}`;
        text += `• <a href="${link}">${ch.channel_name || ch.channel_id}</a>\n`;
        buttons.push([BTN.danger(`🗑️ حذف ${ch.channel_name || ch.channel_id}`, `set_must_remove_${ch.channel_id}`)]);
      }
      text += `\n`;
    } else {
      text += `📭 هیچ کانال الزامی تنظیم نشده.\n\n`;
    }
    text += `${SEPARATOR}\n`;
    text += `📝 آیدی یا یوزرنیم کانال جدید رو بفرستید تا اضافه بشه:\n(مثال: <code>@channelname</code>)`;
    buttons.push([BTN.success("➕ افزودن کانال", "set_must_add")]);
    buttons.push([BTN.neutral("🔙 بازگشت به تنظیمات", "admin_settings")]);
    await send(chatId, text, { reply_markup: { inline_keyboard: buttons } });
    return answer(cq.id);
  }

  // Must channel add
  if (data === "set_must_add") {
    if (!isAdmin(tgId)) return answer(cq.id);
    dbRun(`UPDATE users SET admin_state='set_awaiting_must_add', updated_at=unixepoch() WHERE telegram_id=${tgId}`);
    await send(chatId,
      `📢 <b>افزودن کانال الزامی</b>\n${SEPARATOR}\n\n` +
      `📝 آیدی یا یوزرنیم کانال رو بفرستید:\n(مثال: <code>@channelname</code>)`,
      { reply_markup: { inline_keyboard: [[BTN.danger("❌ انصراف", "set_edit_must")]] } }
    );
    return answer(cq.id);
  }

  // Must channel remove
  if (data.startsWith("set_must_remove_")) {
    if (!isAdmin(tgId)) return answer(cq.id);
    const channelId = parseInt(data.replace("set_must_remove_", ""));
    const ch = dbGet(`SELECT * FROM must_channels WHERE channel_id=${channelId}`);
    if (ch) {
      dbRun(`DELETE FROM must_channels WHERE channel_id=${channelId}`);
      await answer(cq.id, `🗑️ ${ch.channel_name || channelId} حذف شد.`);
    }
    // Re-show the must channels panel
    const list = dbAll("SELECT * FROM must_channels ORDER BY id ASC");
    let text = `📢 <b>کانال‌های الزامی</b>\n${SEPARATOR}\n\n`;
    const buttons = [];
    if (list.length) {
      for (const ch2 of list) {
        const username = ch2.channel_name ? ch2.channel_name.replace("@", "") : "";
        const link = username ? `https://t.me/${username}` : `https://t.me/c/${ch2.channel_id.toString().replace("-100", "")}`;
        text += `• <a href="${link}">${ch2.channel_name || ch2.channel_id}</a>\n`;
        buttons.push([BTN.danger(`🗑️ حذف ${ch2.channel_name || ch2.channel_id}`, `set_must_remove_${ch2.channel_id}`)]);
      }
      text += `\n`;
    } else {
      text += `📭 هیچ کانال الزامی تنظیم نشده.\n\n`;
    }
    text += `${SEPARATOR}\n`;
    text += `📝 آیدی یا یوزرنیم کانال جدید رو بفرستید تا اضافه بشه:\n(مثال: <code>@channelname</code>)`;
    buttons.push([BTN.success("➕ افزودن کانال", "set_must_add")]);
    buttons.push([BTN.neutral("🔙 بازگشت به تنظیمات", "admin_settings")]);
    await edit(chatId, msgId, text, { reply_markup: { inline_keyboard: buttons } });
    return;
  }

  // Buy
  if (data.startsWith("buy_")) {
    const oId = parseInt(data.replace("buy_", "")), o = dbGet(`SELECT * FROM orders WHERE id=${oId}`);
    if (!o) return answer(cq.id, "سفارش یافت نشد.", true);
    if (o.user_id !== user.id) return answer(cq.id, "این سفارش مال شما نیست.", true);
    const cn = getSetting("card_number"), ch = getSetting("card_holder_name");
    dbRun(`UPDATE users SET state='awaiting_receipt', updated_at=unixepoch() WHERE id=${user.id}`);
    const paymentText =
      `💳 <b>اطلاعات پرداخت</b>\n${SEPARATOR}\n\n` +
      `💳 <b>شماره کارت:</b>\n<code>${cn}</code>\n\n` +
      `👤 <b>صاحب کارت:</b>  ${ch}\n\n` +
      `💰 <b>مبلغ قابل پرداخت:</b>\n` +
      `<b><code>${fmtPrice(o.price_toman)} تومان</code></b>\n\n` +
      `${SEPARATOR}\n` +
      `📸 <b>مرحله بعد:</b> عکس رسید پرداخت رو بفرستید.`;
    // Dynamic back button based on order type (NULL-safe for legacy orders)
    const paymentKb = { reply_markup: { inline_keyboard: [
      [BTN.danger("❌  انصراف از خرید", `stopbuy_${o.id}`)],
    ]}};
    await editSmart(chatId, msgId, paymentText, paymentKb);
    return answer(cq.id);
  }

  // User cancels from payment page
  if (data.startsWith("stopbuy_")) {
    const oId = parseInt(data.replace("stopbuy_", ""));
    const o = dbGet(`SELECT * FROM orders WHERE id=${oId}`);
    if (o && o.user_id === user.id && o.status === "pending") {
      dbRun(`UPDATE orders SET status='cancelled', updated_at=unixepoch() WHERE id=${oId}`);
    }
    resetUserState(user.id);
    await editSmart(chatId, msgId, `❌ <b>خرید لغو شد.</b>\nاز منوی زیر ادامه بدید:`, mainMenuKb());
    return answer(cq.id, "لغو شد");
  }

  // Star quick-buy buttons
  if (data.startsWith("star_q_")) {
    const sc = parseInt(data.replace("star_q_", ""));
    if (!sc || sc <= 0) return answer(cq.id, "عدد نامعتبر", true);
    cancelStalePending(user.id);
    resetUserState(user.id);
    const rate = getNumSetting("exchange_rate"), price = sc * rate, code = genCode();
    dbRun(`INSERT INTO orders (code, user_id, gift_link, type, star_count, price_toman, status) VALUES ('${code}', ${user.id}, 'سفارش دستی', 'star', ${sc}, ${price}, 'pending')`);
    const o = dbGet(`SELECT * FROM orders WHERE code='${code}'`);
    await editSmart(chatId, msgId,
      `🌟 <b>سفارش استار</b>\n${SEPARATOR}\n\n` +
      `⭐ <b>تعداد ستاره:</b>  <code>${sc}</code>\n` +
      `💰 <b>قیمت:</b>  <code>${fmtPrice(price)}</code> تومان\n\n${SEPARATOR}\nبرای ادامه خرید:`,
      { reply_markup: { inline_keyboard: [
        [BTN.success("🛒  شروع خرید", `buy_${o.id}`)],
        [BTN.danger("❌  انصراف", `stopbuy_${o.id}`)],
      ]}}
    );
    return answer(cq.id);
  }

  // Paid
  if (data.startsWith("paid_")) {
    const oId = parseInt(data.replace("paid_", "")), o = dbGet(`SELECT * FROM orders WHERE id=${oId}`);
    if (!o) return answer(cq.id, "سفارش یافت نشد.", true);
    if (o.user_id !== user.id) return answer(cq.id, "این سفارش مال شما نیست.", true);
    if (o.status !== "receipt_sent") return answer(cq.id, "وضعیت نامعتبر.", true);
    dbRun(`UPDATE orders SET status='pending_approval', updated_at=unixepoch() WHERE id=${oId}`);
    dbRun(`UPDATE users SET state='idle', updated_at=unixepoch() WHERE id=${user.id}`);
    await editKb(chatId, msgId, undefined);
    await send(chatId,
      `✅ <b>سفارش ثبت شد!</b>\n${SEPARATOR}\n\n` +
      `🔑 کد سفارش: <code>${o.code}</code>\n` +
      `⏳ وضعیت: <b>در انتظار تایید ادمین</b>\n\n` +
      `لطفاً صبر کنید... ⏳`
    );
    // Notify admins
    const typeLabel = o.type === "star" ? "🌟 استارز تلگرام" : o.type === "member" ? "👤 ممبر بدون ریزش" : `🎁 گیفت : ${o.gift_name || "نامشخص"}`;
    const targetInfo = o.type === "member" ? `\n📍 <b>هدف:</b> <code>${o.gift_link}</code>` : "";
    const cap = `🔔 <b>═══ سفارش جدید ═══</b>\n\n👤 <b>کاربر:</b> @${username || "ندارد"} (${firstName})\n🆔 <b>آیدی:</b> <code>${tgId}</code>\n📦 <b>نوع:</b> ${typeLabel}\n👀 <b>تعداد:</b> <code>${o.star_count}</code>${targetInfo}\n💰 <b>قیمت:</b> <code>${fmtPrice(o.price_toman)}</code> تومان\n🔑 <b>کد:</b> <code>${o.code}</code>`;
    const kb = { inline_keyboard: [
      btnRow(BTN.success("✅  تایید", `approve_${oId}`), BTN.danger("❌  رد", `rejectq_${oId}`)),
    ]};
    for (const adminId of ADMIN_IDS) { if (o.receipt_file_id) await sendPhoto(adminId, o.receipt_file_id, cap, { reply_markup: kb }); else await send(adminId, cap, { reply_markup: kb }); }
    return answer(cq.id, "ارسال شد.");
  }

  // Admin: order detail view (from any list) — admin_order_{id}_{fromStatus}
  if (data.startsWith("admin_order_")) {
    if (!isAdmin(tgId)) return answer(cq.id);
    const rest = data.replace("admin_order_", "");
    const oId = parseInt(rest);
    const fromStatus = rest.slice(String(oId).length + 1) || null;
    await renderOrderDetail(chatId, oId, msgId, fromStatus);
    return answer(cq.id);
  }

  // Admin: restore cancelled order → approved
  if (data.startsWith("restore_")) {
    if (!isAdmin(tgId)) return answer(cq.id, "ادمین نیستید.", true);
    const oId = parseInt(data.replace("restore_", ""));
    const o = dbGet(`SELECT * FROM orders WHERE id=${oId}`);
    if (!o) return answer(cq.id, "یافت نشد.", true);
    if (o.status !== "cancelled") return answer(cq.id, "فقط سفارش لغوشده قابل بازگردانیه.", true);
    dbRun(`UPDATE orders SET status='approved', updated_at=unixepoch() WHERE id=${oId}`);
    const u = dbGet(`SELECT * FROM users WHERE id=${o.user_id}`);
    if (u) { try { await send(u.telegram_id, `✅ <b>سفارش <code>${o.code}</code> شما تایید شد.</b>\nبه‌زودی انجام و تحویل داده میشه.`); } catch {} }
    await answer(cq.id, "بازگردانی شد ✅");
    await renderOrderDetail(chatId, oId, msgId, null);
    return;
  }

  // Admin: start order search
  if (data === "admin_search") {
    if (!isAdmin(tgId)) return answer(cq.id);
    dbRun(`UPDATE users SET admin_state='admin_search', updated_at=unixepoch() WHERE telegram_id=${tgId}`);
    await send(chatId,
      `🔎 <b>جستجوی سفارش</b>\n${SEPARATOR}\n\n` +
      `کد سفارش یا شناسه عددی رو بفرستید:\n(مثال: <code>QP4PGV</code> یا <code>42</code>)\n\n` +
      `برای لغو: <code>/cancel</code>`,
      { reply_markup: { inline_keyboard: [[BTN.danger("❌ انصراف", "admin_back")]] } }
    );
    return answer(cq.id);
  }

  // Reject order (admin)
  if (data.startsWith("rejectq_")) {
    if (!isAdmin(tgId)) return answer(cq.id, "ادمین نیستید.", true);
    const oId = parseInt(data.replace("rejectq_", "")), o = dbGet(`SELECT * FROM orders WHERE id=${oId}`);
    if (!o) return answer(cq.id, "یافت نشد.", true);
    dbRun(`UPDATE orders SET status='cancelled', updated_at=unixepoch() WHERE id=${oId}`);
    await edit(chatId, msgId, `⚫ <b>سفارش ${o.code} رد شد.</b>`);
    const u = dbGet(`SELECT * FROM users WHERE id=${o.user_id}`);
    if (u) await send(u.telegram_id, `⚫ <b>پرداخت سفارش شما تایید نشد.</b>\n\n🔑 کد: <code>${o.code}</code>\n💬 برای اطلاعات بیشتر با پشتیبانی تماس بگیرید.`);
    return answer(cq.id, "رد شد.");
  }

  // Approve
  if (data.startsWith("approve_")) {
    if (!isAdmin(tgId)) return answer(cq.id, "ادمین نیستید.", true);
    const oId = parseInt(data.replace("approve_", "")), o = dbGet(`SELECT * FROM orders WHERE id=${oId}`);
    if (!o || o.status !== "pending_approval") return answer(cq.id, "نامعتبر.", true);
    dbRun(`UPDATE orders SET status='approved', updated_at=unixepoch() WHERE id=${oId}`);
    // Get admin username
    const adminUser = dbGet(`SELECT * FROM users WHERE telegram_id=${tgId}`);
    const adminDisplay = adminUser?.username ? `@${adminUser.username}` : `<code>${tgId}</code>`;
    await edit(chatId, msgId, `🟢 <b>سفارش ${o.code} تایید شد.</b> ✅\n\n👤 تاییدکننده: ${adminDisplay}`);
    await editKb(chatId, msgId, { inline_keyboard: [] });
    const u = dbGet(`SELECT * FROM users WHERE id=${o.user_id}`);
    if (u) {
      const typeLabel = o.type === "star" ? "🌟 استارز" : o.type === "member" ? "👤 ممبر" : `🎁 گیفت`;
      const nextStep = o.type === "member"
        ? `برای دریافت ممبر کد سفارش رو به ادمین ارسال کنین`
        : o.type === "star"
        ? `برای دریافت استارز، به ادمین کد رو ارسال کنید.`
        : `برای دریافت گیفت، به ادمین کد رو ارسال کنید.`;
      await send(u.telegram_id,
        `🟢 <b>سفارش شما تایید شد!</b>\n${SEPARATOR}\n\n` +
        `📦 <b>نوع:</b> ${typeLabel}\n` +
        `🔑 <b>کد:</b> <code>${o.code}</code>\n` +
        `👀 <b>تعداد:</b> <code>${o.star_count}</code>\n\n` +
        `👤 ادمین تاییدکننده: ${adminDisplay}\n\n` +
        `${SEPARATOR}\n` +
        nextStep
      );
    }
    setTimeout(() => adminMenu(chatId), 500);
    return answer(cq.id, "تایید شد.");
  }

  // Complete
  if (data.startsWith("complete_")) {
    if (!isAdmin(tgId)) return answer(cq.id, "ادمین نیستید.", true);
    const oId = parseInt(data.replace("complete_", "")), o = dbGet(`SELECT * FROM orders WHERE id=${oId}`);
    if (!o) return answer(cq.id, "یافت نشد.", true);
    dbRun(`UPDATE orders SET status='completed', updated_at=unixepoch() WHERE id=${oId}`);
    await edit(chatId, msgId, `✅ <b>سفارش ${o.code} تکمیل شد!</b> 🎉`);
    await editKb(chatId, msgId, { inline_keyboard: [] });
    const u = dbGet(`SELECT * FROM users WHERE id=${o.user_id}`);
    const typeLabel = o.type === "star" ? "🌟 استارز" : o.type === "member" ? "👤 ممبر" : `🎁 گیفت`;
    if (u) await send(u.telegram_id, `🎉 <b>تبریک! سفارش شما تکمیل شد!</b>\n\n📦 <b>نوع:</b> ${typeLabel}\n🔑 <b>کد:</b> <code>${o.code}</code>\n👀 <b>تعداد:</b> <code>${o.star_count}</code>\n\nامیدواریم از خریدتون لذت ببرید! ✨`);
    // Go back to admin menu after a short delay
    setTimeout(() => adminMenu(chatId), 500);
    // Log to channel — formatted report with English numbers
    try {
      const ch = dbGet("SELECT * FROM channels WHERE is_active=1");
      if (ch) {
        const m = u ? maskId(u.telegram_id) : "نامشخص";
        const typeLabel = o.type === "star" ? "🌟 استارز تلگرام" : o.type === "member" ? "👤 ممبر بدون ریزش" : `🎁 گیفت : ${o.gift_name || "نامشخص"}`;
        const logMsg =
          `✅ <b>#سفارش تکمیل شد</b>\n` +
          `${SEPARATOR}\n\n` +
          `📦 <b>نوع:</b> ${typeLabel}\n` +
          `🔑 <b>کد:</b> <code>${o.code}</code>\n` +
          `👤 <b>آیدی:</b> <code>${m}</code>\n` +
          `👀 <b>تعداد:</b> <code>${o.star_count}</code>\n` +
          `💰 <b>مبلغ:</b> <code>${o.price_toman.toLocaleString("en-US")}</code> تومان\n` +
          `⏳ <b>زمان:</b> ${toJalali(new Date())}`;
        const logResult = await send(ch.channel_id, logMsg);
        if (!logResult.ok) console.error("Log channel send failed:", logResult.description);
        else console.log(`✅ Log sent to channel ${ch.channel_id}`);
      } else {
        console.log("⚠️ No log channel configured");
      }
    } catch (e) { console.error("Log channel error:", e.message); }
    // Delete completed order from database
    dbRun(`DELETE FROM orders WHERE id=${oId}`);
    return answer(cq.id, "تکمیل شد.");
  }

  // Cancel
  if (data.startsWith("cancel_")) {
    if (!isAdmin(tgId)) return answer(cq.id, "ادمین نیستید.", true);
    const oId = parseInt(data.replace("cancel_", "")), o = dbGet(`SELECT * FROM orders WHERE id=${oId}`);
    if (!o) return answer(cq.id, "یافت نشد.", true);
    dbRun(`UPDATE orders SET status='cancelled', updated_at=unixepoch() WHERE id=${oId}`);
    await edit(chatId, msgId, `⚫ <b>سفارش ${o.code} لغو شد.</b> 🚫`);
    await editKb(chatId, msgId, { inline_keyboard: [] });
    const u = dbGet(`SELECT * FROM users WHERE id=${o.user_id}`);
    if (u) await send(u.telegram_id, `⚫ <b>سفارش شما لغو شد.</b>\n\n🔑 کد: <code>${o.code}</code>`);
    setTimeout(() => adminMenu(chatId), 500);
    return answer(cq.id, "لغو شد.");
  }

  await answer(cq.id);
}

// ==================== Polling ====================
let offset = 0;
async function poll() {
  while (true) {
    try {
      const r = await api("getUpdates", { offset, timeout: 30, allowed_updates: ["message", "callback_query", "channel_post"] });
      if (r.ok && r.result) for (const u of r.result) { offset = u.update_id + 1; try { if (u.message) await handleMessage(u.message); else if (u.callback_query) await handleCallback(u.callback_query); else if (u.channel_post) await handleMessage(u.channel_post); } catch (e) { console.error("Error:", e.message); } }
    } catch (e) { console.error("Poll error:", e.message); await new Promise(r => setTimeout(r, 5000)); }
  }
}

// ==================== Start ====================
async function main() {
  acquireLock();
  console.log(`🤖 ${BOT_NAME} Bot starting...`);
  console.log(`📦 دیتابیس: ${DB_PATH}`);
  console.log(`🎁 گیفتها: ${dbGet("SELECT COUNT(*) AS c FROM gifts")?.c ?? 0}`);
  const me = await api("getMe");
  if (!me.ok) { console.error("❌ Cannot connect:", me.description); process.exit(1); }
  console.log(`✅ Bot: @${me.result.username}`);
  await api("deleteWebhook");
  console.log("🔄 Polling started! Send /start to your bot.");
  poll();
}
main();
