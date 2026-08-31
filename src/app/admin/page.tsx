"use client";

import { useState, useEffect, useCallback } from "react";

interface Order {
  id: number;
  code: string;
  userId: number;
  giftLink: string;
  giftName: string | null;
  type: string;
  starCount: number;
  priceToman: number;
  status: string;
  receiptFileId: string | null;
  rejectReason: string | null;
  createdAt: string;
  updatedAt: string;
  userTelegramId: number;
  userUsername: string | null;
  userFirstName: string | null;
}

interface Settings {
  card_number: string;
  card_holder_name: string;
  exchange_rate: string;
  log_channel_id: string;
  log_channel_name: string;
}

const STATUS_LABELS: Record<string, string> = {
  pending: "⏳ در انتظار رسید",
  receipt_sent: "📸 رسید ارسال شده",
  pending_approval: "🔍 در انتظار تایید",
  approved: "✅ تایید شده",
  rejected: "❌ رد شده",
  in_progress: "🔄 در حال انجام",
  completed: "✅ تکمیل شده",
  cancelled: "🚫 لغو شده",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  receipt_sent: "bg-blue-100 text-blue-800",
  pending_approval: "bg-orange-100 text-orange-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  in_progress: "bg-purple-100 text-purple-800",
  completed: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-gray-100 text-gray-800",
};

