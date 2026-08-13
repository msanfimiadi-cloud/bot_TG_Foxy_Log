import assert from "node:assert/strict";
import test from "node:test";
import { calculateQuote, standardTier } from "../src/calculator.js";

test("выбираются все согласованные тарифные диапазоны", () => {
  assert.equal(standardTier(1000).processing, 100);
  assert.equal(standardTier(1001).processing, 85);
  assert.equal(standardTier(1499).storage, 80);
  assert.equal(standardTier(1500).processing, 65);
  assert.equal(standardTier(2501).processing, 40);
  assert.equal(standardTier(5001).processing, 35);
  assert.equal(standardTier(7001), null);
});

test("стандартное КП считает услуги и НДС 22%", () => {
  const result = calculateQuote({
    productType: "standard", units: 2000, markedUnits: 1000,
    pallets: 2, boxes: 10, storagePallets: 3, storageDays: 30,
    returnUnits: 20, returnTrips: 1, cabinets: 1,
  });
  assert.equal(result.rates.processing, 65);
  assert.equal(result.rates.acceptance, 4);
  assert.equal(result.totalWithoutVat, 155800);
  assert.equal(result.totalWithVat, 190076);
});

test("КГТ не считает приёмку второй раз", () => {
  const result = calculateQuote({
    productType: "kgt", kgtType: "table", units: 100,
    markedUnits: 0, pallets: 0, boxes: 0, storagePallets: 0,
    storageDays: 0, returnUnits: 0, returnTrips: 0, cabinets: 0,
  });
  assert.equal(result.rates.processing, 126);
  assert.equal(result.lines.some((line) => line.key === "acceptance"), false);
  assert.equal(result.totalWithoutVat, 12600);
});

test("объём более 7000 отправляется на индивидуальный расчёт", () => {
  assert.throws(() => calculateQuote({ productType: "standard", units: 7001 }), /индивидуальный расчёт/);
});
