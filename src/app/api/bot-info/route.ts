import { getMe } from "@/lib/telegram";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await getMe();
    if (result.ok) {
      return Response.json({ ok: true, username: result.result.username });
    }
    return Response.json({ ok: false }, { status: 500 });
  } catch {
    return Response.json({ ok: false }, { status: 500 });
  }
}
