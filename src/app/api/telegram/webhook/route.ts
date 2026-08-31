import { db } from "@/db";
import { users, orders, settings } from "@/db/schema";
import { eq, and, desc, count } from "drizzle-orm";
import {
  sendMessage,
  sendPhoto,
  editMessageText,
  editMessageReplyMarkup,
  answerCallbackQuery,
} from "@/lib/telegram";
import { generateOrderCode, parseGiftLink, isAdmin, formatPrice } from "@/lib/utils";
import { ADMIN_IDS, ORDER_STATUSES, USER_STATES, ADMIN_STATES } from "@/lib/constants";

export const dynamic = "force-dynamic";

async function getSetting(key: string): Promise<string> {
  const rows = await db.select().from(settings).where(eq(settings.key, key));
  if (rows.length > 0) return rows[0].value;
  const defaults: Record<string, string> = {
    card_number: "0000-0000-0000-0000",
    card_holder_name: "نام صاحب کارت",
    exchange_rate: "5000",
  };
  return defaults[key] || "";
}

async function ensureUser(
  telegramId: number,
  username?: string,
  firstName?: string
) {
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.telegramId, telegramId));
  if (existing.length > 0) {
    await db
      .update(users)
      .set({ username, firstName, updatedAt: new Date() })
      .where(eq(users.telegramId, telegramId));
    return existing[0];
  }
  const inserted = await db
    .insert(users)
    .values({ telegramId, username, firstName })
    .returning();
  return inserted[0];
}

async function notifyAdmins(text: string, replyMarkup?: Record<string, unknown>) {
  for (const adminId of ADMIN_IDS) {
    try {
      await sendMessage(adminId, text, replyMarkup ? { reply_markup: replyMarkup } : undefined);
    } catch (e) {
      console.error(`Failed to notify admin ${adminId}:`, e);
    }
  }
}

async function notifyAdminsWithPhoto(
  photoId: string,
  caption: string,
  replyMarkup?: Record<string, unknown>
) {
  for (const adminId of ADMIN_IDS) {
    try {
      await sendPhoto(adminId, photoId, caption, replyMarkup ? { reply_markup: replyMarkup } : undefined);
    } catch (e) {
      console.error(`Failed to send photo to admin ${adminId}:`, e);
    }
  }
}

// ==================== ADMIN PANEL (Telegram) ====================

async function sendAdminMenu(chatId: number) {
  const pendingCount = await db
    .select({ value: count() })
    .from(orders)
    .where(eq(orders.status, ORDER_STATUSES.PENDING_APPROVAL));
  const approvedCount = await db
    .select({ value: count() })
    .from(orders)
    .where(eq(orders.status, ORDER_STATUSES.APPROVED));
  const todayCount = await db
    .select({ value: count() })
    .from(orders);

  const pending = pendingCount[0]?.value || 0;
  const approved = approvedCount[0]?.value || 0;
  const total = todayCount[0]?.value || 0;

  await sendMessage(
    chatId,
    `🔐 <b>پنل مدیریت Pepe Star</b>\n\n` +
      `📊 <b>آمار کلی:</b>\n` +
      `🔍 در انتظار تایید: <b>${pending}</b>\n` +
      `📂 تایید شده: <b>${approved}</b>\n` +
      `📋 کل سفارشات: <b>${total}</b>\n\n` +
      `یکی از گزینه‌های زیر رو انتخاب کنید:`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: `🔍 در انتظار تایید (${pending})`, callback_data: "admin_pending" }],
          [{ text: `📂 تایید شده (${approved})`, callback_data: "admin_approved" }],
          [{ text: "📋 همه سفارشات", callback_data: "admin_all" }],
          [{ text: "⚙️ تنظیمات", callback_data: "admin_settings" }],
        ],
      },
    }
  );
}

