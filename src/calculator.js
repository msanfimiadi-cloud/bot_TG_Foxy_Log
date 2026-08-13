export const STANDARD_TIERS = [
  { min: 1, max: 1000, processing: 100, acceptance: 5, storage: 90 },
  { min: 1001, max: 1499, processing: 85, acceptance: 5, storage: 80 },
  { min: 1500, max: 2500, processing: 65, acceptance: 4, storage: 75 },
  { min: 2501, max: 5000, processing: 40, acceptance: 3, storage: 75 },
  { min: 5001, max: 7000, processing: 35, acceptance: 3, storage: 75 },
];

export const KGT_RATES = {
  hanger: { label: "Вешалка 55×17×9 см, 1,5 кг", processing: 72 },
  table: { label: "Стол 74×62×6,5 см, 6 кг", processing: 126 },
  garden: { label: "Набор садовой мебели 91×52×30 см, 23,5 кг", processing: 243 },
};

const COMMON = {
  palletHandling: 350,
  boxHandling: 35,
  honestSignScan: 5,
  returnTrip: 1500,
  unifiedStock: 3000,
};

const money = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

export function standardTier(units) {
  return STANDARD_TIERS.find((tier) => units >= tier.min && units <= tier.max) ?? null;
}

export function calculateQuote(input) {
  const units = Number(input.units);
  if (!Number.isFinite(units) || units < 1) throw new Error("Количество единиц должно быть больше нуля");

  let rates;
  if (input.productType === "standard") {
    const tier = standardTier(units);
    if (!tier) throw new Error("Для объёма более 7 000 единиц требуется индивидуальный расчёт");
    rates = { ...tier, returns: 25 };
  } else {
    const kgt = KGT_RATES[input.kgtType];
    if (!kgt) throw new Error("Не выбрана категория КГТ");
    rates = { processing: kgt.processing, acceptance: 0, storage: 75, returns: 35 };
  }

  const quantities = {
    markedUnits: Number(input.markedUnits || 0),
    pallets: Number(input.pallets || 0),
    boxes: Number(input.boxes || 0),
    storagePallets: Number(input.storagePallets || 0),
    storageDays: Number(input.storageDays || 0),
    returnUnits: Number(input.returnUnits || 0),
    returnTrips: Number(input.returnTrips || 0),
    cabinets: Number(input.cabinets || 0),
  };
  if (Object.values(quantities).some((value) => !Number.isFinite(value) || value < 0)) {
    throw new Error("Параметры расчёта не могут быть отрицательными");
  }

  const lines = [
    { key: "processing", service: "Обработка товара", quantity: units, unit: "ед.", rate: rates.processing },
    ...(rates.acceptance ? [{ key: "acceptance", service: "Приёмка товара", quantity: units, unit: "ед.", rate: rates.acceptance }] : []),
    { key: "honestSign", service: "Скан ЧЗ", quantity: quantities.markedUnits, unit: "ед.", rate: COMMON.honestSignScan },
    { key: "palletHandling", service: "ПРР, паллеты", quantity: quantities.pallets, unit: "паллет", rate: COMMON.palletHandling },
    { key: "boxHandling", service: "ПРР, короба", quantity: quantities.boxes, unit: "короб", rate: COMMON.boxHandling },
    { key: "storage", service: "Хранение", quantity: quantities.storagePallets * quantities.storageDays, unit: "паллето-сутки", rate: rates.storage },
    { key: "returns", service: "Обработка возвратов", quantity: quantities.returnUnits, unit: "ед.", rate: rates.returns },
    { key: "returnTrips", service: "Забор возвратов", quantity: quantities.returnTrips, unit: "рейс", rate: COMMON.returnTrip },
    { key: "unifiedStock", service: "Единый сток", quantity: quantities.cabinets, unit: "кабинет", rate: COMMON.unifiedStock },
  ].map((line) => ({ ...line, total: money(line.quantity * line.rate) }));

  const totalWithoutVat = money(lines.reduce((sum, line) => sum + line.total, 0));
  const totalWithVat = money(totalWithoutVat * 1.22);
  return { rates, quantities, lines, totalWithoutVat, totalWithVat, vatRate: 0.22 };
}
