import fs from "node:fs/promises";
import ExcelJS from "exceljs";

const output = "./templates/КП_Фокси_Логистика_шаблон.xlsx";
await fs.mkdir("./templates", { recursive: true });

const workbook = new ExcelJS.Workbook();
workbook.creator = "ООО «Фокси Логистика»";
const sheet = workbook.addWorksheet("КП", { views: [{ showGridLines: false }] });
sheet.columns = [{ width: 72 }, { width: 32 }, { width: 32 }];

const mergeTitle = (range, text, fill, color = "FFFFFFFF", size = 12) => {
  sheet.mergeCells(range);
  const cell = sheet.getCell(range.split(":")[0]);
  cell.value = text;
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };
  cell.font = { bold: true, color: { argb: color }, size };
  cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
};

sheet.mergeCells("A2:C4");
sheet.getCell("A2").value = "КОММЕРЧЕСКОЕ ПРЕДЛОЖЕНИЕ\nООО «Фокси Логистика»";
sheet.getCell("A2").font = { bold: true, size: 18, color: { argb: "FF202C3B" } };
sheet.getCell("A2").alignment = { horizontal: "center", vertical: "middle", wrapText: true };
sheet.mergeCells("A6:C6");
sheet.getCell("A6").value = "КП для клиента";
sheet.getCell("A6").alignment = { horizontal: "center" };
sheet.mergeCells("A8:C9");
sheet.getCell("A8").value = "Компания ООО «Фокси Логистика» предлагает полный комплекс услуг 3PL-оператора.";
sheet.getCell("A8").alignment = { horizontal: "center", vertical: "middle" };

let row = 11;
const dataBorder = { style: "thin", color: { argb: "FF555555" } };
const serviceRow = (values) => {
  const r = sheet.addRow(values);
  r.eachCell((cell) => {
    cell.border = { top: dataBorder, left: dataBorder, bottom: dataBorder, right: dataBorder };
    cell.alignment = { vertical: "middle", wrapText: true };
  });
  return r;
};
const section = (text) => {
  mergeTitle(`A${row}:C${row}`, text, "FFFF7414");
  sheet.getRow(row).height = 22;
  row += 1;
  const header = serviceRow(["Услуга", "без НДС", "С НДС 22%"]);
  header.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF202C3B" } };
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
  });
  row += 1;
};
const add = (values, height = 18) => {
  const r = serviceRow(values);
  r.height = height;
  row += 1;
};

for (const city of ["Новосибирск", "Екатеринбург", "Москва"]) {
  mergeTitle(`A${row}:C${row}`, city, "FFB4C7E7", "FF000000", 20);
  sheet.getRow(row).height = 30;
  row += 1;
  section("ПРИЁМКА И ХРАНЕНИЕ");
  add(["ПРР (погрузочно-разгрузочные работы)", "350 руб./паллет", "427 руб./паллет"]);
  add(["ПРР (погрузочно-разгрузочные работы)", "35 руб./короб", "42,70 руб./короб"]);
  add(["Приёмка товара", "3 руб./ед", "3,66 руб./ед"]);
  section("Подготовка товара к отгрузке");
  add(["Обработка товара (сюда включено: маркировка FBS; сборка заказа; отвоз товара на склад МП)", "40 руб./ед", "48,80 руб./ед"], 38);
  add(["Скан ЧЗ (при необходимости)", "5 руб./ед", "6,10 руб./ед"]);
  section("Дополнительные услуги");
  add(["Хранение, паллет место в сутки", "75 руб./паллет в сутки", "91,50 руб./паллет в сутки"]);
  add(["Забор возвратов", "1500 руб./рейс", "1830 руб./рейс"]);
  add(["Обработка возвратов (приёмка товара; проверка на брак/комплектность; возврат на остатки)", "25 руб./ед", "30,50 руб./ед"]);
  add(["Единый сток (1 кабинет)", "3000 руб./месяц", "3660 руб./месяц"]);
  row += 1;
}

mergeTitle(`A${row}:C${row}`, "ИНТЕГРАЦИЯ ПО API", "FFFF7414");
row += 1;
sheet.mergeCells(`A${row}:C${row + 4}`);
sheet.getCell(`A${row}`).value = "WMS система MPfit\n\n• Учёт остатков в режиме реального времени\n• Контроль движения товаров\n• API-интеграция с системами клиента\n• Формирование складской отчётности";
sheet.getCell(`A${row}`).alignment = { horizontal: "center", vertical: "middle", wrapText: true };
row += 5;
sheet.mergeCells(`A${row}:C${row + 1}`);
sheet.getCell(`A${row}`).value = "Наши склады: Новосибирск, Москва и Екатеринбург\nК вам будет прикреплён персональный менеджер в каждом городе сотрудничества";
sheet.getCell(`A${row}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF4CCCC" } };
sheet.getCell(`A${row}`).alignment = { horizontal: "center", vertical: "middle", wrapText: true };

sheet.pageSetup = { orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
await workbook.xlsx.writeFile(output);
