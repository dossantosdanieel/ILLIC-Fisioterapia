import { supabase } from '@/lib/supabase'

// ── Tipos ─────────────────────────────────────────────────

export interface MetricasBrutas {
  profissional_id: string
  profissional_nome: string
  crefito: string | null
  total_planos: number
  planos_alta: number
  planos_moderada: number
  planos_baixa: number
  total_concluidos: number
  concluidos_no_prazo: number
  planos_vencidos: number
  exec_realizados: number
  exec_total: number
  checkins_total: number
  sessoes_total: number
}

export interface ScoreMetrica {
  label: string
  valor: number | null       // valor bruto
  valorAjustado: number | null // corrigido pelo case-mix
  unidade: string
  descricao: string
  direcao: 'maior' | 'menor' // maior = melhor
  score: number              // 0–100, normalizado vs. média da clínica
}

export interface ScoreProfissional {
  profissional_id: string
  profissional_nome: string
  crefito: string | null
  case_mix_index: number    // peso médio dos casos (>1 = mais complexo)
  total_planos: number
  metricas: ScoreMetrica[]
  score_geral: number       // média ponderada dos scores
}

// ── Case-mix weight ───────────────────────────────────────

const PESO_PRIORIDADE = { alta: 1.4, moderada: 1.0, baixa: 0.7 }

function caseMixIndex(alta: number, moderada: number, baixa: number): number {
  const total = alta + moderada + baixa
  if (total === 0) return 1
  return (
    (alta * PESO_PRIORIDADE.alta +
      moderada * PESO_PRIORIDADE.moderada +
      baixa * PESO_PRIORIDADE.baixa) / total
  )
}

// ── Buscar dados brutos ───────────────────────────────────

export async function buscarMetricasBrutas(): Promise<MetricasBrutas[]> {
  const { data, error } = await supabase
    .from('vw_metricas_profissional' as 'profissional') // cast para evitar erro de tipo
    .select('*')
  if (error) throw error
  return (data ?? []) as unknown as MetricasBrutas[]
}

// ── Calcular scores ───────────────────────────────────────

