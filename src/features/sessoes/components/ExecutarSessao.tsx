import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  CheckCircle2, XCircle, AlertTriangle, TrendingDown,
  History, Sparkles, Copy, Check, ChevronDown, ChevronUp,
} from 'lucide-react'
import {
  registrarSessaoRealizada,
  notificarDesviosSessao,
  notificarProgressaoInsuficiente,
  buscarVolumeMicrocicloAnterior,
  buscarUltimaExecucao,
} from '../api'
import type { SessaoTemplateCompleta, ExercicioPrescritoCompleto } from '../api'
import { useAuth } from '@/lib/AuthContext'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  calcularVolume,
  classificarGrupo,
  progressaoEsperada,
  CARGA_TIPO_LABELS,
  sugerirProgressao5pct,
} from '@/lib/carga'
import type { MotivoNaoRealizado } from '@/types/database'

const MOTIVOS: { value: MotivoNaoRealizado; label: string }[] = [
  { value: 'dor', label: 'Dor' },
  { value: 'fadiga', label: 'Fadiga' },
  { value: 'equipamento', label: 'Equipamento indisponível' },
  { value: 'falta', label: 'Falta do paciente' },
  { value: 'progressao_antecipada', label: 'Progressão antecipada' },
  { value: 'outro', label: 'Outro' },
]

interface ExecucaoState {
  realizado: boolean
  carga_real: string
  reps_real: string
  tempo_real: string
  motivo: MotivoNaoRealizado | ''
  justificativa: string   // obrigatória quando alterado=true ou !realizado
  alterado: boolean
}

interface Props {
  template: SessaoTemplateCompleta
  pacienteId: string
  pacienteNome?: string
  planoId?: string
  objetivos?: string[]
}

