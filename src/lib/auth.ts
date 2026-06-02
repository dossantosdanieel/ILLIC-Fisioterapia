import { supabase } from './supabase'
import type { Papel } from '@/types/database'

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function getSession() {
  const { data } = await supabase.auth.getSession()
  return data.session
}

export async function getProfissionalAtual() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('profissional')
    .select('*')
    .eq('auth_id', user.id)
    .single()
  return data
}

export function isPapel(papel: Papel, minimo: Papel): boolean {
  const ordem: Record<Papel, number> = {
    fisioterapeuta: 0,
    coordenador: 1,
    admin: 2,
  }
  return ordem[papel] >= ordem[minimo]
}
