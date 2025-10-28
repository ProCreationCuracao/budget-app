export function formatCurrency(
  value: number,
  currency: string = "USD",
  locale: string = "en-US",
  opts?: { maximumFractionDigits?: number; minimumFractionDigits?: number; currencyDisplay?: "symbol" | "narrowSymbol" | "code" | "name" }
) {
  const options = { style: "currency" as const, currency, maximumFractionDigits: 2, minimumFractionDigits: 0, ...(opts || {}) };
  try {
    return new Intl.NumberFormat(locale, options).format(value || 0);
  } catch {
    const fb = { ...options, currency: "USD" };
    return new Intl.NumberFormat("en-US", fb).format(value || 0);
  }
}

export function formatPercent(value: number, locale: string = "en-US") {
  try {
    return new Intl.NumberFormat(locale, {
      style: "percent",
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return new Intl.NumberFormat("en-US", {
      style: "percent",
      maximumFractionDigits: 0,
    }).format(value);
  }
}
