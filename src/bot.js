import { Bot, InlineKeyboard } from "grammy";
import { EDITABLE_FIELDS, STATUSES } from "./constants.js";
import {
  canSeeLead, escapeHtml, generateLeadId, managerName, missingFields, telegramUsername,
} from "./leads.js";
import { formatDate } from "./time.js";

const NEW_FIELDS = [
  ["Дата обращения", "Укажите дату обращения в формате ДД.ММ.ГГГГ", true],
  ["Имя лида", "Введите имя клиента или название компании"],
  ["Контакты", "Введите телефон, почту или Telegram клиента"],
  ["Город", "Какой город интересует клиента?"],
  ["Товар", "Какой у клиента товар?"],
  ["Единиц в месяц", "Сколько единиц отгружается в месяц?"],
  ["Комментарий", "Добавьте комментарий или следующий шаг"],
];

const menu = new InlineKeyboard()
  .text("➕ Добавить лида", "menu:new").row()
  .text("📋 Мои лиды", "menu:list").text("⚠️ Требуют уточнения", "menu:incomplete").row()
  .text("🔎 Найти лида", "menu:search");

function cancelKeyboard(extra = []) {
  const keyboard = new InlineKeyboard();
  for (const [text, data] of extra) keyboard.text(text, data);
  if (extra.length) keyboard.row();
  return keyboard.text("⏭ Пропустить", "flow:skip").text("❌ Отмена", "flow:cancel");
}

function leadCard(lead) {
  const username = lead["Telegram менеджера"];
  const managerLink = username?.startsWith("@")
    ? `<a href="https://t.me/${escapeHtml(username.slice(1))}">${escapeHtml(username)}</a>`
    : escapeHtml(username || "Ник не установлен");
  const value = (field) => escapeHtml(lead[field] || "—");
  const missing = missingFields(lead);
  return [
    `<b>Лид ${value("ID лида")}</b>`,
    `📅 Дата обращения: ${value("Дата обращения")}`,
    `👤 Имя: ${value("Имя лида")}`,
    `☎️ Контакты: ${value("Контакты")}`,
    `🏙 Город: ${value("Город")}`,
    `📦 Товар: ${value("Товар")}`,
    `📊 Единиц в месяц: ${value("Единиц в месяц")}`,
    `📌 Статус: ${value("Статус")}`,
    `📝 Комментарий: ${value("Комментарий")}`,
    `\nОтветственный: ${value("Менеджер")} (${managerLink})`,
    missing.length ? `⚠️ Не заполнено: ${escapeHtml(missing.join(", "))}` : "✅ Карточка заполнена",
  ].join("\n");
}

function cardKeyboard(id) {
  return new InlineKeyboard()
    .text("✏️ Редактировать", `lead:edit:${id}`).row()
    .text("📌 Изменить статус", `lead:status:${id}`).row()
    .text("⬅️ В меню", "menu:home");
}

function listKeyboard(leads) {
  const keyboard = new InlineKeyboard();
  for (const lead of leads.slice(0, 20)) {
    const title = `${lead["Имя лида"] || "Без имени"} · ${lead["Город"] || "город не указан"}`;
    keyboard.text(title.slice(0, 45), `lead:view:${lead["ID лида"]}`).row();
  }
  return keyboard.text("⬅️ В меню", "menu:home");
}

