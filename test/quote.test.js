import assert from "node:assert/strict";
import test from "node:test";
import ExcelJS from "exceljs";
import { calculateQuote } from "../src/calculator.js";
import { buildQuoteWorkbook } from "../src/quote.js";

test("формируется Excel-КП из шаблона с листом расчёта", async () => {
  const config = { quoteTemplateFile: "./templates/КП_Фокси_Логистика_шаблон.xlsx" };
  const lead = { "Имя лида": "Тестовый клиент" };
  const input = {
    productType: "standard", units: 1200, markedUnits: 0, pallets: 0,
    boxes: 0, storagePallets: 0, storageDays: 0, returnUnits: 0,
    returnTrips: 0, cabinets: 0,
  };
  const buffer = await buildQuoteWorkbook(config, lead, input, calculateQuote(input), "КП-TEST");
  assert.ok(buffer.length > 10000);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  assert.ok(workbook.getWorksheet("КП"));
  assert.ok(workbook.getWorksheet("Расчёт"));
  assert.match(String(workbook.getWorksheet("КП").getCell("A6").value), /Тестовый клиент/);
});
