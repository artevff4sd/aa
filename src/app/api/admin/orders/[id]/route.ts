import { NextRequest } from "next/server";
import { db } from "@/db";
import { orders, users, channels } from "@/db/schema";
import { eq } from "drizzle-orm";
import { sendMessage } from "@/lib/telegram";
import { formatPrice, maskTelegramId, toPersianDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const orderId = parseInt(id, 10);
  const { action, reason } = await request.json();

  const orderRows = await db.select().from(orders).where(eq(orders.id, orderId));
  if (orderRows.length === 0) {
    return Response.json({ ok: false, message: "سفارش یافت نشد." }, { status: 404 });
  }
  const order = orderRows[0];
  const orderUser = await db.select().from(users).where(eq(users.id, order.userId));
  const userTgId = orderUser.length > 0 ? orderUser[0].telegramId : null;

  switch (action) {
    case "approve": {
      await db.update(orders).set({ status: "approved", updatedAt: new Date() }).where(eq(orders.id, orderId));
      if (userTgId) {
        await sendMessage(
          userTgId,
          `✅ <b>سفارش شما تایید شد!</b>\n\n` +
            `🔑 کد خرید: <code>${order.code}</code>\n\n` +
            `لطفاً به <a href="https://t.me/samimige16">@samimige16</a> پیام بدید و کد خرید رو بفرستید.`
        );
      }
      return Response.json({ ok: true, message: "سفارش تایید شد." });
    }
    case "reject": {
      await db.update(orders).set({ status: "rejected", rejectReason: reason || "", updatedAt: new Date() }).where(eq(orders.id, orderId));
      if (userTgId) {
        await sendMessage(
          userTgId,
          `❌ <b>سفارش شما رد شد.</b>\n\n` +
            `🔑 کد سفارش: <code>${order.code}</code>\n` +
            `📝 دلیل: ${reason || "دلیلی ذکر نشده"}`
        );
      }
      return Response.json({ ok: true, message: "سفارش رد شد." });
    }
    case "complete": {
      await db.update(orders).set({ status: "completed", updatedAt: new Date() }).where(eq(orders.id, orderId));
      if (userTgId) {
        await sendMessage(
          userTgId,
          `✅ <b>سفارش شما تکمیل شد!</b>\n\n` +
            `🔑 کد: <code>${order.code}</code>\n\n` +
            `امیدواریم از خریدتون لذت ببرید 🎉`
        );
      }
      // Send log to channel
      await sendLogToChannel(order, userTgId);
      return Response.json({ ok: true, message: "سفارش تکمیل شد." });
    }
    case "cancel": {
      await db.update(orders).set({ status: "cancelled", updatedAt: new Date() }).where(eq(orders.id, orderId));
      if (userTgId) {
        await sendMessage(
          userTgId,
          `🚫 <b>سفارش شما لغو شد.</b>\n\n` +
            `🔑 کد: <code>${order.code}</code>\n\n` +
            `اگر سوالی دارید، لطفاً با پشتیبانی تماس بگیرید.`
        );
      }
      return Response.json({ ok: true, message: "سفارش لغو شد." });
    }
    default:
      return Response.json({ ok: false, message: "عمل نامعتبر." }, { status: 400 });
  }
}

async function sendLogToChannel(
  order: typeof orders.$inferSelect,
  userTgId: number | null
) {
  try {
    const channelRows = await db.select().from(channels).where(eq(channels.isActive, 1));
    if (channelRows.length === 0) return;
    const channel = channelRows[0];

    const maskedId = userTgId ? maskTelegramId(userTgId) : "نامشخص";
    const persianDate = toPersianDate(new Date());
    const typeLabel = order.type === "star"
      ? "🌟 استارز تلگرام"
      : `گیفت : ${order.giftName || "نامشخص"}`;

    const message =
      `[${new Date().toLocaleDateString("en-US")} ${new Date().toLocaleTimeString("en-US")}] ${channel.channelName}:\n\n` +
      `✅ #سفارش ( ${typeLabel} ) تکمیل شد.\n\n` +
      `👤 ID : \`${maskedId}\`\n` +
      `👀 Count : \`${order.starCount}\`\n` +
      `⏳ Time : \`${persianDate}\`\n` +
      `💰 Price : \`${formatPrice(order.priceToman)}\``;

    await sendMessage(channel.channelId, message);
  } catch (e) {
    console.error("Failed to send log to channel:", e);
  }
}
