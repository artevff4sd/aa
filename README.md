# Pepe Star — Telegram Gift & Star Sales Bot

ربات تلگرامی برای خرید و فروش گیفت‌ها و استارهای تلگرامی با قیمت تومان.

## امکانات

- خرید گیفت با ارسال لینک
- خرید استار با ارسال تعداد ستاره
- پرداخت با کارت بانکی و ارسال رسید
- پنل مدیریت وب برای تایید/رد سفارشات
- کانال گزارشات خودکار
- اعلان به ادمین‌ها و کاربران

## راه اندازی سریع

### پیش‌نیازها
- Node.js 18+
- توکن ربات تلگرام از [@BotFather](https://t.me/BotFather)

### نصب و اجرا

روی ویندوز: فایل `SETUP.bat` رو دابل‌کلیک کنید.

یا دستی:
```bash
npm install
npx drizzle-kit push
npm run dev
```

### تنظیم وب‌هوک

بعد از اجرا، به `http://localhost:3000/setup` برید و آدرس دامنه خود رو وارد کنید.

## صفحات

| آدرس | توضیح |
|-------|-------|
| `/` | صفحه اصلی |
| `/admin` | پنل مدیریت |
| `/setup` | راهنمای ست‌آپ |

## متغیرهای محیطی

```
TELEGRAM_BOT_TOKEN=توکن ربات
DATABASE_PATH=./data/bot.db
ADMIN_PASSWORD=رمز عبور پنل ادمین
WEBHOOK_URL=https://your-domain.com
```

## فناوری‌ها

- Next.js 16
- SQLite (sql.js) + Drizzle ORM
- Tailwind CSS 4
- Telegram Bot API