export default function AdminPage() {
  const [isAuthed, setIsAuthed] = useState(false);
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [activeTab, setActiveTab] = useState<"settings" | "pending" | "open" | "all">("pending");
  const [settings, setSettings] = useState<Settings>({
    card_number: "",
    card_holder_name: "",
    exchange_rate: "5000",
    log_channel_id: "",
    log_channel_name: "",
  });
  const [orders, setOrders] = useState<Order[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [rejectModal, setRejectModal] = useState<{ orderId: number; code: string } | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [detailModal, setDetailModal] = useState<Order | null>(null);

  const getToken = () => localStorage.getItem("admin_token");

  const authHeaders = () => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${getToken()}`,
  });

  useEffect(() => {
    const saved = localStorage.getItem("admin_token");
    if (saved) setIsAuthed(true);
  }, []);

  const fetchSettings = useCallback(async () => {
    const res = await fetch("/api/admin/settings", { headers: authHeaders() });
    const data = await res.json();
    if (data.ok) setSettings(data.settings);
  }, []);

  const fetchOrders = useCallback(async (status?: string, search?: string) => {
    setLoading(true);
    const params = new URLSearchParams();
    if (status && status !== "all") params.set("status", status);
    if (search) params.set("search", search);
    const res = await fetch(`/api/admin/orders?${params}`, { headers: authHeaders() });
    const data = await res.json();
    if (data.ok) setOrders(data.orders);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (isAuthed) {
      fetchSettings();
      fetchOrders();
    }
  }, [isAuthed, fetchSettings, fetchOrders]);

  useEffect(() => {
    if (!isAuthed) return;
    const statusMap: Record<string, string> = {
      settings: "all",
      pending: "pending_approval",
      open: "approved",
      all: "all",
    };
    fetchOrders(statusMap[activeTab], searchQuery || undefined);
  }, [activeTab, isAuthed, fetchOrders, searchQuery]);

  const handleLogin = async () => {
    setAuthError("");
    const res = await fetch("/api/admin/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const data = await res.json();
    if (data.ok) {
      localStorage.setItem("admin_token", data.token);
      setIsAuthed(true);
    } else {
      setAuthError(data.message);
    }
  };

  const handleSaveSettings = async () => {
    const res = await fetch("/api/admin/settings", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(settings),
    });
    const data = await res.json();
    setMessage(data.message);
    setTimeout(() => setMessage(""), 3000);
  };

  const handleOrderAction = async (orderId: number, action: string, reason?: string) => {
    const res = await fetch(`/api/admin/orders/${orderId}`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ action, reason }),
    });
    const data = await res.json();
    setMessage(data.message);
    setTimeout(() => setMessage(""), 3000);
    fetchOrders(
      activeTab === "settings" ? "all" : activeTab === "pending" ? "pending_approval" : activeTab === "open" ? "approved" : "all",
      searchQuery || undefined
    );
    setRejectModal(null);
    setRejectReason("");
    setDetailModal(null);
  };

  const formatPrice = (price: number) => price.toLocaleString("fa-IR");

  if (!isAuthed) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4" dir="rtl">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 w-full max-w-md border border-white/20">
          <h1 className="text-2xl font-bold text-white text-center mb-6">🔐 پنل مدیریت Pepe Star</h1>
          <input
            type="password"
            placeholder="رمز عبور"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/50 mb-4 text-center"
            dir="ltr"
          />
          {authError && <p className="text-red-400 text-center mb-4">{authError}</p>}
          <button onClick={handleLogin} className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold transition">
            ورود
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white" dir="rtl">
      {/* Header */}
      <header className="bg-black/30 backdrop-blur-lg border-b border-white/10 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold">🎁 پنل مدیریت Pepe Star</h1>
          <button
            onClick={() => { setIsAuthed(false); localStorage.removeItem("admin_token"); }}
            className="px-4 py-2 bg-red-600/30 hover:bg-red-600/50 rounded-lg text-sm transition"
          >
            خروج
          </button>
        </div>
      </header>

      {/* Message Toast */}
      {message && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg animate-pulse">
          {message}
        </div>
      )}

      {/* Reject Modal */}
      {rejectModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-40 p-4">
          <div className="bg-slate-800 rounded-2xl p-6 w-full max-w-md border border-white/10">
            <h3 className="text-lg font-bold mb-4">❌ رد کردن سفارش {rejectModal.code}</h3>
            <textarea
              placeholder="دلیل رد کردن..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/50 mb-4 h-24 resize-none"
            />
            <div className="flex gap-3">
              <button onClick={() => handleOrderAction(rejectModal.orderId, "reject", rejectReason)} className="flex-1 py-2 bg-red-600 hover:bg-red-700 rounded-lg font-bold transition">
                رد کردن
              </button>
              <button onClick={() => { setRejectModal(null); setRejectReason(""); }} className="flex-1 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg transition">
                انصراف
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {detailModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-40 p-4" onClick={() => setDetailModal(null)}>
          <div className="bg-slate-800 rounded-2xl p-6 w-full max-w-lg border border-white/10 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4">📋 جزئیات سفارش {detailModal.code}</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-white/60">کد:</span><span className="font-mono">{detailModal.code}</span></div>
              <div className="flex justify-between"><span className="text-white/60">نوع:</span><span>{detailModal.type === "star" ? "⭐ استار" : "🎁 گیفت"}</span></div>
              <div className="flex justify-between"><span className="text-white/60">کاربر:</span><span>@{detailModal.userUsername || "ندارد"} ({detailModal.userFirstName})</span></div>
              <div className="flex justify-between"><span className="text-white/60">آیدی:</span><span>{detailModal.userTelegramId}</span></div>
              <div className="flex justify-between"><span className="text-white/60">لینک گیفت:</span><span className="text-left text-xs break-all max-w-[200px]">{detailModal.giftLink}</span></div>
              <div className="flex justify-between"><span className="text-white/60">ستاره:</span><span>{detailModal.starCount}</span></div>
              <div className="flex justify-between"><span className="text-white/60">قیمت:</span><span>{formatPrice(detailModal.priceToman)} تومان</span></div>
              <div className="flex justify-between items-center"><span className="text-white/60">وضعیت:</span><span className={`px-2 py-1 rounded-full text-xs ${STATUS_COLORS[detailModal.status]}`}>{STATUS_LABELS[detailModal.status]}</span></div>
              {detailModal.rejectReason && <div className="flex justify-between"><span className="text-white/60">دلیل رد:</span><span>{detailModal.rejectReason}</span></div>}
              <div className="flex justify-between"><span className="text-white/60">تاریخ:</span><span>{new Date(detailModal.createdAt).toLocaleDateString("fa-IR")}</span></div>
              {detailModal.receiptFileId && (
                <div className="mt-4">
                  <p className="text-white/60 mb-2">📸 رسید:</p>
                  <img src={`/api/admin/photo/${encodeURIComponent(detailModal.receiptFileId)}`} alt="receipt" className="rounded-lg max-w-full" />
                </div>
              )}
            </div>
            <div className="flex gap-2 mt-6">
              {detailModal.status === "pending_approval" && (
                <>
                  <button onClick={() => handleOrderAction(detailModal.id, "approve")} className="flex-1 py-2 bg-green-600 hover:bg-green-700 rounded-lg font-bold transition">✅ تایید</button>
                  <button onClick={() => { setRejectModal({ orderId: detailModal.id, code: detailModal.code }); setDetailModal(null); }} className="flex-1 py-2 bg-red-600 hover:bg-red-700 rounded-lg font-bold transition">❌ رد</button>
                </>
              )}
              {detailModal.status === "approved" && (
                <>
                  <button onClick={() => handleOrderAction(detailModal.id, "complete")} className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg font-bold transition">✅ تکمیل</button>
                  <button onClick={() => handleOrderAction(detailModal.id, "cancel")} className="flex-1 py-2 bg-red-600 hover:bg-red-700 rounded-lg font-bold transition">🚫 لغو</button>
                </>
              )}
              <button onClick={() => setDetailModal(null)} className="flex-1 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg transition">بستن</button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto p-6">
        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {[
            { key: "settings", label: "⚙️ تنظیمات" },
            { key: "pending", label: "🔍 در انتظار تایید" },
            { key: "open", label: "📂 سفارشات باز" },
            { key: "all", label: "📋 همه سفارشات" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as typeof activeTab)}
              className={`px-4 py-2 rounded-lg whitespace-nowrap transition ${
                activeTab === tab.key ? "bg-purple-600 text-white" : "bg-white/10 text-white/70 hover:bg-white/20"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Settings Tab */}
        {activeTab === "settings" && (
          <div className="bg-white/5 backdrop-blur rounded-2xl p-6 border border-white/10">
            <h2 className="text-xl font-bold mb-6">⚙️ تنظیمات</h2>
            <div className="space-y-4 max-w-lg">
              <div>
                <label className="block text-sm text-white/60 mb-1">💳 شماره کارت</label>
                <input
                  value={settings.card_number}
                  onChange={(e) => setSettings({ ...settings, card_number: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="block text-sm text-white/60 mb-1">👤 نام صاحب کارت</label>
                <input
                  value={settings.card_holder_name}
                  onChange={(e) => setSettings({ ...settings, card_holder_name: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white"
                />
              </div>
              <div>
                <label className="block text-sm text-white/60 mb-1">💱 نرخ تبدیل (هر ستاره = ؟ تومان)</label>
                <input
                  type="number"
                  value={settings.exchange_rate}
                  onChange={(e) => setSettings({ ...settings, exchange_rate: e.target.value })}
                  className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white"
                  dir="ltr"
                />
              </div>

              {/* Channel Log Section */}
              <div className="border-t border-white/10 pt-4 mt-4">
                <h3 className="font-bold mb-3">📣 کانال گزارشات</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm text-white/60 mb-1">آیدی عددی کانال</label>
                    <input
                      value={settings.log_channel_id}
                      onChange={(e) => setSettings({ ...settings, log_channel_id: e.target.value })}
                      placeholder="-1001234567890"
                      className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/40"
                      dir="ltr"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-white/60 mb-1">نام نمایشی کانال</label>
                    <input
                      value={settings.log_channel_name}
                      onChange={(e) => setSettings({ ...settings, log_channel_name: e.target.value })}
                      placeholder="گزارشات خرید pepe star"
                      className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/40"
                    />
                  </div>
                  <p className="text-xs text-white/40">ربات رو به‌عنوان ادمین با قابلیت ارسال پیام در کانال اضافه کنید</p>
                </div>
              </div>

              <button onClick={handleSaveSettings} className="px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg font-bold transition">
                💾 ذخیره تنظیمات
              </button>
            </div>
          </div>
        )}

        {/* Orders Tabs */}
        {activeTab !== "settings" && (
          <div>
            {/* Search */}
            <div className="mb-4">
              <input
                placeholder="🔍 جستجو با کد سفارش یا نام کاربر..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full max-w-md px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/50"
              />
            </div>

            {loading ? (
              <div className="text-center py-12 text-white/50">⏳ در حال بارگذاری...</div>
            ) : orders.length === 0 ? (
              <div className="text-center py-12 text-white/50">📭 سفارشی یافت نشد.</div>
            ) : (
              <div className="grid gap-4">
                {orders.map((order) => (
                  <div
                    key={order.id}
                    className="bg-white/5 backdrop-blur rounded-xl p-4 border border-white/10 hover:border-purple-500/30 transition cursor-pointer"
                    onClick={() => setDetailModal(order)}
                  >
                    <div className="flex items-center justify-between flex-wrap gap-3">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-sm bg-white/10 px-2 py-1 rounded">{order.code}</span>
                        <span className="text-xs px-2 py-1 rounded-full">{order.type === "star" ? "⭐ استار" : "🎁 گیفت"}</span>
                        <span className={`px-2 py-1 rounded-full text-xs ${STATUS_COLORS[order.status]}`}>
                          {STATUS_LABELS[order.status]}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-white/60">
                        <span>⭐ {order.starCount}</span>
                        <span>💰 {formatPrice(order.priceToman)} تومان</span>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-sm">
                      <span className="text-white/50">
                        👤 @{order.userUsername || "ندارد"} ({order.userFirstName})
                      </span>
                      <span className="text-white/40 text-xs">
                        {new Date(order.createdAt).toLocaleDateString("fa-IR")}
                      </span>
                    </div>
                    {order.receiptFileId && (
                      <div className="mt-2">
                        <span className="text-xs text-purple-400">📸 رسید موجود</span>
                      </div>
                    )}
                    {/* Quick Actions */}
                    <div className="mt-3 flex gap-2" onClick={(e) => e.stopPropagation()}>
                      {order.status === "pending_approval" && (
                        <>
                          <button onClick={() => handleOrderAction(order.id, "approve")} className="px-3 py-1 bg-green-600/30 hover:bg-green-600/50 rounded text-xs transition">✅ تایید</button>
                          <button onClick={() => setRejectModal({ orderId: order.id, code: order.code })} className="px-3 py-1 bg-red-600/30 hover:bg-red-600/50 rounded text-xs transition">❌ رد</button>
                        </>
                      )}
                      {order.status === "approved" && (
                        <>
                          <button onClick={() => handleOrderAction(order.id, "complete")} className="px-3 py-1 bg-emerald-600/30 hover:bg-emerald-600/50 rounded text-xs transition">✅ تکمیل</button>
                          <button onClick={() => handleOrderAction(order.id, "cancel")} className="px-3 py-1 bg-red-600/30 hover:bg-red-600/50 rounded text-xs transition">🚫 لغو</button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
