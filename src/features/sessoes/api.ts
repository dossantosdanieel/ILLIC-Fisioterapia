import { supabase } from '@/lib/supabase'
import type { Database, CargaTipo, MotivoNaoRealizado } from '@/types/database'

type BlocoInsert = Database['public']['Tables']['bloco']['Insert']
type ExercicioPrescritoInsert = Database['public']['Tables']['exercicio_prescrito']['Insert']
type SessaoRealizadaInsert = Database['public']['Tables']['sessao_realizada']['Insert']
type ExecucaoInsert = Database['public']['Tables']['execucao_exercicio']['Insert']

// ── Tipos de resultado com joins ──────────────────────────

export interface ExercicioCatalogo {
  id: string
  nome: string
  descricao: string | null
  video_url: string | null
  grupo_muscular: string | null
  ativo: boolean
}

export interface ExercicioPrescritoCompleto {
  id: string
  bloco_id: string
  exercicio_id: string
  series: number
  reps: number | null
  tempo_seg: number | null
  carga_tipo: CargaTipo
  carga_valor: string
  nota: string | null
  condicional: boolean
  ordem: number
  regra_progressao: string | null
  exercicio: ExercicioCatalogo
}

export interface BlocoCompleto {
  id: string
  sessao_template_id: string
  nome: string
  ordem: number
  exercicio_prescrito: ExercicioPrescritoCompleto[]
}

export interface SessaoTemplateCompleta {
  id: string
  microciclo_id: string
  nome: string | null
  bloco: BlocoCompleto[]
}

export interface ExecucaoCompleta {
  id: string
  sessao_realizada_id: string
  exercicio_prescrito_id: string
  realizado: boolean
  carga_real: string | null
  reps_real: number | null
  motivo_nao_realizado: MotivoNaoRealizado | null
  motivo_texto: string | null
  alterado_em_tempo_real: boolean
  exercicio_prescrito: ExercicioPrescritoCompleto
}

export interface SessaoRealizadaCompleta {
  id: string
  sessao_template_id: string
  paciente_id: string
  profissional_id: string
  data: string
  observacao: string | null
  criado_em: string
  execucao_exercicio: ExecucaoCompleta[]
}

// ── Catálogo de exercícios ────────────────────────────────

export async function listarExercicios(busca?: string): Promise<ExercicioCatalogo[]> {
  let q = supabase.from('exercicio').select('*').eq('ativo', true).order('nome')
  if (busca) q = q.ilike('nome', `%${busca}%`)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as ExercicioCatalogo[]
}

export async function criarExercicio(payload: Omit<ExercicioCatalogo, 'id' | 'ativo'>) {
  const { data, error } = await supabase
    .from('exercicio').insert({ ...payload, ativo: true }).select().single()
  if (error) throw error
  return data!
}

export async function atualizarExercicio(id: string, payload: Partial<ExercicioCatalogo>) {
  const { data, error } = await supabase
    .from('exercicio').update(payload).eq('id', id).select().single()
  if (error) throw error
  return data!
}

// ── Template de sessão ────────────────────────────────────

export async function buscarSessaoTemplate(templateId: string): Promise<SessaoTemplateCompleta> {
  const { data, error } = await supabase
    .from('sessao_template')
    .select(`
      *,
      bloco(
        *,
        exercicio_prescrito(*, exercicio(*))
      )
    `)
    .eq('id', templateId)
    .single()
  if (error) throw error
  return data as unknown as SessaoTemplateCompleta
}

export async function buscarOuCriarTemplate(microcicloId: string): Promise<SessaoTemplateCompleta> {
  // Verifica se já existe
  const { data: existente } = await supabase
    .from('sessao_template')
    .select(`*, bloco(*, exercicio_prescrito(*, exercicio(*)))`)
    .eq('microciclo_id', microcicloId)
    .maybeSingle()

  if (existente) return existente as unknown as SessaoTemplateCompleta

  // Cria novo
  const { data, error } = await supabase
    .from('sessao_template').insert({ microciclo_id: microcicloId, nome: null }).select().single()
  if (error) throw error
  return { ...data!, bloco: [] } as unknown as SessaoTemplateCompleta
}

// ── Copy/paste de sessão entre microciclos ────────────────