export function calcularScores(dados: MetricasBrutas[]): ScoreProfissional[] {
  if (dados.length === 0) return []

  // Calcular valores por profissional
  const profScores = dados.map(d => {
    const cmi = caseMixIndex(d.planos_alta, d.planos_moderada, d.planos_baixa)

    // 1. % altas no prazo
    const pctPrazo = d.total_concluidos > 0
      ? Math.round((d.concluidos_no_prazo / d.total_concluidos) * 100)
      : null

    // 2. Taxa de vencidos ativos
    const ativosTotal = d.total_planos - d.total_concluidos
    const taxaVencidos = ativosTotal > 0
      ? Math.round((d.planos_vencidos / ativosTotal) * 100)
      : null

    // 3. Fidelidade ao protocolo
    const fidelidade = d.exec_total > 0
      ? Math.round((d.exec_realizados / d.exec_total) * 100)
      : null

    // 4. Pontualidade de check-ins (checkins / sessões esperadas ~ sessões realizadas / freq)
    const pontualidade = d.sessoes_total > 0
      ? Math.min(100, Math.round((d.checkins_total / Math.ceil(d.sessoes_total / 3)) * 100))
      : null

    return {
      profissional_id: d.profissional_id,
      profissional_nome: d.profissional_nome,
      crefito: d.crefito,
      case_mix_index: cmi,
      total_planos: d.total_planos,
      _raw: { pctPrazo, taxaVencidos, fidelidade, pontualidade },
    }
  })

  // Calcular médias da clínica para normalizar (excluindo nulls)
  function media(arr: (number | null)[]): number {
    const vals = arr.filter((v): v is number => v !== null)
    return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 50
  }

  const mediaPrazo = media(profScores.map(p => p._raw.pctPrazo))
  const mediaVencidos = media(profScores.map(p => p._raw.taxaVencidos))
  const mediaFidelidade = media(profScores.map(p => p._raw.fidelidade))
  const mediaPontualidade = media(profScores.map(p => p._raw.pontualidade))

  // Normalizar score relativo (0–100), ajustado pelo case-mix index
  function normalizar(
    valor: number | null,
    mediaClinica: number,
    direcao: 'maior' | 'menor',
    cmi: number,
  ): number {
    if (valor === null) return 50 // sem dados = neutro
    // Ajustar pelo case-mix: quem atende casos mais difíceis tem tolerância
    const ajuste = (cmi - 1) * 10 // +10 pts por 0.1 acima da média de CMI
    const base = direcao === 'maior'
      ? 50 + (valor - mediaClinica)
      : 50 - (valor - mediaClinica)
    return Math.max(0, Math.min(100, Math.round(base + ajuste)))
  }

  return profScores.map(p => {
    const { pctPrazo, taxaVencidos, fidelidade, pontualidade } = p._raw

    const metricas: ScoreMetrica[] = [
      {
        label: 'Altas no prazo',
        valor: pctPrazo,
        valorAjustado: pctPrazo !== null ? Math.min(100, Math.round(pctPrazo * p.case_mix_index)) : null,
        unidade: '%',
        descricao: 'Pacientes com alta concluída dentro do prognóstico estimado',
        direcao: 'maior',
        score: normalizar(pctPrazo, mediaPrazo, 'maior', p.case_mix_index),
      },
      {
        label: 'Planos vencidos',
        valor: taxaVencidos,
        valorAjustado: taxaVencidos !== null ? Math.max(0, Math.round(taxaVencidos / p.case_mix_index)) : null,
        unidade: '%',
        descricao: 'Planos ativos que ultrapassaram o prognóstico sem alta',
        direcao: 'menor',
        score: normalizar(taxaVencidos, mediaVencidos, 'menor', p.case_mix_index),
      },
      {
        label: 'Fidelidade ao protocolo',
        valor: fidelidade,
        valorAjustado: fidelidade,
        unidade: '%',
        descricao: 'Proporção de exercícios realizados vs. prescritos',
        direcao: 'maior',
        score: normalizar(fidelidade, mediaFidelidade, 'maior', p.case_mix_index),
      },
      {
        label: 'Pontualidade de check-ins',
        valor: pontualidade,
        valorAjustado: pontualidade,
        unidade: '%',
        descricao: 'Regularidade do preenchimento semanal da Percepção Clínica',
        direcao: 'maior',
        score: normalizar(pontualidade, mediaPontualidade, 'maior', p.case_mix_index),
      },
    ]

    const score_geral = Math.round(metricas.reduce((s, m) => s + m.score, 0) / metricas.length)

    return {
      profissional_id: p.profissional_id,
      profissional_nome: p.profissional_nome,
      crefito: p.crefito,
      case_mix_index: Math.round(p.case_mix_index * 100) / 100,
      total_planos: p.total_planos,
      metricas,
      score_geral,
    }
  })
}

// ── Dados para relatório PDF do paciente ─────────────────

export interface DadosRelatorioPaciente {
  paciente: {
    nome: string
    data_nascimento: string | null
    diagnostico: string | null
    convenio_plano: string | null
    consentimento_lgpd: boolean
    data_consentimento: string | null
  }
  fisio: { nome: string; crefito: string | null }
  plano: {
    data_av_inicial: string
    prognostico_semanas: number
    frequencia_semanal: number
    status: string
    objetivos: string[]
  } | null
  fases: {
    nome: string
    semana_inicio: number
    semana_fim: number
    criterios: { medida_nome: string; operador: string; valor_alvo: number }[]
  }[]
  avaliacoes: {
    data: string
    tipo: string
    valores: { medida: string; valor: number; unidade: string }[]
  }[]
  sessoes: {
    data: string
    fidelidade: number
    total: number
    realizados: number
  }[]
}

