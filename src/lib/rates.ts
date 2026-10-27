import type { DbRow } from '@/types/domain'

export function rateCurrency(row: DbRow) {
  return String(row.moneda_origen ?? row.moneda ?? row.codigo ?? row.codigo_moneda ?? row.divisa ?? '').trim().toUpperCase()
}

export function rateAmount(row: DbRow) {
  return row.tasa_a_base ?? row.tasa_base ?? row.tasa ?? row.valor_tasa ?? row.valor ?? ''
}

export function latestRate(rows: DbRow[], currency: string) {
  return rows
    .filter((row) => rateCurrency(row) === currency.toUpperCase() && String(row.moneda_destino ?? 'COP').toUpperCase() === 'COP')
    .sort((left, right) => {
      const leftDate = Date.parse(String(left.fecha ?? left.created_at ?? '')) || 0
      const rightDate = Date.parse(String(right.fecha ?? right.created_at ?? '')) || 0
      return rightDate - leftDate || Number(right.id ?? 0) - Number(left.id ?? 0)
    })[0]
}
