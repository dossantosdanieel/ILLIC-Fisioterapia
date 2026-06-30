import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database'
import type { NotificacaoRow } from '@/types/queries'

type CheckInInsert = Database['public']['Tables']['check_in_semanal']['Insert']
type NotaInsert = Database['public']['Tables']['nota_reuniao']['Insert']

// ── Tipos internos de join ────────────────────────────────

interface PacienteRaw {
  id: string
  nome: string
  prioridade: 'alta' | 'moderada' | 'baixa'
  convenio_plano: string | null
  fisio_responsavel_id: string
  profissional: { nome: string } | null
  plano_tratamento: {
    id: string; status: string
    prognostico_semanas: number; data_av_inicial: string; frequencia_semanal: number
  }[]
}

interface CheckinRaw {
  paciente_id: string
  trajetoria: string
  confianca: string
  precisa_discutir: boolean
  data: string
}

// ── Painel: resumo de pacientes ───────────────────────────

export interface PacienteResumo {
  id: string; nome: string; prioridade: 'alta' | 'moderada' | 'baixa'
  convenio_plano: string | null; fisio_responsavel_id: string; fisio_nome: string
  plano_id: string | null; plano_status: string | null; prognostico_semanas: number | null
  data_av_inicial: string | null; frequencia_semanal: number | null; semana_atual: number | null
  ultimo_checkin_trajetoria: string | null; ultimo_checkin_confianca: string | null
  ultimo_checkin_discutir: boolean | null; ultimo_checkin_data: string | null
  sessoes_semana: number
}

export type NivelAtencao = 'vencido' | 'reav_semana' | 'alerta' | 'checkin_pendente' | 'ok'

export interface PacienteComAtencao extends PacienteResumo {
  nivel_atencao: NivelAtencao
  motivo_atencao: string[]
}

export async function listarPacientesParaCoordenador(fisioId?: string): Promise<PacienteComAtencao[]> {
  let q = supabase
    .from('paciente')
    .select(`
      id, nome, prioridade, convenio_plano, fisio_responsavel_id,
      profissional:fisio_responsavel_id(nome),
      plano_tratamento(id, status, prognostico_semanas, data_av_inicial, frequencia_semanal)
    `)
    .eq('ativo', true)

  if (fisioId) q = q.eq('fisio_responsavel_id', fisioId)

  const { data: rawData, error } = await q.order('nome')
  if (error) throw error

  const pacientes = (rawData ?? []) as unknown as PacienteRaw[]
  const ids = pacientes.map(p => p.id)

  if (ids.length === 0) return []

  const { data: checkinsRaw } = await supabase
    .from('check_in_semanal')
    .select('paciente_id, trajetoria, confianca, precisa_discutir, data')
    .in('paciente_id', ids)
    .order('data', { ascending: false })

  const checkins = (checkinsRaw ?? []) as unknown as CheckinRaw[]

  const ultimoCheckin = new Map<string, CheckinRaw>()
  for (const ci of checkins) {
    if (!ultimoCheckin.has(ci.paciente_id)) ultimoCheckin.set(ci.paciente_id, ci)
  }

  const hoje = new Date()

  return pacientes.map(p => {
    const plano = p.plano_tratamento?.[0] ?? null
    const ci = ultimoCheckin.get(p.id) ?? null

    let semana_atual: number | null = null
    if (plano?.data_av_inicial) {
      const diffDias = Math.floor((hoje.getTime() - new Date(plano.data_av_inicial).getTime()) / 86400000)
      semana_atual = Math.max(1, Math.floor(diffDias / 7) + 1)
    }

    const motivos: string[] = []
    let nivel: NivelAtencao = 'ok'

    if (plano && semana_atual && semana_atual > plano.prognostico_semanas) {
      nivel = 'vencido'
      motivos.push(`Vencido (Sem. ${semana_atual}/${plano.prognostico_semanas})`)
    }

    if (ci) {
      const temAlerta = ci.trajetoria === 'piorando' || ci.confianca === 'preciso_rever' || ci.confianca === 'em_risco' || ci.precisa_discutir
      if (temAlerta) {
        if (nivel === 'ok') nivel = 'alerta'
        if (ci.trajetoria === 'piorando') motivos.push('Piorando')
        if (ci.confianca === 'preciso_rever') motivos.push('Prognóstico a rever')
        if (ci.confianca === 'em_risco') motivos.push('Prognóstico em risco')
        if (ci.precisa_discutir) motivos.push('Discutir com coord.')
      }
    }

    if (!ci || (hoje.getTime() - new Date(ci.data).getTime()) > 8 * 86400000) {
      if (nivel === 'ok') nivel = 'checkin_pendente'
      if (!motivos.some(m => m.includes('Check-in'))) motivos.push('Check-in pendente')
    }

    return {
      id: p.id, nome: p.nome, prioridade: p.prioridade,
      convenio_plano: p.convenio_plano, fisio_responsavel_id: p.fisio_responsavel_id,
      fisio_nome: p.profissional?.nome ?? '',
      plano_id: plano?.id ?? null, plano_status: plano?.status ?? null,
      prognostico_semanas: plano?.prognostico_semanas ?? null,
      data_av_inicial: plano?.data_av_inicial ?? null,
      frequencia_semanal: plano?.frequencia_semanal ?? null,
      semana_atual,
      ultimo_checkin_trajetoria: ci?.trajetoria ?? null,
      ultimo_checkin_confianca: ci?.confianca ?? null,
      ultimo_checkin_discutir: ci?.precisa_discutir ?? null,
      ultimo_checkin_data: ci?.data ?? null,
      sessoes_semana: 0,
      nivel_atencao: nivel,
      motivo_atencao: motivos,
    }
  })
}