async function showAdminOrders(chatId: number, status: string, page: number = 0) {
  const pageSize = 5;
  let query = db
    .select()
    .from(orders)
    .orderBy(desc(orders.id))
    .$dynamic();

  if (status !== "all") {
    query = query
      .where(eq(orders.status, status));
  }

  const allOrders = await query;
  const totalPages = Math.ceil(allOrders.length / pageSize);
  const pageOrders = allOrders.slice(page * pageSize, (page + 1) * pageSize);

  if (pageOrders.length === 0) {
    await sendMessage(chatId, "📭 سفارشی یافت نشد.", {
      reply_markup: {
        inline_keyboard: [[{ text: "🔙 بازگشت", callback_data: "admin_back" }]],
      },
    });
    return;
  }

  const statusLabels: Record<string, string> = {
    pending: "⏳",
    receipt_sent: "📸",
    pending_approval: "🔍",
    approved: "✅",
    rejected: "❌",
    in_progress: "🔄",
    completed: "✅",
    cancelled: "🚫",
  };

  let text = `📋 <b>لیست سفارشات</b> (${allOrders.length} مورد)\n\n`;

  for (const order of pageOrders) {
    const userRows = await db.select().from(users).where(eq(users.id, order.userId));
    const user = userRows[0];
    const statusIcon = statusLabels[order.status] || "❓";
    const typeIcon = order.type === "star" ? "⭐" : "🎁";

    text += `${statusIcon} <code>${order.code}</code> ${typeIcon}\n`;
    text += `   👤 @${user?.username || "ندارد"} | ⭐ ${order.starCount} | 💰 ${formatPrice(order.priceToman)}\n`;
    text += `   📅 ${new Date(order.createdAt).toLocaleDateString("fa-IR")}\n\n`;
  }

  // Build navigation buttons
  const navButtons: Array<Array<{ text: string; callback_data: string }>> = [];

  if (totalPages > 1) {
    const row: Array<{ text: string; callback_data: string }> = [];
    if (page > 0) row.push({ text: "⬅️ قبلی", callback_data: `admin_page_${status}_${page - 1}` });
    row.push({ text: `${page + 1}/${totalPages}`, callback_data: "noop" });
    if (page < totalPages - 1) row.push({ text: "➡️ بعدی", callback_data: `admin_page_${status}_${page + 1}` });
    navButtons.push(row);
  }

  navButtons.push([{ text: "🔙 بازگشت", callback_data: "admin_back" }]);

  await sendMessage(chatId, text, {
    reply_markup: { inline_keyboard: navButtons },
  });
}

async function showAdminOrderDetail(chatId: number, orderId: number) {
  const orderRows = await db.select().from(orders).where(eq(orders.id, orderId));
  if (orderRows.length === 0) {
    await sendMessage(chatId, "❌ سفارش یافت نشد.");
    return;
  }
  const order = orderRows[0];
  const userRows = await db.select().from(users).where(eq(users.id, order.userId));
  const user = userRows[0];

  const statusLabels: Record<string, string> = {
    pending: "⏳ در انتظار رسید",
    receipt_sent: "📸 رسید ارسال شده",
    pending_approval: "🔍 در انتظار تایید",
    approved: "✅ تایید شده",
    rejected: "❌ رد شده",
    in_progress: "🔄 در حال انجام",
    completed: "✅ تکمیل شده",
    cancelled: "🚫 لغو شده",
  };

  const typeLabel = order.type === "star" ? "⭐ استار" : "🎁 گیفت";

  let text =
    `📋 <b>جزئیات سفارش</b>\n\n` +
    `🔑 کد: <code>${order.code}</code>\n` +
    `📦 نوع: ${typeLabel}\n` +
    `⭐ تعداد: ${order.starCount}\n` +
    `💰 قیمت: ${formatPrice(order.priceToman)} تومان\n` +
    `📊 وضعیت: ${statusLabels[order.status] || order.status}\n` +
    `👤 کاربر: @${user?.username || "ندارد"} (${user?.firstName || "-"})\n` +
    `🆔 آیدی: <code>${user?.telegramId || "-"}</code>\n` +
    `📅 تاریخ: ${new Date(order.createdAt).toLocaleDateString("fa-IR")}\n`;

  if (order.giftLink && order.giftLink !== "سفارش دستی") {
    text += `🔗 لینک: ${order.giftLink}\n`;
  }
  if (order.rejectReason) {
    text += `📝 دلیل رد: ${order.rejectReason}\n`;
  }

  // Build action buttons based on status
  const buttons: Array<Array<{ text: string; callback_data: string }>> = [];

  if (order.status === ORDER_STATUSES.PENDING_APPROVAL) {
    buttons.push([{ text: "✅ تایید", callback_data: `approve_${order.id}` }, { text: "❌ رد", callback_data: `reject_${order.id}` }]);
  }
  if (order.status === ORDER_STATUSES.APPROVED) {
    buttons.push([{ text: "✅ تکمیل", callback_data: `complete_${order.id}` }, { text: "🚫 لغو", callback_data: `cancel_${order.id}` }]);
  }
  if (order.status === ORDER_STATUSES.PENDING || order.status === ORDER_STATUSES.RECEIPT_SENT) {
    buttons.push([{ text: "❌ رد", callback_data: `reject_${order.id}` }, { text: "🚫 لغو", callback_data: `cancel_${order.id}` }]);
  }

  buttons.push([{ text: "🔙 بازگشت", callback_data: "admin_back" }]);

  // If there's a receipt photo, send it separately
  if (order.receiptFileId) {
    await sendPhoto(chatId, order.receiptFileId, text, {
      reply_markup: { inline_keyboard: buttons },
    });
  } else {
    await sendMessage(chatId, text, {
      reply_markup: { inline_keyboard: buttons },
    });
  }
}

