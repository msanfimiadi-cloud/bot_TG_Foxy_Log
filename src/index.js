import { createBot } from "./bot.js";
import { loadConfig } from "./config.js";
import { GoogleSheetsLeadStore } from "./sheets.js";
import { QuoteDriveStore } from "./drive.js";

async function main() {
  const config = loadConfig();
  const store = new GoogleSheetsLeadStore(config);
  await store.init();
  const drive = new QuoteDriveStore(config, store.auth);

  const bot = createBot(config, store, drive);
  await bot.api.setMyCommands([
    { command: "start", description: "Открыть главное меню" },
    { command: "menu", description: "Показать меню" },
    { command: "cancel", description: "Отменить текущее действие" },
  ]);

  const shutdown = () => bot.stop();
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);

  console.log("Бот запущен");
  await bot.start({ drop_pending_updates: false });
}

main().catch((error) => {
  console.error("Не удалось запустить бота:", error);
  process.exitCode = 1;
});
