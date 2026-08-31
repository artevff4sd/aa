"use client";

export default function SetupPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white p-6" dir="rtl">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-center">🛠️ راهنمای ست‌آپ Pepe Star</h1>

        {/* Step 1 */}
        <div className="bg-white/5 backdrop-blur rounded-xl p-6 border border-white/10 mb-6">
          <h2 className="text-xl font-bold mb-4">۱. ساخت ربات در تلگرام</h2>
          <ol className="space-y-3 text-white/80 list-decimal list-inside">
            <li>به <a href="https://t.me/BotFather" target="_blank" className="text-purple-400 underline">@BotFather</a> در تلگرام برید</li>
            <li>دستور <code className="bg-white/10 px-2 py-1 rounded text-sm">/newbot</code> رو بفرستید</li>
            <li>اسم ربات رو بدید (مثلا: Pepe Star Bot)</li>
            <li>یوزرنیم ربات رو بدید (مثلا: pepe_star_bot)</li>
            <li>توکنی که BotFather میده رو کپی کنید</li>
            <li>توکن رو در فایل <code className="bg-white/10 px-2 py-1 rounded text-sm">.env</code> کنار <code className="bg-white/10 px-2 py-1 rounded text-sm">TELEGRAM_BOT_TOKEN=</code> بذارید</li>
          </ol>
        </div>

        {/* Step 2 */}
        <div className="bg-white/5 backdrop-blur rounded-xl p-6 border border-white/10 mb-6">
          <h2 className="text-xl font-bold mb-4">۲. تنظیم متغیرهای محیطی</h2>
          <p className="text-white/80 mb-4">فایل <code className="bg-white/10 px-2 py-1 rounded text-sm">.env</code> رو ویرایش کنید:</p>
          <pre className="bg-black/30 rounded-lg p-4 text-sm overflow-x-auto" dir="ltr">
{`TELEGRAM_BOT_TOKEN=123456789:ABCdefGhIjKlMnOpQrStUvWxYz
ADMIN_PASSWORD=your_secure_password`}
          </pre>
          <div className="mt-4 space-y-2 text-white/70 text-sm">
            <p>📌 <strong>TELEGRAM_BOT_TOKEN:</strong> توکن ربات از BotFather</p>
            <p>📌 <strong>ADMIN_PASSWORD:</strong> رمز عبور پنل مدیریت (توی مرورگر /admin)</p>
          </div>
        </div>

        {/* Step 3 */}
        <div className="bg-white/5 backdrop-blur rounded-xl p-6 border border-white/10 mb-6">
          <h2 className="text-xl font-bold mb-4">۳. اجرای ربات</h2>
          <p className="text-white/80 mb-4">ربات با حالت <strong>Polling</strong> کار می‌کنه — <span className="text-green-400 font-bold">نیازی به دامنه یا وب‌هوک نیست!</span></p>
          <p className="text-white/80 mb-3">روی ویندوز:</p>
          <pre className="bg-black/30 rounded-lg p-4 text-sm overflow-x-auto" dir="ltr">
{`SETUP.bat`}
          </pre>
          <p className="text-white/80 mt-3 mb-3">یا دستی:</p>
          <pre className="bg-black/30 rounded-lg p-4 text-sm overflow-x-auto" dir="ltr">
{`npm install
node setup-db.mjs
npm run dev        # سرور Next.js
node bot.mjs       # ربات تلگرام (پنجره جداگانه)`}
          </pre>
          <p className="text-white/60 text-sm mt-3">
            اسکریپت SETUP.bat همزمان سرور و ربات رو اجرا می‌کنه.
          </p>
        </div>

        {/* Step 4 */}
        <div className="bg-white/5 backdrop-blur rounded-xl p-6 border border-white/10 mb-6">
          <h2 className="text-xl font-bold mb-4">۴. ست کردن منوی ربات (اختیاری)</h2>
          <p className="text-white/80 mb-4">برای ست کردن منوی ربات در BotFather:</p>
          <ol className="space-y-2 text-white/80 list-decimal list-inside">
            <li>به <a href="https://t.me/BotFather" target="_blank" className="text-purple-400 underline">@BotFather</a> برید</li>
            <li>دستور <code className="bg-white/10 px-2 py-1 rounded text-sm">/setcommands</code> رو بفرستید</li>
            <li>ربات رو انتخاب کنید</li>
            <li>این متن رو بفرستید:</li>
          </ol>
          <pre className="mt-3 bg-black/30 rounded-lg p-4 text-sm" dir="ltr">
{`start - شروع ربات
help - راهنما
admin - پنل مدیریت
pending - سفارشات در انتظار تایید
orders - همه سفارشات`}
          </pre>
        </div>

        {/* Step 5 */}
        <div className="bg-white/5 backdrop-blur rounded-xl p-6 border border-white/10 mb-6">
          <h2 className="text-xl font-bold mb-4">۵. ادمین‌ها</h2>
          <p className="text-white/80 mb-2">ادمین‌های فعلی ربات:</p>
          <ul className="space-y-1 text-white/70">
            <li>🆔 7184299507</li>
            <li>🆔 5851497957</li>
          </ul>
          <p className="text-white/60 text-sm mt-3">
            ادمین‌ها میتونن سفارشات رو از داخل تلگرام یا پنل وب تایید/رد کنن.
          </p>
        </div>

        {/* Step 6 */}
        <div className="bg-white/5 backdrop-blur rounded-xl p-6 border border-white/10 mb-6">
          <h2 className="text-xl font-bold mb-4">۶. کانال گزارشات (اختیاری)</h2>
          <p className="text-white/80 mb-3">برای ارسال خودکار گزارش سفارشات تکمیل‌شده:</p>
          <ol className="space-y-2 text-white/80 list-decimal list-inside">
            <li>یک کانال تلگرامی بسازید</li>
            <li>ربات رو به‌عنوان ادمین با قابلیت <strong>ارسال پیام</strong> به کانال اضافه کنید</li>
            <li>آیدی عددی کانال رو از پنل مدیریت (<code className="bg-white/10 px-2 py-1 rounded text-sm">/admin</code> → تنظیمات → کانال گزارشات) وارد کنید</li>
          </ol>
        </div>

        {/* Links */}
        <div className="flex gap-4 justify-center mt-8">
          <a href="/" className="px-6 py-3 bg-white/10 hover:bg-white/20 rounded-lg transition">
            🏠 صفحه اصلی
          </a>
          <a href="/admin" className="px-6 py-3 bg-purple-600/30 hover:bg-purple-600/50 rounded-lg transition">
            🔐 پنل مدیریت
          </a>
        </div>
      </div>
    </div>
  );
}
