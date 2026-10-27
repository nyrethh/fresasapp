export type Currency = 'COP' | 'VES' | 'USD'

const currencyPrefix: Record<Currency, string> = {
  COP: '$',
  VES: 'Bs',
  USD: 'US$',
}

const numberFormatter = new Intl.NumberFormat('es-VE', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function formatNumber(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0)
  return numberFormatter.format(Number.isFinite(parsed) ? parsed : 0)
}

export function formatMoney(value: number | string | null | undefined, currency: Currency = 'COP') {
  return `${currencyPrefix[currency]} ${formatNumber(value)}`
}

export function parseDate(value: string | Date) {
  if (value instanceof Date) return value
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (dateOnly) return new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]), 12)
  return new Date(value)
}

export function formatDate(value: string | Date | null | undefined) {
  if (!value) return '—'
  const date = parseDate(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('es-VE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

export function isoDate(value = new Date()) {
  const local = new Date(value.getTime() - value.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 10)
}