async function showAdminSettings(chatId: number) {
  const cardNumber = await getSetting("card_number");
  const cardHolder = await getSetting("card_holder_name");
  const exchangeRate = await getSetting("exchange_rate");

  await sendMessage(
    chatId,
    `⚙️ <b>تنظیمات فعلی:</b>\n\n` +
      `💳 شماره کارت: <code>${cardNumber}</code>\n` +
      `👤 صاحب کارت: ${cardHolder}\n` +
      `💱 نرخ تبدیل: ${formatPrice(parseInt(exchangeRate))} تومان/ستاره\n\n` +
      `برای تغییر تنظیمات از پنل وب استفاده کنید:\n` +
      `<a href="/admin">🌐 پنل مدیریت وب</a>`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: "🔄 بروزرسانی", callback_data: "admin_settings" }],
          [{ text: "🔙 بازگشت", callback_data: "admin_back" }],
        ],
      },
    }
  );
}

// ==================== MAIN MESSAGE HANDLER ====================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleMessage(message: any) {
  const chatId = message.chat.id;
  const telegramId = message.from.id;
  const text = message.text || "";
  const username = message.from.username;
  const firstName = message.from.first_name || "کاربر";

  const user = await ensureUser(telegramId, username, firstName);

  // ==================== ADMIN COMMANDS ====================

  // Handle /admin command
  if (text === "/admin" || text === "/panel") {
    if (!isAdmin(telegramId)) {
      await sendMessage(chatId, "❌ شما دسترسی ادمین ندارید.");
      return;
    }
    await sendAdminMenu(chatId);
    return;
  }

  // Handle /orders command
  if (text === "/orders") {
    if (!isAdmin(telegramId)) {
      await sendMessage(chatId, "❌ شما دسترسی ادمین ندارید.");
      return;
    }
    await showAdminOrders(chatId, "all", 0);
    return;
  }

  // Handle /pending command
  if (text === "/pending") {
    if (!isAdmin(telegramId)) {
      await sendMessage(chatId, "❌ شما دسترسی ادمین ندارید.");
      return;
    }
    await showAdminOrders(chatId, ORDER_STATUSES.PENDING_APPROVAL, 0);
    return;
  }

  // Handle admin reject reason
  if (isAdmin(telegramId) && user.adminState === ADMIN_STATES.AWAITING_REJECT_REASON && user.adminStateData) {
    const orderId = parseInt(user.adminStateData);
    const reason = text;
    const orderRows = await db.select().from(orders).where(eq(orders.id, orderId));
    if (orderRows.length > 0) {
      const order = orderRows[0];
      await db
        .update(orders)
        .set({ status: ORDER_STATUSES.REJECTED, rejectReason: reason, updatedAt: new Date() })
        .where(eq(orders.id, orderId));
      await db
        .update(users)
        .set({ adminState: null, adminStateData: null, updatedAt: new Date() })
        .where(eq(users.id, user.id));
      // Notify user
      try {
        const orderUser = await db.select().from(users).where(eq(users.id, order.userId));
        if (orderUser.length > 0) {
          await sendMessage(
            orderUser[0].telegramId,
            `❌ <b>سفارش شما رد شد.</b>\n\n` +
              `🔑 کد سفارش: <code>${order.code}</code>\n` +
              `📝 دلیل: ${reason}`
          );
        }
      } catch (e) {
        console.error("Failed to notify user about rejection:", e);
      }
      await sendMessage(chatId, `✅ سفارش ${order.code} رد شد و دلیل برای کاربر ارسال شد.`);
    }
    return;
  }

  // ==================== USER FLOW ====================

  // Handle /start
  if (text === "/start") {
    await db.update(users).set({ state: USER_STATES.IDLE, updatedAt: new Date() }).where(eq(users.id, user.id));
    let welcomeMsg =
      `🎁 <b>به ربات خرید Pepe Star خوش آمدید!</b>\n\n` +
      `برای خرید گیفت، لینک گیفت رو بفرستید.\n` +
      `مثال: <code>https://t.me/nft/GiftName-12345</code>\n\n` +
      `یا تعداد ستاره گیفت مورد نظرتون رو بنویسید.\n` +
      `مثال: <code>100</code>`;

    // Add admin menu link if user is admin
    if (isAdmin(telegramId)) {
      welcomeMsg += `\n\n🔐 <b>ادمین:</b> برای دسترسی به پنل مدیریت دستور /admin رو بزنید.`;
    }

    await sendMessage(chatId, welcomeMsg);
    return;
  }

  // Handle /help
  if (text === "/help") {
    let helpMsg =
      `📖 <b>راهنمای ربات:</b>\n\n` +
      `🎁 ارسال لینک گیفت برای خرید\n` +
      `⭐ ارسال عدد برای خرید استار\n` +
      `📸 ارسال عکس رسید بعد از پرداخت\n\n` +
      `دستورات:\n` +
      `/start - شروع مجدد\n` +
      `/help - راهنما`;

    if (isAdmin(telegramId)) {
      helpMsg +=
        `\n\n🔐 <b>دستورات ادمین:</b>\n` +
        `/admin - پنل مدیریت\n` +
        `/pending - سفارشات در انتظار تایید\n` +
        `/orders - همه سفارشات`;
    }

    await sendMessage(chatId, helpMsg);
    return;
  }

  // Handle star count input
  if (user.state === USER_STATES.AWAITING_STAR_COUNT && user.pendingGiftLink) {
    const starCount = parseInt(text);
    if (isNaN(starCount) || starCount <= 0) {
      await sendMessage(chatId, "❌ لطفاً یک عدد معتبر وارد کنید.");
      return;
    }
    const rate = parseInt(await getSetting("exchange_rate"));
    const priceToman = starCount * rate;
    const code = generateOrderCode();
    const inserted = await db
      .insert(orders)
      .values({
        code,
        userId: user.id,
        giftLink: user.pendingGiftLink,
        type: "gift",
        starCount,
        priceToman,
        status: ORDER_STATUSES.PENDING,
      })
      .returning();
    const order = inserted[0];
    await db
      .update(users)
      .set({ state: USER_STATES.IDLE, pendingGiftLink: null, updatedAt: new Date() })
      .where(eq(users.id, user.id));
    await sendMessage(
      chatId,
      `🎁 <b>اطلاعات گیفت:</b>\n\n` +
        `🔗 لینک: ${user.pendingGiftLink}\n` +
        `⭐ تعداد ستاره: ${starCount}\n` +
        `💰 قیمت: ${formatPrice(priceToman)} تومان\n\n` +
        `برای خرید، دکمه زیر رو بزنید.`,
      {
        reply_markup: {
          inline_keyboard: [[{ text: "🛒 خرید", callback_data: `buy_${order.id}` }]],
        },
      }
    );
    return;
  }

  // Handle photo (receipt)
  if (message.photo && user.state === USER_STATES.AWAITING_RECEIPT) {
    const fileId = message.photo[message.photo.length - 1].file_id;
    const activeOrder = await db
      .select()
      .from(orders)
      .where(and(eq(orders.userId, user.id), eq(orders.status, ORDER_STATUSES.PENDING)))
      .orderBy(desc(orders.id))
      .limit(1);
    if (activeOrder.length === 0) {
      await sendMessage(chatId, "❌ سفارش فعالی یافت نشد.");
      return;
    }
    await db
      .update(orders)
      .set({ receiptFileId: fileId, status: ORDER_STATUSES.RECEIPT_SENT, updatedAt: new Date() })
      .where(eq(orders.id, activeOrder[0].id));
    await db
      .update(users)
      .set({ state: USER_STATES.RECEIPT_SENT, updatedAt: new Date() })
      .where(eq(users.id, user.id));
    await sendMessage(
      chatId,
      `✅ <b>رسید دریافت شد!</b>\n\n` +
        `برای تایید پرداخت و ارسال به ادمین، دکمه زیر رو بزنید.`,
      {
        reply_markup: {
          inline_keyboard: [[{ text: "💳 پرداخت شد", callback_data: `paid_${activeOrder[0].id}` }]],
        },
      }
    );
    return;
  }

  // Handle photo when not awaiting receipt
  if (message.photo && user.state !== USER_STATES.AWAITING_RECEIPT) {
    await sendMessage(chatId, "📸 عکس رسید رو فقط بعد از زدن دکمه خرید و دیدن شماره کارت میتونید بفرستید.");
    return;
  }

  // Handle gift link
  const giftSlug = parseGiftLink(text);
  if (giftSlug) {
    const rate = parseInt(await getSetting("exchange_rate"));
    let starCount: number | null = null;
    try {
      const res = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/getAvailableGifts`);
      const data = await res.json();
      if (data.ok && data.result?.gifts) {
        const gift = data.result.gifts.find((g: { id: string }) => g.id === giftSlug);
        if (gift) starCount = gift.star_count;
      }
    } catch (e) {
      console.error("Failed to fetch gifts:", e);
    }
    if (starCount) {
      const priceToman = starCount * rate;
      const code = generateOrderCode();
      const inserted = await db
        .insert(orders)
        .values({
          code,
          userId: user.id,
          giftLink: text,
          giftName: giftSlug,
          type: "gift",
          starCount,
          priceToman,
          status: ORDER_STATUSES.PENDING,
        })
        .returning();
      const order = inserted[0];
      await sendMessage(
        chatId,
        `🎁 <b>اطلاعات گیفت:</b>\n\n` +
          `🔗 لینک: ${text}\n` +
          `⭐ تعداد ستاره: ${starCount}\n` +
          `💰 قیمت: ${formatPrice(priceToman)} تومان\n\n` +
          `برای خرید، دکمه زیر رو بزنید.`,
        {
          reply_markup: {
            inline_keyboard: [[{ text: "🛒 خرید", callback_data: `buy_${order.id}` }]],
          },
        }
      );
    } else {
      await db
        .update(users)
        .set({ state: USER_STATES.AWAITING_STAR_COUNT, pendingGiftLink: text, updatedAt: new Date() })
        .where(eq(users.id, user.id));
      await sendMessage(
        chatId,
        `🎁 لینک گیفت دریافت شد!\n\n` +
          `لطفاً تعداد ستاره گیفت رو وارد کنید:\n` +
          `(مثلاً: 100)`
      );
    }
    return;
  }

  // Handle number input when idle (star purchase)
  if (user.state === USER_STATES.IDLE && /^\d+$/.test(text)) {
    const starCount = parseInt(text);
    if (starCount > 0 && starCount <= 1000000) {
      const rate = parseInt(await getSetting("exchange_rate"));
      const priceToman = starCount * rate;
      const code = generateOrderCode();
      const inserted = await db
        .insert(orders)
        .values({
          code,
          userId: user.id,
          giftLink: "سفارش دستی",
          type: "star",
          starCount,
          priceToman,
          status: ORDER_STATUSES.PENDING,
        })
        .returning();
      const order = inserted[0];
      await sendMessage(
        chatId,
        `🌟 <b>اطلاعات سفارش استار:</b>\n\n` +
          `⭐ تعداد ستاره: ${starCount}\n` +
          `💰 قیمت: ${formatPrice(priceToman)} تومان\n\n` +
          `برای خرید، دکمه زیر رو بزنید.`,
        {
          reply_markup: {
            inline_keyboard: [[{ text: "🛒 خرید", callback_data: `buy_${order.id}` }]],
          },
        }
      );
      return;
    }
  }

  // Default help message
  await sendMessage(
    chatId,
    `❓ لطفاً لینک گیفت تلگرامی رو بفرستید یا تعداد ستاره رو وارد کنید.\n\n` +
      `مثال لینک: <code>https://t.me/nft/GiftName-12345</code>\n` +
      `مثال عدد: <code>100</code>\n\n` +
      `برای راهنما: /help`
  );
}

