import { supabase } from '@/lib/supabase'
import type { Database, DirecaoMelhora, OperadorCriterio } from '@/types/database'
import type { AvaliacaoCompleta, FaseCriterios } from '@/types/queries'

type AvaliacaoInsert = Database['public']['Tables']['avaliacao']['Insert']
type ValorMedidaInsert = Database['public']['Tables']['valor_medida']['Insert']

// ── Avaliações ─────────────────────────────────────────────

export async function listarAvaliacoesDoPaciente(pacienteId: string): Promise<AvaliacaoCompleta[]> {
  const { data, error } = await supabase
    .from('avaliacao')
    .select(`*, profissional:profissional_id(nome), valor_medida(*, medida(*))`)
    .eq('paciente_id', pacienteId)
    .order('data', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as AvaliacaoCompleta[]
}

export async function buscarAvaliacao(id: string): Promise<AvaliacaoCompleta> {
  const { data, error } = await supabase
    .from('avaliacao')
    .select(`*, profissional:profissional_id(nome), valor_medida(*, medida(*))`)
    .eq('id', id)
    .single()
  if (error) throw error
  return data as unknown as AvaliacaoCompleta
}

export interface RegistrarAvaliacaoPayload {
  avaliacao: AvaliacaoInsert & { observacoes?: string | null; campos_adicionais?: { nome: string; valor: string; unidade: string }[] }
  valores: { medida_id: string; valor: number }[]
}

export async function registrarAvaliacao(payload: RegistrarAvaliacaoPayload) {
  const { data: av, error: errAv } = await supabase
    .from('avaliacao')
    .insert(payload.avaliacao)
    .select()
    .single()
  if (errAv) throw errAv

  if (payload.valores.length > 0) {
    const inserts: ValorMedidaInsert[] = payload.valores.map(v => ({
      avaliacao_id: av!.id,
      medida_id: v.medida_id,
      valor: v.valor,
    }))
    const { error: errV } = await supabase.from('valor_medida').insert(inserts)
    if (errV) throw errV
  }

  return av!
}

// ── Motor de critérios ─────────────────────────────────────

export interface ResultadoCriterio {
  criterio_id: string
  medida_nome: string
  medida_unidade: string
  operador: OperadorCriterio
  valor_alvo: number
  valor_obtido: number | null
  direcao_melhora: DirecaoMelhora
  atingido: boolean | null
  delta: number | null
}

export interface ResultadoFase {
  fase_id: string
  fase_nome: string
  criterios: ResultadoCriterio[]
  todos_atingidos: boolean | null
}

export async function avaliarCriterios(
  planoId: string,
  avaliacaoId: string,
): Promise<ResultadoFase[]> {
  // Buscar fases + critérios
  const { data: fasesRaw, error: errF } = await supabase
    .from('fase')
    .select(`
      id, nome,
      criterio_fase(id, operador, valor_alvo, medida(id, nome, unidade, direcao_melhora))
    `)
    .eq('plano_id', planoId)
    .order('ordem')
  if (errF) throw errF

  const fases = (fasesRaw ?? []) as unknown as FaseCriterios[]

  // Buscar valores da avaliação
  const { data: valoresRaw, error: errV } = await supabase
    .from('valor_medida')
    .select('medida_id, valor')
    .eq('avaliacao_id', avaliacaoId)
  if (errV) throw errV

  const mapaValores = new Map((valoresRaw ?? []).map(v => [v.medida_id, v.valor]))

  return fases.map(fase => {
    const criterios: ResultadoCriterio[] = fase.criterio_fase.map(c => {
      const valorObtido = mapaValores.get(c.medida.id) ?? null
      let atingido: boolean | null = null
      let delta: number | null = null

      if (valorObtido !== null) {
        if (c.operador === '>=') atingido = valorObtido >= c.valor_alvo
        else if (c.operador === '<=') atingido = valorObtido <= c.valor_alvo
        else atingido = valorObtido === c.valor_alvo

        delta = c.medida.direcao_melhora === 'maior'
          ? valorObtido - c.valor_alvo
          : c.valor_alvo - valorObtido
      }

      return {
        criterio_id: c.id,
        medida_nome: c.medida.nome,
        medida_unidade: c.medida.unidade,
        operador: c.operador,
        valor_alvo: c.valor_alvo,
        valor_obtido: valorObtido,
        direcao_melhora: c.medida.direcao_melhora,
        atingido,
        delta,
      }
    })

    const comDados = criterios.filter(c => c.atingido !== null)
    const todos_atingidos =
      criterios.length === 0 ? null
      : comDados.length === 0 ? null
      : comDados.every(c => c.atingido) && comDados.length === criterios.length
        ? true
        : false

    return { fase_id: fase.id, fase_nome: fase.nome, criterios, todos_atingidos }
  })
}