// ── Profissionais ─────────────────────────────────────────

export async function listarProfissionais() {
  const { data, error } = await supabase
    .from('profissional').select('id, nome, papeis').eq('ativo', true).order('nome')
  if (error) throw error
  return data ?? []
}

// ── Check-in ──────────────────────────────────────────────

export async function buscarCheckinSemana(pacienteId: string, semana: number, ano: number) {
  const { data } = await supabase
    .from('check_in_semanal')
    .select('*').eq('paciente_id', pacienteId).eq('semana', semana).eq('ano', ano)
    .maybeSingle()
  return data
}

export async function listarCheckinsDoPaciente(pacienteId: string) {
  const { data, error } = await supabase
    .from('check_in_semanal').select('*, profissional:profissional_id(nome)')
    .eq('paciente_id', pacienteId).order('data', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as (typeof data extends (infer T)[] | null ? T : never)[]
}

export async function registrarCheckin(payload: CheckInInsert) {
  const { data, error } = await supabase
    .from('check_in_semanal').upsert(payload, { onConflict: 'paciente_id,semana,ano' }).select().single()
  if (error) throw error
  return data!
}

export function semanaISO(date = new Date()): { semana: number; ano: number } {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7))
  const ft = new Date(d.getFullYear(), 0, 4)
  const semana = 1 + Math.round(((d.getTime() - ft.getTime()) / 86400000 - 3 + ((ft.getDay() + 6) % 7)) / 7)
  return { semana, ano: d.getFullYear() }
}

// ── Notas ─────────────────────────────────────────────────

interface NotaComAutor {
  id: string; paciente_id: string; autor_id: string; data: string
  texto: string; acao_definida: string | null; criado_em: string
  autor: { nome: string } | null
}

export async function listarNotasDoPaciente(pacienteId: string): Promise<NotaComAutor[]> {
  const { data, error } = await supabase
    .from('nota_reuniao').select('*, autor:autor_id(nome)')
    .eq('paciente_id', pacienteId).order('data', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as NotaComAutor[]
}

export async function criarNota(payload: NotaInsert) {
  const { data, error } = await supabase.from('nota_reuniao').insert(payload).select().single()
  if (error) throw error
  return data!
}

// ── Notificações ──────────────────────────────────────────

export async function listarNotificacoes(profissionalId: string): Promise<NotificacaoRow[]> {
  const { data, error } = await supabase
    .from('notificacao').select('*')
    .eq('destinatario_id', profissionalId)
    .order('criado_em', { ascending: false }).limit(50)
  if (error) throw error
  return (data ?? []) as NotificacaoRow[]
}

export async function marcarLida(id: string) {
  await supabase.from('notificacao').update({ lida: true }).eq('id', id)
}

export async function marcarTodasLidas(profissionalId: string) {
  await supabase.from('notificacao').update({ lida: true })
    .eq('destinatario_id', profissionalId).eq('lida', false)
}

export function subscribeNotificacoes(profissionalId: string, onNova: () => void) {
  return supabase
    .channel(`notificacoes:${profissionalId}`)
    .on('postgres_changes', {
      event: 'INSERT', schema: 'public', table: 'notificacao',
      filter: `destinatario_id=eq.${profissionalId}`,
    }, onNova)
    .subscribe()
}
