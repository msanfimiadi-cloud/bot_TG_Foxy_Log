import fs from "node:fs/promises";
import { google } from "googleapis";
import { HEADERS } from "./constants.js";
import { contactKey, leadToRow, normalizeLead, rowToLead } from "./leads.js";

function quoteSheetName(name) {
  return `'${name.replaceAll("'", "''")}'`;
}

export class GoogleSheetsLeadStore {
  constructor(config) {
    this.config = config;
    this.sheets = null;
    this.auth = null;
  }

  async init() {
    let credentials;
    if (this.config.serviceAccountJson) {
      try {
        credentials = JSON.parse(this.config.serviceAccountJson);
      } catch {
        throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON содержит некорректный JSON");
      }
    } else {
      credentials = JSON.parse(await fs.readFile(this.config.serviceAccountFile, "utf8"));
    }

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: [
        "https://www.googleapis.com/auth/spreadsheets",
        "https://www.googleapis.com/auth/drive",
      ],
    });
    this.auth = auth;
    this.sheets = google.sheets({ version: "v4", auth });
    await this.assertHeaders();
  }

  async assertHeaders() {
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.config.spreadsheetId,
      range: `${quoteSheetName(this.config.sheetName)}!A1:U1`,
    });
    const actual = response.data.values?.[0] ?? [];
    const legacyMatches = HEADERS.slice(0, 15).every((header, index) => actual[index] === header);
    if (!legacyMatches) {
      throw new Error(`Заголовки листа «${this.config.sheetName}» не совпадают с шаблоном`);
    }
    const quoteHeadersMissing = HEADERS.slice(15).some((header, offset) => actual[offset + 15] !== header);
    if (quoteHeadersMissing) {
      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.config.spreadsheetId,
        range: `${quoteSheetName(this.config.sheetName)}!P1:U1`,
        valueInputOption: "RAW",
        requestBody: { values: [HEADERS.slice(15)] },
      });
    }
  }

  async all() {
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.config.spreadsheetId,
      range: `${quoteSheetName(this.config.sheetName)}!A2:U`,
    });
    return (response.data.values ?? [])
      .map((row, index) => ({ lead: rowToLead(row), rowNumber: index + 2, raw: row }))
      .filter(({ raw }) => raw.some((cell) => String(cell).trim()))
      .map(({ lead, rowNumber }) => ({ lead, rowNumber }));
  }

  async add(lead) {
    const normalized = normalizeLead(lead);
    await this.sheets.spreadsheets.values.append({
      spreadsheetId: this.config.spreadsheetId,
      range: `${quoteSheetName(this.config.sheetName)}!A:U`,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [leadToRow(normalized)] },
    });
    return normalized;
  }

  async findById(id) {
    const rows = await this.all();
    return rows.find(({ lead }) => lead["ID лида"] === id) ?? null;
  }

  async update(id, patch) {
    const found = await this.findById(id);
    if (!found) return null;
    const updated = normalizeLead({ ...found.lead, ...patch });
    await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.config.spreadsheetId,
      range: `${quoteSheetName(this.config.sheetName)}!A${found.rowNumber}:U${found.rowNumber}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [leadToRow(updated)] },
    });
    return updated;
  }

  async search(query, predicate = () => true) {
    const needle = String(query).trim().toLowerCase();
    const rows = await this.all();
    return rows
      .map(({ lead }) => lead)
      .filter(predicate)
      .filter((lead) => ["ID лида", "Имя лида", "Контакты", "Город", "Товар"]
        .some((field) => String(lead[field]).toLowerCase().includes(needle)));
  }

  async findDuplicate(contact) {
    const key = contactKey(contact);
    if (!key) return null;
    const rows = await this.all();
    return rows.map(({ lead }) => lead).find((lead) => contactKey(lead["Контакты"]) === key) ?? null;
  }
}
