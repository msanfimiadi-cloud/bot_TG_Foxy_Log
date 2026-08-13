import { HEADERS, REQUIRED_DETAILS } from "./constants.js";

export function emptyLead() {
  return Object.fromEntries(HEADERS.map((header) => [header, ""]));
}

export function missingFields(lead) {
  return REQUIRED_DETAILS.filter((field) => !String(lead[field] ?? "").trim());
}

export function normalizeLead(lead) {
  const normalized = { ...emptyLead(), ...lead };
  const missing = missingFields(normalized);
  normalized["Не заполнено"] = missing.join(", ");
  if (!normalized["Статус"] || normalized["Статус"] === "Новый") {
    normalized["Статус"] = missing.length ? "Требуется уточнение" : "Новый";
  }
  return normalized;
}

export function leadToRow(lead) {
  const normalized = normalizeLead(lead);
  return HEADERS.map((header) => normalized[header] ?? "");
}

export function rowToLead(row) {
  return Object.fromEntries(HEADERS.map((header, index) => [header, row[index] ?? ""]));
}

export function generateLeadId(now = new Date()) {
  const digits = now.toISOString().replace(/\D/g, "").slice(0, 14);
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `LEAD-${digits}-${suffix}`;
}

export function managerName(from) {
  return [from.first_name, from.last_name].filter(Boolean).join(" ") || "Без имени";
}

export function telegramUsername(from) {
  return from.username ? `@${from.username}` : "Ник не установлен";
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function contactKey(value) {
  return String(value ?? "").toLowerCase().replace(/[\s()+\-]/g, "");
}

export function canSeeLead(lead, telegramId, isAdmin) {
  return isAdmin || String(lead["Telegram ID менеджера"]) === String(telegramId);
}
