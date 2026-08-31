import { NextRequest } from "next/server";
import { setWebhook, getWebhookInfo } from "@/lib/telegram";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const { webhookUrl } = await request.json();
  const token = process.env.TELEGRAM_BOT_TOKEN;

  if (!token) {
    return Response.json({ ok: false, message: "TELEGRAM_BOT_TOKEN تنظیم نشده." }, { status: 400 });
  }

  const url = webhookUrl || process.env.WEBHOOK_URL;
  if (!url) {
    return Response.json({ ok: false, message: "آدرس وب‌هوک مشخص نشده." }, { status: 400 });
  }

  const fullUrl = `${url}/api/telegram/webhook`;

  try {
    const data = await setWebhook(fullUrl, ["message", "callback_query"]);

    if (data.ok) {
      return Response.json({
        ok: true,
        message: `وب‌هوک با موفقیت ست شد: ${fullUrl}`,
        webhook_url: fullUrl,
      });
    } else {
      return Response.json({
        ok: false,
        message: `خطا در ست کردن وب‌هوک: ${data.description}`,
      });
    }
  } catch (error) {
    return Response.json({
      ok: false,
      message: `خطا: ${error}`,
    });
  }
}

export async function GET() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return Response.json({ ok: false, message: "TELEGRAM_BOT_TOKEN تنظیم نشده." });
  }
  try {
    const data = await getWebhookInfo();
    return Response.json({ ok: true, info: data.result });
  } catch (error) {
    return Response.json({ ok: false, message: `خطا: ${error}` });
  }
}