export async function copiarTemplate(
  fromTemplateId: string,
  toMicrocicloId: string,
): Promise<SessaoTemplateCompleta> {
  // 1. Busca o template origem completo
  const origem = await buscarSessaoTemplate(fromTemplateId)

  // 2. Cria (ou apaga e recria) o template destino
  const { data: existente } = await supabase
    .from('sessao_template').select('id').eq('microciclo_id', toMicrocicloId).maybeSingle()

  let destinoId: string
  if (existente) {
    // Apaga todos os blocos (cascata apaga exercícios)
    await supabase.from('bloco').delete().eq('sessao_template_id', existente.id)
    destinoId = existente.id
  } else {
    const { data, error } = await supabase
      .from('sessao_template').insert({ microciclo_id: toMicrocicloId }).select('id').single()
    if (error) throw error
    destinoId = data!.id
  }

  // 3. Recria os blocos e exercícios no destino
  const blocos = [...(origem.bloco ?? [])].sort((a, b) => a.ordem - b.ordem)
  for (const bloco of blocos) {
    const { data: novoBloco, error: errB } = await supabase
      .from('bloco').insert({ sessao_template_id: destinoId, nome: bloco.nome, ordem: bloco.ordem })
      .select('id').single()
    if (errB) throw errB

    const exs = [...(bloco.exercicio_prescrito ?? [])].sort((a, b) => a.ordem - b.ordem)
    if (exs.length > 0) {
      const insertsEx: ExercicioPrescritoInsert[] = exs.map(ep => ({
        bloco_id: novoBloco!.id,
        exercicio_id: ep.exercicio_id,
        series: ep.series,
        reps: ep.reps,
        tempo_seg: ep.tempo_seg,
        carga_tipo: ep.carga_tipo,
        carga_valor: ep.carga_valor,
        nota: ep.nota,
        condicional: ep.condicional,
        ordem: ep.ordem,
        regra_progressao: ep.regra_progressao,
      }))
      const { error: errE } = await supabase.from('exercicio_prescrito').insert(insertsEx)
      if (errE) throw errE
    }
  }

  return buscarOuCriarTemplate(toMicrocicloId)
}

// ── Blocos ────────────────────────────────────────────────

export async function criarBloco(templateId: string, nome: string, ordem: number) {
  const payload: BlocoInsert = { sessao_template_id: templateId, nome, ordem }
  const { data, error } = await supabase.from('bloco').insert(payload).select().single()
  if (error) throw error
  return data!
}

export async function atualizarBloco(id: string, patch: { nome?: string; ordem?: number }) {
  const { error } = await supabase.from('bloco').update(patch).eq('id', id)
  if (error) throw error
}

export async function removerBloco(id: string) {
  const { error } = await supabase.from('bloco').delete().eq('id', id)
  if (error) throw error
}

// ── Exercícios prescritos ─────────────────────────────────

export async function adicionarExercicio(payload: ExercicioPrescritoInsert) {
  const { data, error } = await supabase
    .from('exercicio_prescrito').insert(payload).select(`*, exercicio(*)`).single()
  if (error) throw error
  return data as unknown as ExercicioPrescritoCompleto
}

export async function atualizarExercicioPrescrito(
  id: string,
  patch: Partial<Omit<ExercicioPrescritoInsert, 'bloco_id' | 'exercicio_id'>>,
) {
  const { error } = await supabase.from('exercicio_prescrito').update(patch).eq('id', id)
  if (error) throw error
}

export async function removerExercicioPrescrito(id: string) {
  const { error } = await supabase.from('exercicio_prescrito').delete().eq('id', id)
  if (error) throw error
}

export async function reordenarExercicios(ids: string[]) {
  await Promise.all(
    ids.map((id, idx) => supabase.from('exercicio_prescrito').update({ ordem: idx + 1 }).eq('id', id)),
  )
}

// ── Sessão realizada ──────────────────────────────────────

