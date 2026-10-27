import { requireSupabase } from '@/lib/supabase'
import type { DbRow } from '@/types/domain'

export async function readTable(table: string) {
  const { data, error } = await requireSupabase().from(table).select('*').order('id', { ascending: false })
  if (error) throw error
  return (data ?? []) as DbRow[]
}

export function errorMessage(error: unknown, fallback = 'No se pudo completar la operación.') {
  if (!(error instanceof Error)) return fallback
  if (error.message.includes('row-level security')) return 'Supabase bloqueó esta acción. Revisa las políticas RLS del proyecto.'
  return error.message || fallback
}
