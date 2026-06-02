import { supabase } from '@/lib/supabase'
import type { Database, Prioridade } from '@/types/database'
import type { PacienteComPlano, PacienteDetalhe } from '@/types/queries'

type PacienteInsert = Database['public']['Tables']['paciente']['Insert']

export async function listarPacientes(fisioId?: string): Promise<PacienteComPlano[]> {
  let q = supabase
    .from('paciente')
    .select(`
      *,
      profissional:fisio_responsavel_id(id, nome),
      plano_tratamento(id, status, prognostico_semanas, data_av_inicial, frequencia_semanal)
    `)
    .eq('ativo', true)
    .order('nome')

  if (fisioId) q = q.eq('fisio_responsavel_id', fisioId)

  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as unknown as PacienteComPlano[]
}

export async function buscarPaciente(id: string): Promise<PacienteDetalhe> {
  const { data, error } = await supabase
    .from('paciente')
    .select(`*, profissional:fisio_responsavel_id(id, nome, crefito)`)
    .eq('id', id)
    .single()
  if (error) throw error
  return data as unknown as PacienteDetalhe
}

export async function criarPaciente(
  payload: Omit<PacienteInsert, 'fisio_responsavel_id'> & { fisio_responsavel_id: string },
) {
  const { data, error } = await supabase
    .from('paciente')
    .insert(payload)
    .select()
    .single()
  if (error) throw error
  return data!
}

export async function atualizarPaciente(id: string, payload: Partial<PacienteInsert>) {
  const { data, error } = await supabase
    .from('paciente')
    .update(payload)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data!
}

export function prioridadeBadge(p: Prioridade): 'danger' | 'warning' | 'muted' {
  return p === 'alta' ? 'danger' : p === 'moderada' ? 'warning' : 'muted'
}

export function prioridadeLabel(p: Prioridade) {
  return p === 'alta' ? 'Alta' : p === 'moderada' ? 'Moderada' : 'Baixa'
}
