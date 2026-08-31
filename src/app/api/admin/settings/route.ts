import { NextRequest } from "next/server";
import { db } from "@/db";
import { settings, channels } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await db.select().from(settings);
  const settingsMap: Record<string, string> = {};
  for (const row of rows) {
    settingsMap[row.key] = row.value;
  }

  // Defaults
  if (!settingsMap.card_number) settingsMap.card_number = "0000-0000-0000-0000";
  if (!settingsMap.card_holder_name) settingsMap.card_holder_name = "نام صاحب کارت";
  if (!settingsMap.exchange_rate) settingsMap.exchange_rate = "5000";

  // Get channel info
  const channelRows = await db.select().from(channels).where(eq(channels.isActive, 1));
  if (channelRows.length > 0) {
    settingsMap.log_channel_id = String(channelRows[0].channelId);
    settingsMap.log_channel_name = channelRows[0].channelName || "";
  } else {
    settingsMap.log_channel_id = "";
    settingsMap.log_channel_name = "";
  }

  return Response.json({ ok: true, settings: settingsMap });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { card_number, card_holder_name, exchange_rate, log_channel_id, log_channel_name } = body;

  // Save regular settings
  const regularUpdates: Record<string, string> = { card_number, card_holder_name, exchange_rate };
  for (const [key, value] of Object.entries(regularUpdates)) {
    if (value !== undefined && value !== null) {
      const existing = await db.select().from(settings).where(eq(settings.key, key));
      if (existing.length > 0) {
        await db.update(settings).set({ value: value as string, updatedAt: new Date() }).where(eq(settings.key, key));
      } else {
        await db.insert(settings).values({ key, value: value as string });
      }
    }
  }

  // Save channel settings
  if (log_channel_id !== undefined && log_channel_id !== null && log_channel_id !== "") {
    const channelId = parseInt(log_channel_id, 10);
    if (!isNaN(channelId)) {
      const existingChannel = await db.select().from(channels).where(eq(channels.channelId, channelId));
      if (existingChannel.length > 0) {
        await db.update(channels)
          .set({ channelName: log_channel_name || "", isActive: 1, createdAt: new Date() })
          .where(eq(channels.channelId, channelId));
      } else {
        await db.insert(channels).values({ channelId, channelName: log_channel_name || "" });
      }
      // Deactivate other channels
      const allChannels = await db.select().from(channels);
      for (const ch of allChannels) {
        if (ch.channelId !== channelId) {
          await db.update(channels).set({ isActive: 0 }).where(eq(channels.id, ch.id));
        }
      }
    }
  }

  return Response.json({ ok: true, message: "تنظیمات ذخیره شد." });
}