function formatarData(iso: string): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y.slice(2)}`
}

function formatarDataLonga(iso: string): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export function ExecutarSessao({ template, pacienteId, pacienteNome, planoId, objetivos }: Props) {
  const { profissional } = useAuth()
  const navigate = useNavigate()
  const [data, setData] = useState(new Date().toISOString().split('T')[0])
  const [observacao, setObservacao] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [preenchidoUltima, setPreenchidoUltima] = useState(false)
  const [tentouSubmit, setTentouSubmit] = useState(false)
  const [showCopy, setShowCopy] = useState(false)
  const [copiado, setCopiado] = useState(false)

  const blocos = [...(template.bloco ?? [])].sort((a, b) => a.ordem - b.ordem)
  const todosEps: ExercicioPrescritoCompleto[] = blocos.flatMap(b =>
    [...(b.exercicio_prescrito ?? [])].sort((a, b) => a.ordem - b.ordem),
  )

  // Estado inicial com valores prescritos
  const [execucoes, setExecucoes] = useState<Record<string, ExecucaoState>>(() => {
    const init: Record<string, ExecucaoState> = {}
    todosEps.forEach(ep => {
      init[ep.id] = {
        realizado: true,
        carga_real: ep.carga_valor && ep.carga_valor !== '0' ? ep.carga_valor : '',
        reps_real: ep.reps ? String(ep.reps) : '',
        tempo_real: ep.tempo_seg ? String(ep.tempo_seg) : '',
        motivo: '',
        justificativa: '',
        alterado: false,
      }
    })
    return init
  })

  // ── Busca última execução real de cada exercício ──────────────────
  const exercicioIds = todosEps.map(ep => ep.exercicio_id)
  const { data: ultimasExecucoes } = useQuery({
    queryKey: ['ultima-execucao', pacienteId, exercicioIds.join(',')],
    queryFn: () => buscarUltimaExecucao(pacienteId, exercicioIds),
    enabled: exercicioIds.length > 0,
  })

  // Pré-preenche campos com valores da última execução (roda apenas uma vez)
  useEffect(() => {
    if (!ultimasExecucoes || preenchidoUltima) return
    setPreenchidoUltima(true)
    setExecucoes(prev => {
      const novo = { ...prev }
      todosEps.forEach(ep => {
        const ult = ultimasExecucoes[ep.exercicio_id]
        if (!ult) return
        novo[ep.id] = {
          ...novo[ep.id],
          carga_real: ult.carga_real ?? novo[ep.id].carga_real,
          reps_real: ult.reps_real != null ? String(ult.reps_real) : novo[ep.id].reps_real,
          tempo_real: ult.tempo_real != null ? String(ult.tempo_real) : novo[ep.id].tempo_real,
        }
      })
      return novo
    })
  }, [ultimasExecucoes, preenchidoUltima]) // eslint-disable-line react-hooks/exhaustive-deps

  function update(epId: string, patch: Partial<ExecucaoState>) {
    setExecucoes(e => ({ ...e, [epId]: { ...e[epId], ...patch } }))
  }

  function toggleRealizado(epId: string, ep: ExercicioPrescritoCompleto) {
    const atual = execucoes[epId]
    const novoRealizado = !atual.realizado
    update(epId, {
      realizado: novoRealizado,
      justificativa: novoRealizado ? atual.justificativa : '',
      alterado: novoRealizado && (
        atual.carga_real !== ep.carga_valor ||
        atual.reps_real !== String(ep.reps ?? '') ||
        atual.tempo_real !== String(ep.tempo_seg ?? '')
      ),
    })
  }

  function handleCargaChange(epId: string, ep: ExercicioPrescritoCompleto, val: string) {
    update(epId, { carga_real: val, alterado: val !== ep.carga_valor })
  }

  // Aplica sugestão de +5% nos campos do exercício
  function aplicarSugestao(epId: string, ep: ExercicioPrescritoCompleto) {
    const ult = ultimasExecucoes?.[ep.exercicio_id]
    if (!ult) return
    const sug = sugerirProgressao5pct(
      ep.series,
      ult.reps_real,
      ult.tempo_real,
      ult.carga_real,
      ep.carga_tipo,
    )
    if (!sug) return
    update(epId, {
      carga_real: sug.cargaSugerida ?? execucoes[epId].carga_real,
      reps_real: sug.repsSugeridas != null ? String(sug.repsSugeridas) : execucoes[epId].reps_real,
      tempo_real: sug.tempoSugerido != null ? String(sug.tempoSugerido) : execucoes[epId].tempo_real,
      alterado: true,
    })
  }

  const realizados = todosEps.filter(ep => execucoes[ep.id]?.realizado).length
  const total = todosEps.length

  // Volume total prescrito vs realizado
  function calcVolumeSessao(useReal: boolean) {
    const por_grupo: Record<string, { volume: number; unidade: string }> = {}
    todosEps.forEach(ep => {
      const e = execucoes[ep.id]
      if (useReal && !e?.realizado) return
      const cargaVal = useReal ? (e?.carga_real ?? ep.carga_valor) : ep.carga_valor
      const repsVal  = useReal ? (e?.reps_real ? Number(e.reps_real) : ep.reps) : ep.reps
      const tempoVal = useReal ? (e?.tempo_real ? Number(e.tempo_real) : ep.tempo_seg) : ep.tempo_seg
      const vol = calcularVolume(ep.series, repsVal, tempoVal, ep.carga_tipo, cargaVal)
      if (vol) {
        const grupo = ep.exercicio.grupo_muscular ?? 'Geral'
        if (!por_grupo[grupo]) por_grupo[grupo] = { volume: 0, unidade: vol.unidade }
        por_grupo[grupo].volume += vol.volume
      }
    })
    return por_grupo
  }

  const volPrescrito = calcVolumeSessao(false)
  const volRealizado = calcVolumeSessao(true)
  const totalPrescrito = Object.values(volPrescrito).reduce((s, v) => s + v.volume, 0)
  const totalRealizado = Object.values(volRealizado).reduce((s, v) => s + v.volume, 0)

  // ── Validações ──────────────────────────────────────────────────────
  const exerciciosSemJustificativa = todosEps.filter(ep => {
    const e = execucoes[ep.id]
    if (!e) return false
    if (!e.realizado) return !e.justificativa.trim()       // não realizado: justificativa obrigatória
    if (e.alterado) return !e.justificativa.trim()         // alterado: justificativa obrigatória
    return false
  })
  const observacaoVazia = !observacao.trim()
  const formValido = exerciciosSemJustificativa.length === 0 && !observacaoVazia

  // ── Gerador de texto para Zenfisio (estado atual do formulário) ──────
  function gerarTextoAtual(): string {
    const dataFmt = formatarDataLonga(data)
    let txt = `EVOLUÇÃO FISIOTERAPÊUTICA — ${dataFmt}\n`
    txt += `Paciente: ${pacienteNome ?? 'Paciente'}\n`
    if (profissional?.nome) txt += `Profissional: ${profissional.nome}\n`
    txt += '\n'

    if (objetivos && objetivos.length > 0) {
      txt += `OBJETIVOS DA FASE:\n`
      objetivos.forEach(o => { txt += `• ${o}\n` })
      txt += '\n'
    }

    for (const bloco of blocos) {
      const exs = [...(bloco.exercicio_prescrito ?? [])].sort((a, b) => a.ordem - b.ordem)
      if (!exs.length) continue

      txt += `【${bloco.nome.toUpperCase()}】\n`

      for (const ep of exs) {
        const e = execucoes[ep.id]
        const cargaLabel = CARGA_TIPO_LABELS[ep.carga_tipo] ?? ep.carga_tipo

        const carga = e?.carga_real && e.carga_real !== '0' ? e.carga_real : ep.carga_valor
        const reps = e?.reps_real ? Number(e.reps_real) : ep.reps
        const tempo = e?.tempo_real ? Number(e.tempo_real) : ep.tempo_seg

        const paramStr = reps && tempo
          ? `${ep.series}×${reps}rep×${tempo}s`
          : reps
            ? `${ep.series}×${reps} rep`
            : tempo
              ? `${ep.series}×${tempo}s`
              : `${ep.series} séries`

        const cargaStr = ep.carga_tipo === 'peso_corporal'
          ? 'peso corporal'
          : carga && carga !== '0' ? `${carga} ${cargaLabel}` : cargaLabel

        if (!e?.realizado) {
          const motivoLabel = e?.motivo
            ? MOTIVOS.find(m => m.value === e.motivo)?.label ?? e.motivo
            : 'não especificado'
          const just = e?.justificativa ? ` — ${e.justificativa}` : ''
          txt += `✗ ${ep.exercicio.nome}: NÃO REALIZADO | Motivo: ${motivoLabel}${just}\n`
        } else if (e?.alterado) {
          const cargaPres = ep.carga_tipo === 'peso_corporal'
            ? 'peso corporal'
            : ep.carga_valor && ep.carga_valor !== '0' ? `${ep.carga_valor} ${cargaLabel}` : cargaLabel
          const just = e.justificativa ? ` | Justificativa: ${e.justificativa}` : ''
          txt += `⚠ ${ep.exercicio.nome}: ${paramStr} — ${cargaStr} (prescrito: ${cargaPres})${just}\n`
        } else {
          txt += `✓ ${ep.exercicio.nome}: ${paramStr} — ${cargaStr}\n`
        }

        if (ep.nota) txt += `   Obs: ${ep.nota}\n`
      }

      txt += '\n'
    }

    if (observacao.trim()) {
      txt += `COMENTÁRIO DA SESSÃO:\n${observacao.trim()}\n`
    }

    return txt.trim()
  }

  async function copiarParaZenfisio() {
    const texto = gerarTextoAtual()
    try {
      await navigator.clipboard.writeText(texto)
    } catch {
      const el = document.createElement('textarea')
      el.value = texto
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
    }
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2500)
  }

  async function handleSubmit() {
    setTentouSubmit(true)
    if (!formValido) {
      const msgs: string[] = []
      if (observacaoVazia) msgs.push('Adicione um comentário geral sobre a sessão.')
      if (exerciciosSemJustificativa.length > 0) {
        const nomes = exerciciosSemJustificativa.map(ep => ep.exercicio.nome).join(', ')
        msgs.push(`Justifique as alterações em: ${nomes}.`)
      }
      setErro(msgs.join('\n'))
      return
    }

    if (!profissional) return
    setErro(null)
    setLoading(true)
    try {
      const execucoesPayload = todosEps.map(ep => {
        const e = execucoes[ep.id]
        return {
          exercicio_prescrito_id: ep.id,
          realizado: e.realizado,
          carga_real: e.realizado ? e.carga_real || null : null,
          reps_real: e.realizado && e.reps_real ? Number(e.reps_real) : null,
          tempo_real: e.realizado && e.tempo_real ? Number(e.tempo_real) : null,
          motivo_nao_realizado: !e.realizado && e.motivo ? e.motivo as MotivoNaoRealizado : null,
          // motivo_texto serve tanto para justificar não-realização quanto alterações
          motivo_texto: e.justificativa.trim() || null,
          alterado_em_tempo_real: e.alterado,
        }
      })

      const sessao = await registrarSessaoRealizada({
        sessao: {
          sessao_template_id: template.id,
          paciente_id: pacienteId,
          profissional_id: profissional.id,
          data,
          observacao: observacao || null,
        },
        execucoes: execucoesPayload,
      })

      // ── Notificar desvios (não realizados / alterados) ───────────
      const desvios = todosEps
        .filter(ep => !execucoes[ep.id].realizado || execucoes[ep.id].alterado)
        .map(ep => {
          const e = execucoes[ep.id]
          return {
            exercicio: ep.exercicio.nome,
            tipo: (!e.realizado ? 'nao_realizado' : 'alterado') as 'nao_realizado' | 'alterado',
            motivo: e.justificativa || undefined,
          }
        })

      if (desvios.length > 0) {
        await notificarDesviosSessao({
          pacienteId,
          pacienteNome: pacienteNome ?? pacienteId,
          sessaoRealizadaId: sessao.id,
          profissionalNome: profissional.nome ?? profissional.id,
          desvios,
        })
      }

      // ── Verificar progressão de volume vs microciclo anterior ────
      const prevData = await buscarVolumeMicrocicloAnterior(template.microciclo_id)
      if (prevData) {
        const alertas: string[] = []
        for (const [grupo, prev] of Object.entries(prevData.volumePorGrupo)) {
          if (prev.volume === 0) continue
          const currVol = volRealizado[grupo]?.volume ?? 0
          const progressao = (currVol - prev.volume) / prev.volume
          const tipo = classificarGrupo(grupo)
          const esp = progressaoEsperada(tipo)
          if (progressao < esp.min) {
            const sinal = progressao < 0 ? `↓ ${Math.abs(progressao * 100).toFixed(0)}%` : `+${(progressao * 100).toFixed(0)}%`
            alertas.push(`${grupo}: ${sinal} realizado (esperado ${esp.label} de aumento)`)
          }
        }
        if (alertas.length > 0) {
          await notificarProgressaoInsuficiente({
            pacienteId,
            pacienteNome: pacienteNome ?? pacienteId,
            profissionalNome: profissional.nome ?? '',
            sessaoRealizadaId: sessao.id,
            alertas,
          })
        }
      }

      navigate(`/pacientes/${pacienteId}/sessoes/${sessao.id}${planoId ? `?plano=${planoId}` : ''}`)
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao registrar sessão')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* Objetivos da fase */}
      {objetivos && objetivos.length > 0 && (
        <div className="rounded-lg border border-blue-100 bg-blue-50/60 px-4 py-3">
          <p className="text-xs font-semibold text-blue-700 uppercase tracking-wider mb-1.5">Objetivos desta fase</p>
          <ul className="space-y-0.5">
            {objetivos.map((obj, i) => (
              <li key={i} className="text-sm text-blue-800">• {obj}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Data + contador */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="w-48">
          <label className="text-sm font-medium text-gray-700 block mb-1">Data da sessão</label>
          <input type="date" value={data} onChange={e => setData(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500 mt-5">
          <span className="font-semibold text-gray-900">{realizados}/{total}</span> exercícios realizados
        </div>
        {totalPrescrito > 0 && (
          <div className="flex items-center gap-2 text-xs mt-5">
            <span className="text-gray-500">Volume:</span>
            <span className="font-mono text-gray-700">{totalRealizado.toFixed(0)}</span>
            <span className="text-gray-400">/</span>
            <span className="font-mono text-gray-400">{totalPrescrito.toFixed(0)} prescrito</span>
            {totalRealizado < totalPrescrito * 0.9 && (
              <span className="flex items-center gap-0.5 text-amber-600">
                <TrendingDown size={12} /> volume abaixo do prescrito
              </span>
            )}
          </div>
        )}
      </div>

      {/* Instrução */}
      <p className="text-xs text-gray-400 -mt-1">
        Marque ✓ nos exercícios cumpridos conforme prescrito. Alterações exigem justificativa.
      </p>

      {/* Blocos */}
      {blocos.map(bloco => {
        const exs = [...(bloco.exercicio_prescrito ?? [])].sort((a, b) => a.ordem - b.ordem)
        if (!exs.length) return null

        return (
          <div key={bloco.id}>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              {bloco.nome}
            </h3>
            <div className="space-y-2">
              {exs.map(ep => {
                const e = execucoes[ep.id]
                const cargaLabel = CARGA_TIPO_LABELS[ep.carga_tipo] ?? ep.carga_tipo

                // Texto da prescrição
                const prescricaoParams = ep.reps && ep.tempo_seg
                  ? `${ep.series}×${ep.reps}rep×${ep.tempo_seg}s`
                  : ep.reps
                    ? `${ep.series}×${ep.reps} rep`
                    : ep.tempo_seg
                      ? `${ep.series}×${ep.tempo_seg}s`
                      : `${ep.series} séries`
                const prescricaoLoad = ep.carga_tipo === 'peso_corporal'
                  ? 'peso corporal'
                  : ep.carga_valor && ep.carga_valor !== '0'
                    ? `${ep.carga_valor} ${cargaLabel}`
                    : cargaLabel
                const prescricao = `${prescricaoParams} · ${prescricaoLoad}`

                const volPres = calcularVolume(ep.series, ep.reps, ep.tempo_seg, ep.carga_tipo, ep.carga_valor)
                const repsReal  = e?.reps_real ? Number(e.reps_real) : ep.reps
                const tempoReal = e?.tempo_real ? Number(e.tempo_real) : ep.tempo_seg
                const volReal   = e?.realizado
                  ? calcularVolume(ep.series, repsReal, tempoReal, ep.carga_tipo, e?.carga_real ?? ep.carga_valor)
                  : null

                // Última execução real + sugestão +5%
                const ult = ultimasExecucoes?.[ep.exercicio_id]
                const sugestao = ult
                  ? sugerirProgressao5pct(ep.series, ult.reps_real, ult.tempo_real, ult.carga_real, ep.carga_tipo)
                  : null

                // Flags de validação
                const precisaJustificativa = (!e.realizado || e.alterado)
                const justificativaFaltando = tentouSubmit && precisaJustificativa && !e.justificativa.trim()

                return (
                  <div
                    key={ep.id}
                    className={`border rounded-lg transition-colors ${
                      !e.realizado
                        ? 'border-red-200 bg-red-50/30'
                        : e.alterado
                          ? 'border-amber-200 bg-amber-50/30'
                          : 'border-green-200 bg-green-50/50'
                    }`}
                  >
                    <div className="flex items-start gap-3 px-4 py-3">
                      {/* Checkbox de cumprimento */}
                      <button
                        onClick={() => toggleRealizado(ep.id, ep)}
                        className="mt-0.5 shrink-0"
                        title={e.realizado ? 'Marcar como não realizado' : 'Marcar como realizado'}
                      >
                        {e.realizado
                          ? <CheckCircle2 size={20} className={e.alterado ? 'text-amber-500' : 'text-green-500'} />
                          : <XCircle size={20} className="text-red-400" />
                        }
                      </button>

                      <div className="flex-1 min-w-0">
                        {/* Nome + grupo + badges */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-sm font-medium ${!e.realizado ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                            {ep.exercicio.nome}
                          </span>
                          {ep.exercicio.grupo_muscular && (
                            <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                              {ep.exercicio.grupo_muscular}
                            </span>
                          )}
                          {ep.condicional && (
                            <span className="text-xs text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">se necessário</span>
                          )}
                          {e.alterado && e.realizado && (
                            <span className="flex items-center gap-1 text-xs text-amber-600">
                              <AlertTriangle size={11} /> alterado
                            </span>
                          )}
                        </div>

                        {/* Prescrição */}
                        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                          <p className="text-xs text-gray-500 font-mono">prescrito: {prescricao}</p>
                          {volPres && (
                            <span className="text-xs text-blue-500 font-mono">
                              Vol: {volPres.volume.toFixed(0)} {volPres.unidade}
                            </span>
                          )}
                        </div>

                        {ep.nota && <p className="text-xs text-gray-400 italic mt-0.5">{ep.nota}</p>}
                        {ep.regra_progressao && (
                          <p className="text-xs text-green-600 mt-0.5">↗ {ep.regra_progressao}</p>
                        )}

                        {/* ── Última execução + sugestão de progressão ── */}
                        {ult && (
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <span className="flex items-center gap-1 text-xs text-gray-500 bg-gray-50 border border-gray-200 px-2 py-0.5 rounded-full">
                              <History size={10} />
                              Última ({formatarData(ult.data)}):
                              {ult.reps_real ? ` ${ult.reps_real} rep` : ''}
                              {ult.tempo_real ? ` ${ult.tempo_real}s` : ''}
                              {ult.carga_real && ult.carga_real !== '0' ? ` · ${ult.carga_real} ${cargaLabel}` : ''}
                            </span>

                            {sugestao && (
                              <button
                                onClick={() => aplicarSugestao(ep.id, ep)}
                                className="flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full hover:bg-emerald-100 transition-colors"
                              >
                                <Sparkles size={10} />
                                ↗ +5%: {sugestao.descricao}
                              </button>
                            )}
                          </div>
                        )}

                        {/* Campos de execução real */}
                        {e.realizado && (
                          <div className="flex items-center gap-3 mt-2 flex-wrap">
                            {ep.carga_tipo !== 'peso_corporal' && (
                              <div>
                                <label className="text-xs text-gray-500">
                                  Carga real <span className="text-gray-400">({cargaLabel})</span>
                                </label>
                                <input
                                  type="text"
                                  value={e.carga_real}
                                  onChange={ev => handleCargaChange(ep.id, ep, ev.target.value)}
                                  className="w-28 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 block mt-0.5"
                                />
                              </div>
                            )}

                            <div>
                              <label className="text-xs text-gray-500">
                                Reps realizadas {ep.reps ? `(prescrito: ${ep.reps})` : ''}
                              </label>
                              <input
                                type="number"
                                min={0}
                                placeholder={ep.reps ? String(ep.reps) : '—'}
                                value={e.reps_real}
                                onChange={ev => update(ep.id, { reps_real: ev.target.value, alterado: true })}
                                className="w-20 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 block mt-0.5"
                              />
                            </div>

                            {ep.tempo_seg !== null && (
                              <div>
                                <label className="text-xs text-gray-500">
                                  Tempo real (s) {ep.tempo_seg ? `(prescrito: ${ep.tempo_seg}s)` : ''}
                                </label>
                                <input
                                  type="number"
                                  min={0}
                                  placeholder={String(ep.tempo_seg)}
                                  value={e.tempo_real}
                                  onChange={ev => update(ep.id, { tempo_real: ev.target.value, alterado: true })}
                                  className="w-20 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 block mt-0.5"
                                />
                              </div>
                            )}

                            {volReal && (
                              <div className="mt-4">
                                <span className={`text-xs font-mono px-2 py-1 rounded ${
                                  volPres && volReal.volume < volPres.volume * 0.9
                                    ? 'bg-amber-50 text-amber-700'
                                    : 'bg-green-50 text-green-700'
                                }`}>
                                  Vol real: {volReal.volume.toFixed(0)} {volReal.unidade}
                                </span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Motivo — apenas para não realizados */}
                        {!e.realizado && (
                          <div className="flex items-center gap-3 mt-2 flex-wrap">
                            <div>
                              <label className="text-xs text-gray-500">Motivo</label>
                              <select
                                value={e.motivo}
                                onChange={ev => update(ep.id, { motivo: ev.target.value as MotivoNaoRealizado })}
                                className="w-48 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 block mt-0.5"
                              >
                                <option value="">— selecione —</option>
                                {MOTIVOS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                              </select>
                            </div>
                          </div>
                        )}

                        {/* Justificativa — obrigatória quando alterado ou não realizado */}
                        {precisaJustificativa && (
                          <div className="mt-2">
                            <label className="text-xs font-medium text-gray-600">
                              Justificativa
                              <span className="text-red-500 ml-0.5">*</span>
                              <span className="font-normal text-gray-400 ml-1">
                                {e.alterado && e.realizado
                                  ? '— por que alterou a prescrição?'
                                  : '— por que não foi realizado?'}
                              </span>
                            </label>
                            <input
                              type="text"
                              placeholder={e.alterado && e.realizado
                                ? 'ex: dor referida, carga insuficiente, progressão antecipada…'
                                : 'ex: dor ao movimento, paciente relatou fadiga…'}
                              value={e.justificativa}
                              onChange={ev => update(ep.id, { justificativa: ev.target.value })}
                              className={`w-full mt-0.5 px-2 py-1.5 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-blue-500 block ${
                                justificativaFaltando
                                  ? 'border-red-400 bg-red-50/50 focus:ring-red-400'
                                  : 'border-gray-300'
                              }`}
                            />
                            {justificativaFaltando && (
                              <p className="text-xs text-red-500 mt-0.5">Justificativa obrigatória</p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {/* Comentário geral — OBRIGATÓRIO */}
      <div>
        <Textarea
          label="Comentário geral da sessão *"
          placeholder="Resposta do paciente, intercorrências, percepção de esforço, observações clínicas…"
          value={observacao}
          onChange={e => setObservacao(e.target.value)}
          rows={3}
          className={tentouSubmit && observacaoVazia ? 'border-red-400 ring-red-400' : ''}
        />
        {tentouSubmit && observacaoVazia && (
          <p className="text-xs text-red-500 mt-1">O comentário geral é obrigatório para registrar a sessão.</p>
        )}
      </div>

      {/* Bloco de cópia para Zenfisio */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <button
          onClick={() => setShowCopy(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-sm font-medium text-gray-700"
        >
          <div className="flex items-center gap-2">
            <Copy size={14} className="text-gray-400" />
            Pré-visualizar texto para copiar no Zenfisio
          </div>
          {showCopy ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
        </button>

        {showCopy && (
          <div className="px-4 py-4 space-y-3">
            <textarea
              value={gerarTextoAtual()}
              readOnly
              rows={14}
              spellCheck={false}
              className="w-full px-4 py-3 text-sm font-mono border border-gray-200 rounded-lg bg-white focus:outline-none resize-y text-gray-700"
            />
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-400">
                Cole diretamente na evolução do paciente no Zenfisio. Edite se necessário antes de copiar.
              </p>
              <Button
                variant={copiado ? 'secondary' : 'primary'}
                size="sm"
                onClick={copiarParaZenfisio}
              >
                {copiado
                  ? <><Check size={14} /> Copiado!</>
                  : <><Copy size={14} /> Copiar texto</>}
              </Button>
            </div>
          </div>
        )}
      </div>

      {erro && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3">
          {erro.split('\n').map((line, i) => (
            <p key={i} className="text-sm text-red-600">{line}</p>
          ))}
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <Button onClick={handleSubmit} loading={loading} disabled={loading}>
          Registrar sessão
        </Button>
        <Button variant="secondary" onClick={() => navigate(-1)}>
          Cancelar
        </Button>
      </div>
    </div>
  )
}
