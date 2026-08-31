import { NextRequest } from "next/server";
import { db } from "@/db";
import { orders, users } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const search = searchParams.get("search");

  let query = db
    .select({
      id: orders.id,
      code: orders.code,
      userId: orders.userId,
      giftLink: orders.giftLink,
      giftName: orders.giftName,
      type: orders.type,
      starCount: orders.starCount,
      priceToman: orders.priceToman,
      status: orders.status,
      receiptFileId: orders.receiptFileId,
      rejectReason: orders.rejectReason,
      createdAt: orders.createdAt,
      updatedAt: orders.updatedAt,
      userTelegramId: users.telegramId,
      userUsername: users.username,
      userFirstName: users.firstName,
    })
    .from(orders)
    .leftJoin(users, eq(orders.userId, users.id))
    .orderBy(desc(orders.id));

  const results = await query;
  let filtered = results;

  if (status && status !== "all") {
    filtered = filtered.filter((o) => o.status === status);
  }
  if (search) {
    const s = search.toLowerCase();
    filtered = filtered.filter(
      (o) =>
        o.code.toLowerCase().includes(s) ||
        (o.userUsername && o.userUsername.toLowerCase().includes(s)) ||
        (o.userFirstName && o.userFirstName.toLowerCase().includes(s))
    );
  }

  return Response.json({ ok: true, orders: filtered });
}
