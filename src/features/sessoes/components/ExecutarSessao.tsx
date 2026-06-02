import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, XCircle, AlertTriangle } from 'lucide-react'
import { registrarSessaoRealizada } from '../api'
import type { SessaoTemplateCompleta, ExercicioPrescritoCompleto } from '../api'
import { useAuth } from '@/lib/AuthContext'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
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
  motivo: MotivoNaoRealizado | ''
  motivo_texto: string
  alterado: boolean
}

interface Props {
  template: SessaoTemplateCompleta
  pacienteId: string
  planoId?: string
}

export function ExecutarSessao({ template, pacienteId, planoId }: Props) {
  const { profissional } = useAuth()
  const navigate = useNavigate()
  const [data, setData] = useState(new Date().toISOString().split('T')[0])
  const [observacao, setObservacao] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  // Estado de execução por exercício_prescrito_id
  const blocos = [...(template.bloco ?? [])].sort((a, b) => a.ordem - b.ordem)
  const todosEps: ExercicioPrescritoCompleto[] = blocos.flatMap(b =>
    [...(b.exercicio_prescrito ?? [])].sort((a, b) => a.ordem - b.ordem),
  )

  const [execucoes, setExecucoes] = useState<Record<string, ExecucaoState>>(() => {
    const init: Record<string, ExecucaoState> = {}
    todosEps.forEach(ep => {
      init[ep.id] = {
        realizado: true,
        carga_real: ep.carga_valor,
        reps_real: ep.reps ? String(ep.reps) : '',
        motivo: '',
        motivo_texto: '',
        alterado: false,
      }
    })
    return init
  })

  function update(epId: string, patch: Partial<ExecucaoState>) {
    setExecucoes(e => ({ ...e, [epId]: { ...e[epId], ...patch } }))
  }

  function toggleRealizado(epId: string, ep: ExercicioPrescritoCompleto) {
    const atual = execucoes[epId]
    const novoRealizado = !atual.realizado
    update(epId, {
      realizado: novoRealizado,
      // Detectar alteração se carga mudou
      alterado: novoRealizado && (atual.carga_real !== ep.carga_valor || atual.reps_real !== String(ep.reps ?? '')),
    })
  }

  function handleCargaChange(epId: string, ep: ExercicioPrescritoCompleto, val: string) {
    update(epId, {
      carga_real: val,
      alterado: val !== ep.carga_valor,
    })
  }

  const realizados = todosEps.filter(ep => execucoes[ep.id]?.realizado).length
  const total = todosEps.length

  async function handleSubmit() {
    if (!profissional) return
    setErro(null)
    setLoading(true)
    try {
      const sessao = await registrarSessaoRealizada({
        sessao: {
          sessao_template_id: template.id,
          paciente_id: pacienteId,
          profissional_id: profissional.id,
          data,
          observacao: observacao || null,
        },
        execucoes: todosEps.map(ep => {
          const e = execucoes[ep.id]
          return {
            exercicio_prescrito_id: ep.id,
            realizado: e.realizado,
            carga_real: e.realizado ? e.carga_real || null : null,
            reps_real: e.realizado && e.reps_real ? Number(e.reps_real) : null,
            motivo_nao_realizado: !e.realizado && e.motivo ? e.motivo as MotivoNaoRealizado : null,
            motivo_texto: !e.realizado && e.motivo_texto ? e.motivo_texto : null,
            alterado_em_tempo_real: e.alterado,
          }
        }),
      })

      navigate(`/pacientes/${pacienteId}/sessoes/${sessao.id}${planoId ? `?plano=${planoId}` : ''}`)
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao registrar sessão')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* Data */}
      <div className="flex items-center gap-4">
        <div className="w-48">
          <label className="text-sm font-medium text-gray-700 block mb-1">Data da sessão</label>
          <input type="date" value={data} onChange={e => setData(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500 mt-5">
          <span className="font-semibold text-gray-900">{realizados}/{total}</span> exercícios realizados
        </div>
      </div>

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
                const prescricao = ep.reps
                  ? `${ep.series}×${ep.reps} rep · ${ep.carga_valor} ${ep.carga_tipo}`
                  : `${ep.series}×${ep.tempo_seg}s · ${ep.carga_valor} ${ep.carga_tipo}`

                return (
                  <div
                    key={ep.id}
                    className={`border rounded-lg transition-colors ${
                      e.realizado ? 'border-green-200 bg-green-50/50' : 'border-red-200 bg-red-50/30'
                    }`}
                  >
                    <div className="flex items-start gap-3 px-4 py-3">
                      {/* Toggle realizado */}
                      <button
                        onClick={() => toggleRealizado(ep.id, ep)}
                        className="mt-0.5 shrink-0"
                      >
                        {e.realizado
                          ? <CheckCircle2 size={20} className="text-green-500" />
                          : <XCircle size={20} className="text-red-400" />
                        }
                      </button>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-medium ${e.realizado ? 'text-gray-900' : 'text-gray-400 line-through'}`}>
                            {ep.exercicio.nome}
                          </span>
                          {ep.condicional && (
                            <span className="text-xs text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">se necessário</span>
                          )}
                          {e.alterado && e.realizado && (
                            <span className="flex items-center gap-1 text-xs text-amber-600">
                              <AlertTriangle size={11} /> alterado
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 font-mono mt-0.5">prescrito: {prescricao}</p>
                        {ep.nota && <p className="text-xs text-gray-400 italic mt-0.5">{ep.nota}</p>}

                        {/* Campos de realizado */}
                        {e.realizado && (
                          <div className="flex items-center gap-3 mt-2">
                            <div>
                              <label className="text-xs text-gray-500">Carga real</label>
                              <input
                                type="text"
                                value={e.carga_real}
                                onChange={ev => handleCargaChange(ep.id, ep, ev.target.value)}
                                className="w-28 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 block mt-0.5"
                              />
                            </div>
                            {ep.reps && (
                              <div>
                                <label className="text-xs text-gray-500">Reps realizadas</label>
                                <input
                                  type="number"
                                  value={e.reps_real}
                                  onChange={ev => update(ep.id, { reps_real: ev.target.value })}
                                  className="w-20 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 block mt-0.5"
                                />
                              </div>
                            )}
                          </div>
                        )}

                        {/* Motivo não realizado */}
                        {!e.realizado && (
                          <div className="flex items-center gap-3 mt-2">
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
                            <div className="flex-1">
                              <label className="text-xs text-gray-500">Detalhe</label>
                              <input
                                type="text"
                                placeholder="opcional"
                                value={e.motivo_texto}
                                onChange={ev => update(ep.id, { motivo_texto: ev.target.value })}
                                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 block mt-0.5"
                              />
                            </div>
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

      {/* Observação geral */}
      <Textarea
        label="Observação geral da sessão"
        placeholder="Resposta geral do paciente, intercorrências…"
        value={observacao}
        onChange={e => setObservacao(e.target.value)}
        rows={2}
      />

      {erro && <p className="text-sm text-red-600">{erro}</p>}

      <div className="flex gap-3 pt-2">
        <Button onClick={handleSubmit} loading={loading}>
          Registrar sessão
        </Button>
        <Button variant="secondary" onClick={() => navigate(-1)}>
          Cancelar
        </Button>
      </div>
    </div>
  )
}
