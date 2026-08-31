import crypto from "crypto";

export function generateOrderCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  const bytes = crypto.randomBytes(6);
  for (let i = 0; i < 6; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
}

export function formatPrice(price: number): string {
  return price.toLocaleString("fa-IR");
}

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

export function isAdmin(telegramId: number): boolean {
  const adminIds = [7184299507, 5851497957];
  return adminIds.includes(telegramId);
}

export function maskTelegramId(id: number): string {
  const str = id.toString();
  if (str.length > 8) {
    return str.substring(0, 4) + "******";
  }
  return str.substring(0, Math.ceil(str.length / 2)) + "****";
}

export function toPersianDate(date: Date): string {
  const gy = date.getFullYear();
  const gm = date.getMonth() + 1;
  const gd = date.getDate();

  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  let gy2 = gm > 2 ? gy + 1 : gy;
  let days = 355666 + (365 * gy) + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100) + Math.floor((gy2 + 399) / 400) + gd + g_d_m[gm - 1];
  let jy = -1595 + (33 * Math.floor(days / 12053));
  days %= 12053;
  jy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    jy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  let jm: number, jd: number;
  if (days < 186) {
    jm = 1 + Math.floor(days / 31);
    jd = 1 + (days % 31);
  } else {
    jm = 7 + Math.floor((days - 186) / 30);
    jd = 1 + ((days - 186) % 30);
  }

  const pad = (n: number) => n.toString().padStart(2, "0");
  const time = `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  return `${jy}/${pad(jm)}/${pad(jd)} - ${time}`;
}
