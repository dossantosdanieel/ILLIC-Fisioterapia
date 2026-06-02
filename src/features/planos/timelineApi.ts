import { supabase } from '@/lib/supabase'

export type CorTimeline = 'blue' | 'green' | 'purple' | 'amber' | 'rose' | 'cyan' | 'slate'

export interface ObjetivoTimeline {
  id: string
  plano_id: string
  categoria: string
  nome: string
  semana_inicio: number
  semana_fim: number
  cor: CorTimeline
  linha_ordem: number
}

export async function listarObjetivos(planoId: string): Promise<ObjetivoTimeline[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('objetivo_timeline')
    .select('*')
    .eq('plano_id', planoId)
    .order('linha_ordem')
    .order('semana_inicio')
  if (error) throw error
  return (data ?? []) as ObjetivoTimeline[]
}

export async function criarObjetivo(
  payload: Omit<ObjetivoTimeline, 'id'>,
): Promise<ObjetivoTimeline> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('objetivo_timeline')
    .insert(payload)
    .select()
    .single()
  if (error) throw error
  return data as ObjetivoTimeline
}

export async function atualizarObjetivo(
  id: string,
  patch: Partial<Omit<ObjetivoTimeline, 'id' | 'plano_id'>>,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('objetivo_timeline')
    .update(patch)
    .eq('id', id)
  if (error) throw error
}

export async function removerObjetivo(id: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('objetivo_timeline')
    .delete()
    .eq('id', id)
  if (error) throw error
}

/** Retorna a próxima ordem disponível para uma nova linha */
export function proximaOrdem(objetivos: ObjetivoTimeline[]): number {
  if (objetivos.length === 0) return 0
  return Math.max(...objetivos.map(o => o.linha_ordem)) + 1
}

/** Agrupa segmentos por categoria, mantendo a ordem da linha */
export interface Linha {
  categoria: string
  cor: CorTimeline
  linha_ordem: number
  segmentos: ObjetivoTimeline[]
}

export function agruparPorLinha(objetivos: ObjetivoTimeline[]): Linha[] {
  const mapa = new Map<string, Linha>()
  for (const o of objetivos) {
    if (!mapa.has(o.categoria)) {
      mapa.set(o.categoria, {
        categoria: o.categoria,
        cor: o.cor,
        linha_ordem: o.linha_ordem,
        segmentos: [],
      })
    }
    mapa.get(o.categoria)!.segmentos.push(o)
  }
  return [...mapa.values()].sort((a, b) => a.linha_ordem - b.linha_ordem)
}

/** Gera as células de uma linha, preenchendo os gaps com células vazias */
export interface Celula {
  tipo: 'filled' | 'empty'
  semana_inicio: number
  colspan: number
  segmento?: ObjetivoTimeline
}

export function gerarCelulas(segmentos: ObjetivoTimeline[], totalSemanas: number): Celula[] {
  const cells: Celula[] = []
  const sorted = [...segmentos].sort((a, b) => a.semana_inicio - b.semana_inicio)
  let atual = 1

  for (const seg of sorted) {
    if (seg.semana_inicio > atual) {
      cells.push({ tipo: 'empty', semana_inicio: atual, colspan: seg.semana_inicio - atual })
    }
    cells.push({
      tipo: 'filled',
      semana_inicio: seg.semana_inicio,
      colspan: seg.semana_fim - seg.semana_inicio + 1,
      segmento: seg,
    })
    atual = seg.semana_fim + 1
  }

  if (atual <= totalSemanas) {
    cells.push({ tipo: 'empty', semana_inicio: atual, colspan: totalSemanas - atual + 1 })
  }
  return cells
}
