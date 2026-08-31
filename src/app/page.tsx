"use client";

import { useEffect, useState } from "react";

export default function HomePage() {
  const [botUsername, setBotUsername] = useState("");

  useEffect(() => {
    fetch("/api/bot-info")
      .then((res) => res.json())
      .then((data) => {
        if (data.ok) setBotUsername(data.username);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-purple-900 to-slate-900 flex flex-col items-center">
      <div className="max-w-2xl w-full px-6 py-20 text-center">
        <div className="text-8xl mb-6">🎁</div>
        <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mb-4">
          خرید گیفت و استار تلگرامی
        </h1>
        <p className="text-lg text-slate-300 mb-8">
          گیفت‌ها و استارهای تلگرامی رو با قیمت مناسب بخرید. سریع، امن و مطمئن.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <a
            href={botUsername ? `https://t.me/${botUsername}` : "#"}
            className="px-8 py-3 bg-purple-600 hover:bg-purple-700 rounded-xl font-semibold transition"
          >
            🚀 شروع ربات
          </a>
          <a
            href="/admin"
            className="px-8 py-3 bg-white/10 hover:bg-white/20 rounded-xl font-semibold transition"
          >
            🔐 پنل مدیریت
          </a>
          <a
            href="/setup"
            className="px-8 py-3 bg-white/10 hover:bg-white/20 rounded-xl font-semibold transition"
          >
            🛠️ راهنمای ست‌آپ
          </a>
        </div>
      </div>
      <div className="max-w-4xl w-full px-6 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center">
            <div className="text-4xl mb-3">🔗</div>
            <h3 className="text-xl font-bold mb-2">ارسال لینک گیفت</h3>
            <p className="text-slate-400">لینک گیفت تلگرامی رو بفرستید و قیمت رو ببینید</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center">
            <div className="text-4xl mb-3">⭐</div>
            <h3 className="text-xl font-bold mb-2">خرید استار</h3>
            <p className="text-slate-400">تعداد ستاره مورد نظرتون رو وارد کنید و سفارش بدید</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center">
            <div className="text-4xl mb-3">✅</div>
            <h3 className="text-xl font-bold mb-2">تایید سریع</h3>
            <p className="text-slate-400">ادمین سفارش رو تایید میکنه و گیفت یا استار براتون ارسال میشه</p>
          </div>
        </div>
      </div>
      <footer className="py-8 text-slate-500 text-sm">
        © Pepe Star — تمامی حقوق محفوظ است.
      </footer>
    </div>
  );
}
