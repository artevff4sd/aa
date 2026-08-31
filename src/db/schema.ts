import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  telegramId: integer("telegram_id").unique().notNull(),
  username: text("username"),
  firstName: text("first_name"),
  state: text("state").default("idle").notNull(),
  pendingGiftLink: text("pending_gift_link"),
  pendingStarCount: integer("pending_star_count"),
  adminState: text("admin_state"),
  adminStateData: text("admin_state_data"),
  createdAt: integer("created_at", { mode: "timestamp" }).default(new Date()).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(new Date()).notNull(),
});

export const orders = sqliteTable("orders", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  code: text("code").unique().notNull(),
  userId: integer("user_id")
    .references(() => users.id)
    .notNull(),
  giftLink: text("gift_link").notNull(),
  giftName: text("gift_name"),
  type: text("type").default("gift").notNull(),
  starCount: integer("star_count").notNull(),
  priceToman: integer("price_toman").notNull(),
  status: text("status").default("pending").notNull(),
  receiptFileId: text("receipt_file_id"),
  rejectReason: text("reject_reason"),
  createdAt: integer("created_at", { mode: "timestamp" }).default(new Date()).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(new Date()).notNull(),
});

export const settings = sqliteTable("settings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  key: text("key").unique().notNull(),
  value: text("value").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(new Date()).notNull(),
});

export const channels = sqliteTable("channels", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  channelId: integer("channel_id").unique().notNull(),
  channelName: text("channel_name"),
  isActive: integer("is_active").default(1),
  createdAt: integer("created_at", { mode: "timestamp" }).default(new Date()).notNull(),
});
