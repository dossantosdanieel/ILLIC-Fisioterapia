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

export interface ExercicioSessaoPayload {
  exercicio_id: string
  nota: string
  ordem: number
  regra_progressao?: string | null
  series?: number
  reps?: number | null
  tempo_seg?: number | null
  carga_tipo?: string
  carga_valor?: string
}

export interface SessaoPayload {
  nome: string
  exercicios: ExercicioSessaoPayload[]
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
    sessoes?: SessaoPayload[]   // templates de sessão — criados em cada microciclo
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
      const { data: microciclosData, error: errM } = await supabase
        .from('microciclo').insert(microciclos).select('id')
      if (errM) throw errM

      // Cria sessao_template para cada microciclo
      if (f.sessoes && f.sessoes.length > 0 && microciclosData) {
        for (const micro of microciclosData) {
          for (const sessao of f.sessoes) {
            const { data: st, error: errSt } = await supabase
              .from('sessao_template')
              .insert({ microciclo_id: micro.id, nome: sessao.nome })
              .select('id').single()
            if (errSt) throw errSt

            if (sessao.exercicios.length > 0) {
              const { data: bloco, error: errB } = await supabase
                .from('bloco')
                .insert({ sessao_template_id: st.id, nome: 'Exercícios', ordem: 1 })
                .select('id').single()
              if (errB) throw errB

              const { error: errEx } = await supabase.from('exercicio_prescrito').insert(
                sessao.exercicios.map(ex => ({
                  bloco_id: bloco.id,
                  exercicio_id: ex.exercicio_id,
                  series: ex.series ?? 3,
                  reps: ex.reps ?? null,
                  tempo_seg: ex.tempo_seg ?? null,
                  carga_tipo: (ex.carga_tipo ?? 'kg') as 'kg',
                  carga_valor: ex.carga_valor ?? '0',
                  nota: ex.nota || null,
                  condicional: false,
                  ordem: ex.ordem,
                  regra_progressao: ex.regra_progressao || null,
                }))
              )
              if (errEx) throw errEx
            }
          }
        }
      }
    } else {
      // sem microciclos — não cria sessões
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

// ── Fases — atualização ────────────────────────────────────

export async function atualizarObjetivosFase(faseId: string, objetivos: string[]) {
  const { error } = await supabase
    .from('fase').update({ objetivos }).eq('id', faseId)
  if (error) throw error
}

export async function atualizarFase(faseId: string, patch: {
  nome?: string
  semana_inicio?: number
  semana_fim?: number
  objetivos?: string[]
}) {
  const { error } = await supabase
    .from('fase').update(patch).eq('id', faseId)
  if (error) throw error
}

// ── Critérios — CRUD individual ────────────────────────────

export async function criarCriterio(
  faseId: string,
  criterio: { medida_id: string; operador: OperadorCriterio; valor_alvo: number },
) {
  const { data, error } = await supabase
    .from('criterio_fase')
    .insert({ fase_id: faseId, ...criterio })
    .select()
    .single()
  if (error) throw error
  return data!
}

export async function atualizarCriterio(
  criterioId: string,
  patch: { medida_id?: string; operador?: OperadorCriterio; valor_alvo?: number },
) {
  const { error } = await supabase
    .from('criterio_fase').update(patch).eq('id', criterioId)
  if (error) throw error
}

export async function removerCriterio(criterioId: string) {
  const { error } = await supabase
    .from('criterio_fase').delete().eq('id', criterioId)
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