// ==================== CALLBACK QUERY HANDLER ====================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleCallbackQuery(callbackQuery: any) {
  const data = callbackQuery.data;
  const chatId = callbackQuery.message.chat.id;
  const messageId = callbackQuery.message.message_id;
  const telegramId = callbackQuery.from.id;
  const username = callbackQuery.from.username;
  const firstName = callbackQuery.from.first_name || "کاربر";

  const user = await ensureUser(telegramId, username, firstName);

  // ==================== ADMIN PANEL CALLBACKS ====================

  if (data === "admin_back") {
    if (!isAdmin(telegramId)) {
      await answerCallbackQuery(callbackQuery.id, "❌ شما ادمین نیستید.", true);
      return;
    }
    await sendAdminMenu(chatId);
    await answerCallbackQuery(callbackQuery.id);
    return;
  }

  if (data === "admin_pending") {
    if (!isAdmin(telegramId)) {
      await answerCallbackQuery(callbackQuery.id, "❌ شما ادمین نیستید.", true);
      return;
    }
    await showAdminOrders(chatId, ORDER_STATUSES.PENDING_APPROVAL, 0);
    await answerCallbackQuery(callbackQuery.id);
    return;
  }

  if (data === "admin_approved") {
    if (!isAdmin(telegramId)) {
      await answerCallbackQuery(callbackQuery.id, "❌ شما ادمین نیستید.", true);
      return;
    }
    await showAdminOrders(chatId, ORDER_STATUSES.APPROVED, 0);
    await answerCallbackQuery(callbackQuery.id);
    return;
  }

  if (data === "admin_all") {
    if (!isAdmin(telegramId)) {
      await answerCallbackQuery(callbackQuery.id, "❌ شما ادمین نیستید.", true);
      return;
    }
    await showAdminOrders(chatId, "all", 0);
    await answerCallbackQuery(callbackQuery.id);
    return;
  }

  if (data === "admin_settings") {
    if (!isAdmin(telegramId)) {
      await answerCallbackQuery(callbackQuery.id, "❌ شما ادمین نیستید.", true);
      return;
    }
    await showAdminSettings(chatId);
    await answerCallbackQuery(callbackQuery.id);
    return;
  }

  // Handle admin pagination
  if (data.startsWith("admin_page_")) {
    if (!isAdmin(telegramId)) {
      await answerCallbackQuery(callbackQuery.id, "❌ شما ادمین نیستید.", true);
      return;
    }
    const parts = data.split("_");
    const status = parts[2];
    const page = parseInt(parts[3]) || 0;
    await showAdminOrders(chatId, status, page);
    await answerCallbackQuery(callbackQuery.id);
    return;
  }

  // Handle admin order detail (tap on order code in list)
  if (data.startsWith("admin_order_")) {
    if (!isAdmin(telegramId)) {
      await answerCallbackQuery(callbackQuery.id, "❌ شما ادمین نیستید.", true);
      return;
    }
    const orderId = parseInt(data.replace("admin_order_", ""));
    await showAdminOrderDetail(chatId, orderId);
    await answerCallbackQuery(callbackQuery.id);
    return;
  }

  // ==================== USER ORDER CALLBACKS ====================

  if (data.startsWith("buy_")) {
    const orderId = parseInt(data.replace("buy_", ""));
    const orderRows = await db.select().from(orders).where(eq(orders.id, orderId));
    if (orderRows.length === 0) {
      await answerCallbackQuery(callbackQuery.id, "❌ سفارش یافت نشد.", true);
      return;
    }
    const order = orderRows[0];
    if (order.userId !== user.id) {
      await answerCallbackQuery(callbackQuery.id, "❌ این سفارش مال شما نیست.", true);
      return;
    }
    const cardNumber = await getSetting("card_number");
    const cardHolder = await getSetting("card_holder_name");
    await db
      .update(users)
      .set({ state: USER_STATES.AWAITING_RECEIPT, updatedAt: new Date() })
      .where(eq(users.id, user.id));
    await editMessageText(
      chatId,
      messageId,
      `💳 <b>اطلاعات پرداخت:</b>\n\n` +
        `💳 شماره کارت: <code>${cardNumber}</code>\n` +
        `👤 صاحب کارت: ${cardHolder}\n` +
        `💰 مبلغ: ${formatPrice(order.priceToman)} تومان\n\n` +
        `⚠️ خرید توسط ادمین تایید میشه پس امکان داره طول بکشه.\n\n` +
        `📸 لطفاً بعد از پرداخت، عکس رسید رو بفرستید.`
    );
    await answerCallbackQuery(callbackQuery.id);
    return;
  }

  if (data.startsWith("paid_")) {
    const orderId = parseInt(data.replace("paid_", ""));
    const orderRows = await db.select().from(orders).where(eq(orders.id, orderId));
    if (orderRows.length === 0) {
      await answerCallbackQuery(callbackQuery.id, "❌ سفارش یافت نشد.", true);
      return;
    }
    const order = orderRows[0];
    if (order.userId !== user.id) {
      await answerCallbackQuery(callbackQuery.id, "❌ این سفارش مال شما نیست.", true);
      return;
    }
    if (order.status !== ORDER_STATUSES.RECEIPT_SENT) {
      await answerCallbackQuery(callbackQuery.id, "❌ وضعیت سفارش نامعتبر است.", true);
      return;
    }
    await db
      .update(orders)
      .set({ status: ORDER_STATUSES.PENDING_APPROVAL, updatedAt: new Date() })
      .where(eq(orders.id, orderId));
    await db
      .update(users)
      .set({ state: USER_STATES.IDLE, updatedAt: new Date() })
      .where(eq(users.id, user.id));
    await editMessageReplyMarkup(chatId, messageId, undefined);
    await sendMessage(
      chatId,
      `✅ <b>سفارش شما ثبت شد و در انتظار تایید ادمین است.</b>\n\n` +
        `🔑 کد سفارش: <code>${order.code}</code>\n\n` +
        `لطفاً صبر کنید...`
    );
    // Notify admins
    const caption =
      `🔔 <b>سفارش جدید!</b>\n\n` +
      `👤 کاربر: @${username || "ندارد"} (${firstName})\n` +
      `🆔 آیدی: ${telegramId}\n` +
      `⭐ ستاره: ${order.starCount}\n` +
      `💰 قیمت: ${formatPrice(order.priceToman)} تومان\n` +
      `🔑 کد: <code>${order.code}</code>`;
    const adminKeyboard = {
      inline_keyboard: [
        [{ text: "✅ تایید", callback_data: `approve_${orderId}` }, { text: "❌ رد", callback_data: `reject_${orderId}` }],
        [{ text: "📋 جزئیات", callback_data: `admin_order_${orderId}` }],
      ],
    };
    if (order.receiptFileId) {
      await notifyAdminsWithPhoto(order.receiptFileId, caption, adminKeyboard);
    } else {
      await notifyAdmins(caption, adminKeyboard);
    }
    await answerCallbackQuery(callbackQuery.id, "✅ سفارش برای ادمین ارسال شد.");
    return;
  }

  if (data.startsWith("approve_")) {
    if (!isAdmin(telegramId)) {
      await answerCallbackQuery(callbackQuery.id, "❌ شما ادمین نیستید.", true);
      return;
    }
    const orderId = parseInt(data.replace("approve_", ""));
    const orderRows = await db.select().from(orders).where(eq(orders.id, orderId));
    if (orderRows.length === 0) {
      await answerCallbackQuery(callbackQuery.id, "❌ سفارش یافت نشد.", true);
      return;
    }
    const order = orderRows[0];
    if (order.status !== ORDER_STATUSES.PENDING_APPROVAL) {
      await answerCallbackQuery(callbackQuery.id, "❌ وضعیت سفارش نامعتبر است.", true);
      return;
    }
    await db
      .update(orders)
      .set({ status: ORDER_STATUSES.APPROVED, updatedAt: new Date() })
      .where(eq(orders.id, orderId));
    await editMessageText(chatId, messageId, `✅ سفارش ${order.code} تایید شد.`);
    try {
      const orderUser = await db.select().from(users).where(eq(users.id, order.userId));
      if (orderUser.length > 0) {
        await sendMessage(
          orderUser[0].telegramId,
          `✅ <b>سفارش شما تایید شد!</b>\n\n` +
            `🔑 کد خرید: <code>${order.code}</code>\n\n` +
            `لطفاً به <a href="https://t.me/samimige16">@samimige16</a> پیام بدید و کد خرید رو بفرستید.`
        );
      }
    } catch (e) {
      console.error("Failed to notify user about approval:", e);
    }
    await answerCallbackQuery(callbackQuery.id, "✅ سفارش تایید شد.");
    return;
  }

  if (data.startsWith("reject_")) {
    if (!isAdmin(telegramId)) {
      await answerCallbackQuery(callbackQuery.id, "❌ شما ادمین نیستید.", true);
      return;
    }
    const orderId = parseInt(data.replace("reject_", ""));
    const orderRows = await db.select().from(orders).where(eq(orders.id, orderId));
    if (orderRows.length === 0) {
      await answerCallbackQuery(callbackQuery.id, "❌ سفارش یافت نشد.", true);
      return;
    }
    await db
      .update(users)
      .set({
        adminState: ADMIN_STATES.AWAITING_REJECT_REASON,
        adminStateData: orderId.toString(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));
    await sendMessage(chatId, `📝 لطفاً دلیل رد کردن سفارش ${orderRows[0].code} رو بنویسید:`);
    await answerCallbackQuery(callbackQuery.id);
    return;
  }

  if (data.startsWith("complete_")) {
    if (!isAdmin(telegramId)) {
      await answerCallbackQuery(callbackQuery.id, "❌ شما ادمین نیستید.", true);
      return;
    }
    const orderId = parseInt(data.replace("complete_", ""));
    const orderRows = await db.select().from(orders).where(eq(orders.id, orderId));
    if (orderRows.length === 0) {
      await answerCallbackQuery(callbackQuery.id, "❌ سفارش یافت نشد.", true);
      return;
    }
    const order = orderRows[0];
    await db
      .update(orders)
      .set({ status: ORDER_STATUSES.COMPLETED, updatedAt: new Date() })
      .where(eq(orders.id, orderId));
    await editMessageText(chatId, messageId, `✅ سفارش ${order.code} تکمیل شد.`);
    try {
      const orderUser = await db.select().from(users).where(eq(users.id, order.userId));
      if (orderUser.length > 0) {
        await sendMessage(
          orderUser[0].telegramId,
          `✅ <b>سفارش شما تکمیل شد!</b>\n\n` +
            `🔑 کد: <code>${order.code}</code>\n\n` +
            `امیدواریم از خریدتون لذت ببرید 🎉`
        );
      }
    } catch (e) {
      console.error("Failed to notify user about completion:", e);
    }
    await answerCallbackQuery(callbackQuery.id, "✅ سفارش تکمیل شد.");
    return;
  }

  if (data.startsWith("cancel_")) {
    if (!isAdmin(telegramId)) {
      await answerCallbackQuery(callbackQuery.id, "❌ شما ادمین نیستید.", true);
      return;
    }
    const orderId = parseInt(data.replace("cancel_", ""));
    const orderRows = await db.select().from(orders).where(eq(orders.id, orderId));
    if (orderRows.length === 0) {
      await answerCallbackQuery(callbackQuery.id, "❌ سفارش یافت نشد.", true);
      return;
    }
    const order = orderRows[0];
    await db
      .update(orders)
      .set({ status: ORDER_STATUSES.CANCELLED, updatedAt: new Date() })
      .where(eq(orders.id, orderId));
    await editMessageText(chatId, messageId, `🚫 سفارش ${order.code} لغو شد.`);
    try {
      const orderUser = await db.select().from(users).where(eq(users.id, order.userId));
      if (orderUser.length > 0) {
        await sendMessage(
          orderUser[0].telegramId,
          `🚫 <b>سفارش شما لغو شد.</b>\n\n` +
            `🔑 کد: <code>${order.code}</code>\n\n` +
            `اگر سوالی دارید، لطفاً با پشتیبانی تماس بگیرید.`
        );
      }
    } catch (e) {
      console.error("Failed to notify user about cancellation:", e);
    }
    await answerCallbackQuery(callbackQuery.id, "🚫 سفارش لغو شد.");
    return;
  }

  await answerCallbackQuery(callbackQuery.id);
}

export async function POST(request: Request) {
  try {
    const update = await request.json();
    if (update.message) {
      await handleMessage(update.message);
    } else if (update.callback_query) {
      await handleCallbackQuery(update.callback_query);
    }
  } catch (error) {
    console.error("Webhook error:", error);
  }
  return Response.json({ ok: true });
}
