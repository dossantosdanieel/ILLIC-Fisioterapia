import { supabase } from '@/lib/supabase'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export interface ProtocoloFaseExercicio {
  id: string
  exercicio_id: string
  nota: string | null
  ordem: number
  semana_inicio: number | null
  semana_fim: number | null
  objetivo_texto: string | null
  regra_progressao: string | null
  series: number
  reps: number | null
  tempo_seg: number | null
  carga_tipo: string
  carga_valor: string
  exercicio: { nome: string; grupo_muscular: string | null } | null
}

export interface ObjetivoFase {
  texto: string
  semana_inicio: number | null
  semana_fim: number | null
}

export interface ProtocoloFase {
  id: string
  protocolo_id: string
  ordem: number
  nome: string
  semana_inicio: number
  semana_fim: number
  objetivos: ObjetivoFase[]
  protocolo_fase_exercicio: ProtocoloFaseExercicio[]
}

export interface Protocolo {
  id: string
  nome: string
  lesao: string
  descricao: string | null
  referencia: string | null
  ativo: boolean
  criado_em: string
  autor_id: string | null
  autor: { nome: string } | null
  protocolo_fase: ProtocoloFase[]
}

export interface ProtocoloResumo {
  id: string
  nome: string
  lesao: string
  descricao: string | null
  ativo: boolean
  criado_em: string
  autor: { nome: string } | null
  protocolo_fase: { id: string }[]
}

export async function listarProtocolos(): Promise<ProtocoloResumo[]> {
  const { data, error } = await supabase
    .from('protocolo')
    .select('id, nome, lesao, descricao, ativo, criado_em, autor:profissional(nome), protocolo_fase(id)')
    .order('lesao')
    .order('nome')
  if (error) throw error
  return data as unknown as ProtocoloResumo[]
}

export async function buscarProtocolo(id: string): Promise<Protocolo> {
  const { data, error } = await supabase
    .from('protocolo')
    .select(`
      id, nome, lesao, descricao, referencia, ativo, criado_em, autor_id,
      autor:profissional(nome),
      protocolo_fase(
        id, protocolo_id, ordem, nome, semana_inicio, semana_fim, objetivos,
        protocolo_fase_exercicio(
          id, exercicio_id, nota, ordem, semana_inicio, semana_fim, objetivo_texto, regra_progressao,
          series, reps, tempo_seg, carga_tipo, carga_valor,
          exercicio(nome, grupo_muscular)
        )
      )
    `)
    .eq('id', id)
    .single()
  if (error) throw error
  return data as unknown as Protocolo
}

export interface SalvarProtocoloPayload {
  protocolo: {
    nome: string
    lesao: string
    descricao: string
    referencia: string
    autor_id: string
  }
  fases: {
    ordem: number
    nome: string
    semana_inicio: number
    semana_fim: number
    objetivos: ObjetivoFase[]
    exercicios: { exercicio_id: string; nota: string; ordem: number; objetivo_texto?: string; semana_inicio?: number | null; semana_fim?: number | null }[]
  }[]
}

export async function criarProtocolo(payload: SalvarProtocoloPayload): Promise<string> {
  const { data: proto, error: pe } = await supabaseAdmin
    .from('protocolo')
    .insert(payload.protocolo)
    .select('id')
    .single()
  if (pe) throw pe

  for (const fase of payload.fases) {
    const { data: faseRow, error: fe } = await supabaseAdmin
      .from('protocolo_fase')
      .insert({
        protocolo_id: proto.id,
        ordem: fase.ordem,
        nome: fase.nome,
        semana_inicio: fase.semana_inicio,
        semana_fim: fase.semana_fim,
        objetivos: fase.objetivos,
      })
      .select('id')
      .single()
    if (fe) throw fe

    if (fase.exercicios.length > 0) {
      const { error: ee } = await supabaseAdmin
        .from('protocolo_fase_exercicio')
        .insert(fase.exercicios.map(ex => ({ ...ex, fase_id: faseRow.id })))
      if (ee) throw ee
    }
  }

  return proto.id
}

export async function atualizarProtocoloCompleto(
  id: string,
  payload: SalvarProtocoloPayload
): Promise<void> {
  // Atualiza cabeçalho
  const { error: pe } = await supabaseAdmin
    .from('protocolo')
    .update({
      nome: payload.protocolo.nome,
      lesao: payload.protocolo.lesao,
      descricao: payload.protocolo.descricao,
      referencia: payload.protocolo.referencia,
    })
    .eq('id', id)
  if (pe) throw pe

  // Remove fases antigas (cascade apaga exercícios)
  const { error: de } = await supabaseAdmin
    .from('protocolo_fase')
    .delete()
    .eq('protocolo_id', id)
  if (de) throw de

  // Recria fases
  for (const fase of payload.fases) {
    const { data: faseRow, error: fe } = await supabaseAdmin
      .from('protocolo_fase')
      .insert({
        protocolo_id: id,
        ordem: fase.ordem,
        nome: fase.nome,
        semana_inicio: fase.semana_inicio,
        semana_fim: fase.semana_fim,
        objetivos: fase.objetivos as unknown as never,
      })
      .select('id')
      .single()
    if (fe) throw fe

    if (fase.exercicios.length > 0) {
      const { error: ee } = await supabaseAdmin
        .from('protocolo_fase_exercicio')
        .insert(fase.exercicios.map(ex => ({ ...ex, fase_id: faseRow.id })))
      if (ee) throw ee
    }
  }
}

export async function atualizarProtocolo(
  id: string,
  patch: { nome?: string; lesao?: string; descricao?: string; referencia?: string; ativo?: boolean }
): Promise<void> {
  const { error } = await supabaseAdmin.from('protocolo').update(patch).eq('id', id)
  if (error) throw error
}

export async function deletarProtocolo(id: string): Promise<void> {
  const { error } = await supabaseAdmin.from('protocolo').delete().eq('id', id)
  if (error) throw error
}
