import { supabase } from '@/lib/supabase'
import type { Database, OperadorCriterio } from '@/types/database'
import type { PlanoCompleto, FaseCriterios } from '@/types/queries'

type PlanoInsert = Database['public']['Tables']['plano_tratamento']['Insert']
type FaseInsert = Database['public']['Tables']['fase']['Insert']
type CriterioInsert = Database['public']['Tables']['criterio_fase']['Insert']
type MicrocicloInsert = Database['public']['Tables']['microciclo']['Insert']

// ── Plano ──────────────────────────────────────────────────

export async function buscarPlanoCompleto(planoId: string): Promise<PlanoCompleto> {
  const { data, error } = await supabase
    .from('plano_tratamento')
    .select(`
      *,
      paciente:paciente_id(id, nome, prioridade),
      fase(
        *,
        criterio_fase(*, medida(*)),
        microciclo(*, sessao_template(*))
      )
    `)
    .eq('id', planoId)
    .order('ordem', { referencedTable: 'fase' })
    .single()
  if (error) throw error
  return data as unknown as PlanoCompleto
}

export async function listarPlanosDoPaciente(pacienteId: string) {
  const { data, error } = await supabase
    .from('plano_tratamento')
    .select('*')
    .eq('paciente_id', pacienteId)
    .order('criado_em', { ascending: false })
  if (error) throw error
  return data ?? []
}

export interface CriarPlanoPayload {
  plano: Omit<PlanoInsert, 'fisio_id'>
  fases: {
    nome: string
    ordem: number
    semana_inicio: number
    semana_fim: number
    objetivos: string[]
    criterios: { medida_id: string; operador: OperadorCriterio; valor_alvo: number }[]
  }[]
}

export async function criarPlanoCompleto(fisioId: string, payload: CriarPlanoPayload) {
  const { data: plano, error: errPlano } = await supabase
    .from('plano_tratamento')
    .insert({ ...payload.plano, fisio_id: fisioId })
    .select()
    .single()
  if (errPlano) throw errPlano

  for (const f of payload.fases) {
    const fasePayload: FaseInsert = {
      plano_id: plano!.id,
      ordem: f.ordem,
      nome: f.nome,
      semana_inicio: f.semana_inicio,
      semana_fim: f.semana_fim,
      objetivos: f.objetivos,
    }
    const { data: fase, error: errFase } = await supabase
      .from('fase')
      .insert(fasePayload)
      .select()
      .single()
    if (errFase) throw errFase

    if (f.criterios.length > 0) {
      const criteriosPayload: CriterioInsert[] = f.criterios.map(c => ({
        fase_id: fase!.id,
        medida_id: c.medida_id,
        operador: c.operador,
        valor_alvo: c.valor_alvo,
      }))
      const { error: errC } = await supabase.from('criterio_fase').insert(criteriosPayload)
      if (errC) throw errC
    }

    // Microciclos de 2 semanas
    const microciclos: MicrocicloInsert[] = []
    let sem = f.semana_inicio
    let ordem = 1
    while (sem <= f.semana_fim) {
      microciclos.push({
        fase_id: fase!.id,
        ordem,
        semana_inicio: sem,
        semana_fim: Math.min(sem + 1, f.semana_fim),
      })
      sem += 2
      ordem++
    }
    if (microciclos.length > 0) {
      const { error: errM } = await supabase.from('microciclo').insert(microciclos)
      if (errM) throw errM
    }
  }

  return plano!
}

export async function atualizarStatusPlano(
  planoId: string,
  status: Database['public']['Tables']['plano_tratamento']['Row']['status'],
) {
  const { error } = await supabase.from('plano_tratamento').update({ status }).eq('id', planoId)
  if (error) throw error
}

// ── Medidas ────────────────────────────────────────────────

export async function listarMedidas() {
  const { data, error } = await supabase
    .from('medida')
    .select('*')
    .eq('ativo', true)
    .order('nome')
  if (error) throw error
  return data ?? []
}

// ── Fases para motor de critérios ──────────────────────────

export async function listarFasesComCriterios(planoId: string): Promise<FaseCriterios[]> {
  const { data, error } = await supabase
    .from('fase')
    .select(`
      id, nome,
      criterio_fase(id, operador, valor_alvo, medida(id, nome, unidade, direcao_melhora))
    `)
    .eq('plano_id', planoId)
    .order('ordem')
  if (error) throw error
  return (data ?? []) as unknown as FaseCriterios[]
}
