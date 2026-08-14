import "dotenv/config";

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Не задана обязательная переменная ${name}`);
  return value;
}

function idSet(name) {
  const raw = process.env[name]?.trim() ?? "";
  return new Set(raw.split(",").map((value) => value.trim()).filter(Boolean));
}

export function loadConfig() {
  const allowedIds = idSet("ALLOWED_TELEGRAM_IDS");
  if (allowedIds.size === 0) {
    throw new Error("ALLOWED_TELEGRAM_IDS не должен быть пустым");
  }

  const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  const serviceAccountFile = process.env.GOOGLE_SERVICE_ACCOUNT_FILE?.trim();
  if (!serviceAccountJson && !serviceAccountFile) {
    throw new Error("Задайте GOOGLE_SERVICE_ACCOUNT_JSON или GOOGLE_SERVICE_ACCOUNT_FILE");
  }

  const driveOAuthClientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim() || "";
  const driveOAuthClientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim() || "";
  const driveOAuthRefreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN?.trim() || "";
  const driveOAuthValues = [driveOAuthClientId, driveOAuthClientSecret, driveOAuthRefreshToken];
  if (driveOAuthValues.some(Boolean) && !driveOAuthValues.every(Boolean)) {
    throw new Error(
      "Для OAuth Google Drive задайте одновременно GOOGLE_OAUTH_CLIENT_ID, "
      + "GOOGLE_OAUTH_CLIENT_SECRET и GOOGLE_OAUTH_REFRESH_TOKEN",
    );
  }

  return {
    telegramToken: required("TELEGRAM_BOT_TOKEN"),
    spreadsheetId: required("GOOGLE_SPREADSHEET_ID"),
    sheetName: process.env.GOOGLE_SHEET_NAME?.trim() || "Лиды",
    serviceAccountJson,
    serviceAccountFile,
    allowedIds,
    adminIds: idSet("ADMIN_TELEGRAM_IDS"),
    timeZone: process.env.TIMEZONE?.trim() || "Europe/Moscow",
    driveFolderId: process.env.GOOGLE_DRIVE_FOLDER_ID?.trim() || "",
    driveShareWithLink: (process.env.DRIVE_SHARE_WITH_LINK?.trim() || "true") === "true",
    driveOAuthClientId,
    driveOAuthClientSecret,
    driveOAuthRefreshToken,
    quoteTemplateFile: process.env.QUOTE_TEMPLATE_FILE?.trim() || "./templates/КП_Фокси_Логистика_шаблон.xlsx",
  };
}
