const CURRENCY_CONFIG: Record<string, { locale: string; symbol: string }> = {
  CAD: { locale: "en-CA", symbol: "CA$" },
  AED: { locale: "ar-AE", symbol: "AED" },
  USD: { locale: "en-US", symbol: "$" },
  GBP: { locale: "en-GB", symbol: "£" },
  EUR: { locale: "en-IE", symbol: "€" },
}

export function formatCurrency(
  amount: number,
  currency: string = "CAD"
): string {
  const config = CURRENCY_CONFIG[currency] ?? CURRENCY_CONFIG.CAD
  return new Intl.NumberFormat(config.locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatCurrencyCompact(
  amount: number,
  currency: string = "CAD"
): string {
  const config = CURRENCY_CONFIG[currency] ?? CURRENCY_CONFIG.CAD
  return new Intl.NumberFormat(config.locale, {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(amount)
}

export const SUPPORTED_CURRENCIES = Object.keys(CURRENCY_CONFIG)
