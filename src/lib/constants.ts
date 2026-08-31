export const ADMIN_IDS = [7184299507, 5851497957];

export const ORDER_STATUSES = {
  PENDING: "pending",
  RECEIPT_SENT: "receipt_sent",
  PENDING_APPROVAL: "pending_approval",
  APPROVED: "approved",
  REJECTED: "rejected",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
} as const;

export const USER_STATES = {
  IDLE: "idle",
  AWAITING_STAR_COUNT: "awaiting_star_count",
  AWAITING_RECEIPT: "awaiting_receipt",
  RECEIPT_SENT: "receipt_sent",
} as const;

export const ADMIN_STATES = {
  AWAITING_REJECT_REASON: "awaiting_reject_reason",
} as const;

export const DEFAULT_SETTINGS: Record<string, string> = {
  card_number: "0000-0000-0000-0000",
  card_holder_name: "نام صاحب کارت",
  exchange_rate: "5000",
};

export const STATUS_LABELS: Record<string, string> = {
  pending: "⏳ در انتظار رسید",
  receipt_sent: "📸 رسید ارسال شده",
  pending_approval: "🔍 در انتظار تایید ادمین",
  approved: "✅ تایید شده",
  rejected: "❌ رد شده",
  in_progress: "🔄 در حال انجام",
  completed: "✅ تکمیل شده",
  cancelled: "🚫 لغو شده",
};