export function createBot(config, store) {
  const bot = new Bot(config.telegramToken);
  const sessions = new Map();
  const key = (ctx) => String(ctx.from.id);
  const isAdmin = (ctx) => config.adminIds.has(key(ctx));
  const visible = (ctx, lead) => canSeeLead(lead, key(ctx), isAdmin(ctx));

  bot.use(async (ctx, next) => {
    if (!ctx.from || !config.allowedIds.has(key(ctx))) {
      if (ctx.callbackQuery) await ctx.answerCallbackQuery();
      await ctx.reply("⛔ У вас нет доступа к этому боту.");
      return;
    }
    await next();
  });

  async function showMenu(ctx, text = "Выберите действие:") {
    await ctx.reply(text, { reply_markup: menu });
  }

  async function askNewField(ctx) {
    const session = sessions.get(key(ctx));
    const [field, question, defaultToday] = NEW_FIELDS[session.index];
    const extra = defaultToday ? [["Сегодня", "flow:today"]] : [];
    await ctx.reply(`<b>${escapeHtml(question)}</b>\n\nЕсли ответа пока нет — нажмите «Пропустить».`, {
      parse_mode: "HTML", reply_markup: cancelKeyboard(extra),
    });
  }

  async function finishNewLead(ctx) {
    const session = sessions.get(key(ctx));
    const now = new Date();
    const lead = {
      ...session.data,
      "ID лида": generateLeadId(now),
      "Статус": "Новый",
      "Менеджер": managerName(ctx.from),
      "Telegram менеджера": telegramUsername(ctx.from),
      "Telegram ID менеджера": key(ctx),
      "Дата создания": formatDate(now, config.timeZone, true),
      "Дата изменения": formatDate(now, config.timeZone, true),
    };
    sessions.delete(key(ctx));
    const duplicate = await store.findDuplicate(lead["Контакты"]);
    const saved = await store.add(lead);
    const warning = duplicate
      ? `\n\n⚠️ Похожий контакт уже есть у лида ${escapeHtml(duplicate["ID лида"])}.`
      : "";
    await ctx.reply(`${leadCard(saved)}${warning}`, {
      parse_mode: "HTML", reply_markup: cardKeyboard(saved["ID лида"]),
    });
  }

  async function acceptNewValue(ctx, value) {
    const session = sessions.get(key(ctx));
    const [field] = NEW_FIELDS[session.index];
    session.data[field] = value;
    session.index += 1;
    if (session.index >= NEW_FIELDS.length) await finishNewLead(ctx);
    else await askNewField(ctx);
  }

  bot.command("start", async (ctx) => showMenu(ctx, `Здравствуйте, ${escapeHtml(managerName(ctx.from))}!`));
  bot.command("menu", showMenu);
  bot.command("cancel", async (ctx) => {
    sessions.delete(key(ctx));
    await showMenu(ctx, "Действие отменено.");
  });

  bot.callbackQuery("menu:home", async (ctx) => {
    await ctx.answerCallbackQuery();
    await showMenu(ctx);
  });
  bot.callbackQuery("menu:new", async (ctx) => {
    await ctx.answerCallbackQuery();
    sessions.set(key(ctx), { type: "new", index: 0, data: {} });
    await askNewField(ctx);
  });
  bot.callbackQuery("flow:cancel", async (ctx) => {
    await ctx.answerCallbackQuery();
    sessions.delete(key(ctx));
    await showMenu(ctx, "Добавление отменено.");
  });
  bot.callbackQuery("flow:skip", async (ctx) => {
    await ctx.answerCallbackQuery();
    const session = sessions.get(key(ctx));
    if (!session || session.type !== "new") return;
    await acceptNewValue(ctx, "");
  });
  bot.callbackQuery("flow:today", async (ctx) => {
    await ctx.answerCallbackQuery();
    const session = sessions.get(key(ctx));
    if (!session || session.type !== "new" || session.index !== 0) return;
    await acceptNewValue(ctx, formatDate(new Date(), config.timeZone));
  });

  async function showLeadList(ctx, onlyIncomplete = false) {
    const rows = await store.all();
    const leads = rows.map(({ lead }) => lead)
      .filter((lead) => visible(ctx, lead))
      .filter((lead) => !onlyIncomplete || missingFields(lead).length > 0)
      .reverse();
    if (!leads.length) {
      await showMenu(ctx, onlyIncomplete ? "Нет лидов, требующих уточнения." : "Список лидов пока пуст.");
      return;
    }
    await ctx.reply(onlyIncomplete ? "Лиды, которые нужно дозаполнить:" : "Последние лиды:", {
      reply_markup: listKeyboard(leads),
    });
  }

  bot.callbackQuery("menu:list", async (ctx) => {
    await ctx.answerCallbackQuery();
    await showLeadList(ctx);
  });
  bot.callbackQuery("menu:incomplete", async (ctx) => {
    await ctx.answerCallbackQuery();
    await showLeadList(ctx, true);
  });
  bot.callbackQuery("menu:search", async (ctx) => {
    await ctx.answerCallbackQuery();
    sessions.set(key(ctx), { type: "search" });
    await ctx.reply("Введите имя, контакт, ID, город или товар:", {
      reply_markup: new InlineKeyboard().text("❌ Отмена", "flow:cancel"),
    });
  });

  bot.callbackQuery(/^lead:view:(.+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const id = ctx.match[1];
    const found = await store.findById(id);
    if (!found || !visible(ctx, found.lead)) return ctx.reply("Лид не найден или у вас нет доступа.");
    await ctx.reply(leadCard(found.lead), { parse_mode: "HTML", reply_markup: cardKeyboard(id) });
  });

  bot.callbackQuery(/^lead:edit:(.+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const id = ctx.match[1];
    const found = await store.findById(id);
    if (!found || !visible(ctx, found.lead)) return ctx.reply("Лид не найден или у вас нет доступа.");
    const keyboard = new InlineKeyboard();
    EDITABLE_FIELDS.forEach(([label], index) => keyboard.text(label, `edit:${index}:${id}`).row());
    keyboard.text("⬅️ К карточке", `lead:view:${id}`);
    await ctx.reply("Какое поле изменить?", { reply_markup: keyboard });
  });

  bot.callbackQuery(/^edit:(\d+):(.+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const [, fieldIndex, id] = ctx.match;
    const field = EDITABLE_FIELDS[Number(fieldIndex)]?.[0];
    const found = await store.findById(id);
    if (!field || !found || !visible(ctx, found.lead)) return ctx.reply("Поле или лид не найден.");
    sessions.set(key(ctx), { type: "edit", id, field });
    await ctx.reply(`Введите новое значение для поля «${field}»:`, {
      reply_markup: new InlineKeyboard().text("Очистить поле", "edit:clear").text("❌ Отмена", "flow:cancel"),
    });
  });

  bot.callbackQuery("edit:clear", async (ctx) => {
    await ctx.answerCallbackQuery();
    const session = sessions.get(key(ctx));
    if (!session || session.type !== "edit") return;
    const updated = await store.update(session.id, {
      [session.field]: "", "Дата изменения": formatDate(new Date(), config.timeZone, true),
    });
    sessions.delete(key(ctx));
    await ctx.reply(leadCard(updated), { parse_mode: "HTML", reply_markup: cardKeyboard(updated["ID лида"]) });
  });

  bot.callbackQuery(/^lead:status:(.+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const id = ctx.match[1];
    const found = await store.findById(id);
    if (!found || !visible(ctx, found.lead)) return ctx.reply("Лид не найден или у вас нет доступа.");
    const keyboard = new InlineKeyboard();
    STATUSES.forEach((status, index) => keyboard.text(status, `status:${index}:${id}`).row());
    await ctx.reply("Выберите новый статус:", { reply_markup: keyboard });
  });

  bot.callbackQuery(/^status:(\d+):(.+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const [, statusIndex, id] = ctx.match;
    const status = STATUSES[Number(statusIndex)];
    const found = await store.findById(id);
    if (!status || !found || !visible(ctx, found.lead)) return ctx.reply("Статус или лид не найден.");
    const updated = await store.update(id, {
      "Статус": status, "Дата изменения": formatDate(new Date(), config.timeZone, true),
    });
    await ctx.reply(leadCard(updated), { parse_mode: "HTML", reply_markup: cardKeyboard(id) });
  });

  bot.on("message:text", async (ctx) => {
    const session = sessions.get(key(ctx));
    if (!session) return showMenu(ctx, "Используйте кнопки меню.");
    if (session.type === "new") return acceptNewValue(ctx, ctx.message.text.trim());
    if (session.type === "edit") {
      const updated = await store.update(session.id, {
        [session.field]: ctx.message.text.trim(),
        "Дата изменения": formatDate(new Date(), config.timeZone, true),
      });
      sessions.delete(key(ctx));
      return ctx.reply(leadCard(updated), { parse_mode: "HTML", reply_markup: cardKeyboard(updated["ID лида"]) });
    }
    if (session.type === "search") {
      sessions.delete(key(ctx));
      const matches = await store.search(ctx.message.text, (lead) => visible(ctx, lead));
      if (!matches.length) return showMenu(ctx, "Ничего не найдено.");
      return ctx.reply(`Найдено: ${matches.length}`, { reply_markup: listKeyboard(matches) });
    }
  });

  bot.catch(({ error }) => console.error("Ошибка Telegram-бота:", error));
  return bot;
}
