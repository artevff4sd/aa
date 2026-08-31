const TELEGRAM_API = "https://api.telegram.org";

function getBotToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is required");
  return token;
}

async function callApi(method: string, body?: Record<string, unknown>) {
  const token = getBotToken();
  const res = await fetch(`${TELEGRAM_API}/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!data.ok) {
    console.error(`Telegram API error [${method}]:`, data);
  }
  return data;
}

export async function sendMessage(
  chatId: number,
  text: string,
  extra?: Record<string, unknown>
) {
  return callApi("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    ...extra,
  });
}

export async function sendPhoto(
  chatId: number,
  photo: string,
  caption?: string,
  extra?: Record<string, unknown>
) {
  return callApi("sendPhoto", {
    chat_id: chatId,
    photo,
    caption,
    parse_mode: "HTML",
    ...extra,
  });
}

export async function editMessageText(
  chatId: number,
  messageId: number,
  text: string,
  extra?: Record<string, unknown>
) {
  return callApi("editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: "HTML",
    ...extra,
  });
}

export async function editMessageReplyMarkup(
  chatId: number,
  messageId: number,
  replyMarkup?: Record<string, unknown>
) {
  return callApi("editMessageReplyMarkup", {
    chat_id: chatId,
    message_id: messageId,
    reply_markup: replyMarkup,
  });
}

export async function answerCallbackQuery(
  callbackQueryId: string,
  text?: string,
  showAlert?: boolean
) {
  return callApi("answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    text,
    show_alert: showAlert,
  });
}

export async function getFile(fileId: string) {
  return callApi("getFile", { file_id: fileId });
}

export async function getAvailableGifts() {
  return callApi("getAvailableGifts");
}

export async function getMe() {
  return callApi("getMe");
}

export function getFileUrl(filePath: string): string {
  const token = getBotToken();
  return `${TELEGRAM_API}/file/bot${token}/${filePath}`;
}

export async function setWebhook(url: string, allowedUpdates?: string[]) {
  return callApi("setWebhook", {
    url,
    allowed_updates: allowedUpdates,
  });
}

export async function getWebhookInfo() {
  return callApi("getWebhookInfo");
}

export async function forwardMessage(
  chatId: number,
  fromChatId: number,
  messageId: number
) {
  return callApi("forwardMessage", {
    chat_id: chatId,
    from_chat_id: fromChatId,
    message_id: messageId,
  });
}

export async function sendDocument(
  chatId: number,
  document: string,
  caption?: string,
  extra?: Record<string, unknown>
) {
  return callApi("sendDocument", {
    chat_id: chatId,
    document,
    caption,
    parse_mode: "HTML",
    ...extra,
  });
}
