import assert from "node:assert/strict";
import test from "node:test";
import {
  canSeeLead, contactKey, leadToRow, managerName, missingFields, normalizeLead,
  rowToLead, telegramUsername,
} from "../src/leads.js";
import { HEADERS } from "../src/constants.js";

test("неполный лид получает статус и список незаполненных полей", () => {
  const lead = normalizeLead({ "Имя лида": "Ирина", "Контакты": "+7 900 111-22-33" });
  assert.equal(lead["Статус"], "Требуется уточнение");
  assert.deepEqual(missingFields(lead), ["Город", "Товар", "Единиц в месяц"]);
  assert.equal(lead["Не заполнено"], "Город, Товар, Единиц в месяц");
});

test("преобразование строки Google Sheets не меняет данные", () => {
  const source = Object.fromEntries(HEADERS.map((header) => [header, `${header}: значение`]));
  source["Не заполнено"] = "";
  const restored = rowToLead(leadToRow(source));
  assert.deepEqual(restored, source);
});

test("данные менеджера берутся из Telegram", () => {
  const from = { first_name: "Данил", last_name: "Иванов", username: "danil_manager" };
  assert.equal(managerName(from), "Данил Иванов");
  assert.equal(telegramUsername(from), "@danil_manager");
  assert.equal(telegramUsername({ first_name: "Ирина" }), "Ник не установлен");
});

test("менеджер видит только свои лиды, администратор — все", () => {
  const lead = { "Telegram ID менеджера": "100" };
  assert.equal(canSeeLead(lead, "100", false), true);
  assert.equal(canSeeLead(lead, "200", false), false);
  assert.equal(canSeeLead(lead, "200", true), true);
});

test("контакты нормализуются для поиска дублей", () => {
  assert.equal(contactKey("+7 (999) 000-00-00"), "79990000000");
  assert.equal(contactKey(" @Client "), "@client");
});
