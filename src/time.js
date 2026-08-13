export function formatDate(date, timeZone, withTime = false) {
  const options = {
    timeZone,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false } : {}),
  };
  return new Intl.DateTimeFormat("ru-RU", options).format(date).replace(",", "");
}