export async function buscarDadosRelatorioPaciente(pacienteId: string): Promise<DadosRelatorioPaciente> {
  // Paciente + fisio
  const { data: pacRaw, error: errP } = await supabase
    .from('paciente')
    .select('*, profissional:fisio_responsavel_id(nome, crefito)')
    .eq('id', pacienteId)
    .single()
  if (errP) throw errP
  const pac = pacRaw as unknown as {
    nome: string; data_nascimento: string | null; diagnostico: string | null
    convenio_plano: string | null; consentimento_lgpd: boolean; data_consentimento: string | null
    profissional: { nome: string; crefito: string | null } | null
  }

  // Plano ativo + fases
  const { data: planoRaw } = await supabase
    .from('plano_tratamento')
    .select(`*, fase(*, criterio_fase(operador, valor_alvo, medida(nome)))`)
    .eq('paciente_id', pacienteId)
    .eq('status', 'ativo')
    .order('criado_em', { ascending: false })
    .limit(1)
    .maybeSingle()

  const plano = planoRaw as unknown as {
    data_av_inicial: string; prognostico_semanas: number; frequencia_semanal: number
    status: string; objetivos: string[]
    fase: { nome: string; semana_inicio: number; semana_fim: number; ordem: number
      criterio_fase: { operador: string; valor_alvo: number; medida: { nome: string } }[] }[]
  } | null

  // Avaliações + valores
  const { data: avsRaw } = await supabase
    .from('avaliacao')
    .select(`data, tipo, valor_medida(valor, medida(nome, unidade))`)
    .eq('paciente_id', pacienteId)
    .order('data', { ascending: true })

  const avs = (avsRaw ?? []) as unknown as {
    data: string; tipo: string
    valor_medida: { valor: number; medida: { nome: string; unidade: string } }[]
  }[]

  // Sessões
  const { data: sessoesRaw } = await supabase
    .from('sessao_realizada')
    .select(`data, execucao_exercicio(realizado)`)
    .eq('paciente_id', pacienteId)
    .order('data', { ascending: false })
    .limit(20)

  const sessoes = (sessoesRaw ?? []) as unknown as {
    data: string
    execucao_exercicio: { realizado: boolean }[]
  }[]

  return {
    paciente: {
      nome: pac.nome,
      data_nascimento: pac.data_nascimento,
      diagnostico: pac.diagnostico,
      convenio_plano: pac.convenio_plano,
      consentimento_lgpd: pac.consentimento_lgpd,
      data_consentimento: pac.data_consentimento,
    },
    fisio: { nome: pac.profissional?.nome ?? '', crefito: pac.profissional?.crefito ?? null },
    plano: plano ? {
      data_av_inicial: plano.data_av_inicial,
      prognostico_semanas: plano.prognostico_semanas,
      frequencia_semanal: plano.frequencia_semanal,
      status: plano.status,
      objetivos: plano.objetivos,
    } : null,
    fases: (plano?.fase ?? [])
      .sort((a, b) => a.ordem - b.ordem)
      .map(f => ({
        nome: f.nome,
        semana_inicio: f.semana_inicio,
        semana_fim: f.semana_fim,
        criterios: f.criterio_fase.map(c => ({
          medida_nome: c.medida.nome,
          operador: c.operador,
          valor_alvo: c.valor_alvo,
        })),
      })),
    avaliacoes: avs.map(av => ({
      data: av.data,
      tipo: av.tipo,
      valores: av.valor_medida.map(v => ({
        medida: v.medida.nome,
        valor: v.valor,
        unidade: v.medida.unidade,
      })),
    })),
    sessoes: sessoes.map(s => {
      const total = s.execucao_exercicio.length
      const realizados = s.execucao_exercicio.filter(e => e.realizado).length
      return {
        data: s.data,
        fidelidade: total > 0 ? Math.round((realizados / total) * 100) : 100,
        total,
        realizados,
      }
    }),
  }
}
