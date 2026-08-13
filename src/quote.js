import fs from "node:fs/promises";
import ExcelJS from "exceljs";

const VAT = 1.22;
const rub = (value) => `${Number(value).toLocaleString("ru-RU", { maximumFractionDigits: 2 })} руб./ед`;
const vatRub = (value) => rub(Math.round(value * VAT * 100) / 100);

function setServiceRates(sheet, labelStart, withoutVat, withVat) {
  sheet.eachRow((row) => {
    const label = String(row.getCell(1).value ?? "");
    if (label.startsWith(labelStart)) {
      row.getCell(2).value = withoutVat;
      row.getCell(3).value = withVat;
    }
  });
}

export async function buildQuoteWorkbook(config, lead, input, calculation, quoteNumber) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(config.quoteTemplateFile);
  const sheet = workbook.getWorksheet("КП");
  if (!sheet) throw new Error("В шаблоне отсутствует лист «КП»");

  sheet.getCell("A6").value = `КП № ${quoteNumber} для ${lead["Имя лида"] || "клиента"}`;
  sheet.getCell("A6").alignment = { horizontal: "center", vertical: "middle" };
  sheet.getCell("A6").font = { bold: true, size: 12 };

  setServiceRates(sheet, "Обработка товара", rub(calculation.rates.processing), vatRub(calculation.rates.processing));
  if (calculation.rates.acceptance) {
    setServiceRates(sheet, "Приёмка товара", rub(calculation.rates.acceptance), vatRub(calculation.rates.acceptance));
  } else {
    setServiceRates(sheet, "Приёмка товара", "Включено в обработку", "Включено в обработку");
  }
  setServiceRates(sheet, "Скан ЧЗ", rub(5), vatRub(5));
  setServiceRates(sheet, "Хранение", `${calculation.rates.storage} руб./паллет в сутки`, `${calculation.rates.storage * VAT} руб./паллет в сутки`);
  setServiceRates(sheet, "Обработка возвратов", rub(calculation.rates.returns), vatRub(calculation.rates.returns));

  const calc = workbook.addWorksheet("Расчёт");
  calc.columns = [
    { header: "Услуга", key: "service", width: 34 },
    { header: "Количество", key: "quantity", width: 14 },
    { header: "Единица", key: "unit", width: 18 },
    { header: "Тариф без НДС", key: "rate", width: 18 },
    { header: "Сумма без НДС", key: "total", width: 20 },
    { header: "Сумма с НДС 22%", key: "totalVat", width: 21 },
  ];
  calculation.lines.forEach((line) => calc.addRow({ ...line, totalVat: Math.round(line.total * VAT * 100) / 100 }));
  calc.addRow([]);
  calc.addRow({ service: "ИТОГО", total: calculation.totalWithoutVat, totalVat: calculation.totalWithVat });
  calc.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  calc.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF202C3B" } };
  calc.getRow(calc.rowCount).font = { bold: true };
  calc.getColumn(4).numFmt = '#,##0.00 "₽"';
  calc.getColumn(5).numFmt = '#,##0.00 "₽"';
  calc.getColumn(6).numFmt = '#,##0.00 "₽"';
  calc.views = [{ state: "frozen", ySplit: 1 }];

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export function quoteFilename(quoteNumber, lead) {
  const safeName = String(lead["Имя лида"] || "клиент").replace(/[^a-zа-яё0-9_-]+/gi, "_").slice(0, 50);
  return `КП_${quoteNumber}_${safeName}.xlsx`;
}