export async function listarSessoesRealizadas(pacienteId: string): Promise<SessaoRealizadaCompleta[]> {
  const { data, error } = await supabase
    .from('sessao_realizada')
    .select(`*, execucao_exercicio(*, exercicio_prescrito(*, exercicio(*)))`)
    .eq('paciente_id', pacienteId)
    .order('data', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as SessaoRealizadaCompleta[]
}

export async function buscarSessaoRealizada(id: string): Promise<SessaoRealizadaCompleta> {
  const { data, error } = await supabase
    .from('sessao_realizada')
    .select(`*, execucao_exercicio(*, exercicio_prescrito(*, exercicio(*)))`)
    .eq('id', id)
    .single()
  if (error) throw error
  return data as unknown as SessaoRealizadaCompleta
}

export interface RegistrarSessaoPayload {
  sessao: SessaoRealizadaInsert
  execucoes: Omit<ExecucaoInsert, 'sessao_realizada_id'>[]
}

export async function registrarSessaoRealizada(payload: RegistrarSessaoPayload) {
  const { data: sessao, error } = await supabase
    .from('sessao_realizada').insert(payload.sessao).select().single()
  if (error) throw error

  if (payload.execucoes.length > 0) {
    const inserts: ExecucaoInsert[] = payload.execucoes.map(e => ({
      ...e,
      sessao_realizada_id: sessao!.id,
    }))
    const { error: errE } = await supabase.from('execucao_exercicio').insert(inserts)
    if (errE) throw errE
  }
  return sessao!
}

// ── Gerador de texto para Zenfisio ───────────────────────

export function gerarTextoEvolucao(
  pacienteNome: string,
  profissionalNome: string,
  crefito: string | null,
  sessao: SessaoRealizadaCompleta,
  template: SessaoTemplateCompleta,
): string {
  const data = new Date(sessao.data).toLocaleDateString('pt-BR')

  const mapaExecucao = new Map(
    sessao.execucao_exercicio.map(e => [e.exercicio_prescrito_id, e]),
  )

  let texto = `EVOLUÇÃO FISIOTERAPÊUTICA — ${data}\n`
  texto += `Paciente: ${pacienteNome}\n`
  texto += `Profissional: ${profissionalNome}${crefito ? ` | CREFITO: ${crefito}` : ''}\n\n`

  const blocos = [...(template.bloco ?? [])].sort((a, b) => a.ordem - b.ordem)

  for (const bloco of blocos) {
    const exs = [...(bloco.exercicio_prescrito ?? [])].sort((a, b) => a.ordem - b.ordem)
    const realizados = exs.filter(ep => {
      const exec = mapaExecucao.get(ep.id)
      return !exec || exec.realizado
    })
    const naoRealizados = exs.filter(ep => {
      const exec = mapaExecucao.get(ep.id)
      return exec && !exec.realizado
    })

    if (realizados.length === 0 && naoRealizados.length === 0) continue

    texto += `【${bloco.nome.toUpperCase()}】\n`

    for (const ep of realizados) {
      const exec = mapaExecucao.get(ep.id)
      const carga = exec?.carga_real ?? ep.carga_valor
      const reps = exec?.reps_real ?? ep.reps
      const prescricao = ep.reps
        ? `${ep.series}×${reps} rep — ${carga} ${ep.carga_tipo}`
        : `${ep.series}×${ep.tempo_seg}s — ${carga} ${ep.carga_tipo}`
      const alterado = exec?.alterado_em_tempo_real ? ' *(ajuste em tempo real)*' : ''
      texto += `✓ ${ep.exercicio.nome}: ${prescricao}${alterado}\n`
      if (ep.nota) texto += `   Obs: ${ep.nota}\n`
    }

    for (const ep of naoRealizados) {
      const exec = mapaExecucao.get(ep.id)
      const motivo = exec?.motivo_nao_realizado
        ? { dor: 'dor', fadiga: 'fadiga', equipamento: 'equipamento indisponível', falta: 'falta', progressao_antecipada: 'progressão antecipada', outro: 'outro' }[exec.motivo_nao_realizado]
        : 'não realizado'
      const textoMotivo = exec?.motivo_texto ? ` — ${exec.motivo_texto}` : ''
      texto += `✗ ${ep.exercicio.nome}: ${motivo}${textoMotivo}\n`
    }

    texto += '\n'
  }

  if (sessao.observacao) {
    texto += `OBSERVAÇÕES: ${sessao.observacao}\n`
  }

  return texto.trim()
}
