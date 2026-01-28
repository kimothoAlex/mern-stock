export function formatMoney(amount, { currency = "KES", locale = "en-KE" } = {}) {
  const n = Number(amount ?? 0);

  // If you want "KES 1,000" (no decimals)
  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number.isFinite(n) ? n : 0);

  return `${currency} ${formatted}`;
}
