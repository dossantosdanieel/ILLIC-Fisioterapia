import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/lib/AuthContext'
import { criarPlanoCompleto, listarMedidas } from '../api'
import type { OperadorCriterio } from '@/types/database'

const OPERADORES = [
  { value: '>=', label: '>= (maior ou igual)' },
  { value: '<=', label: '<= (menor ou igual)' },
  { value: '=', label: '= (igual)' },
]

interface Criterio { medida_id: string; operador: OperadorCriterio; valor_alvo: number }
interface FaseForm {
  nome: string
  semana_inicio: number
  semana_fim: number
  objetivos: string
  criterios: Criterio[]
  expanded: boolean
}

interface Props { pacienteId: string }

export function FormPlano({ pacienteId }: Props) {
  const { profissional } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const { data: medidas, isLoading: loadingMedidas } = useQuery({
    queryKey: ['medidas'],
    queryFn: listarMedidas,
  })

  const medidasOpts = (medidas ?? []).map(m => ({
    value: m.id,
    label: `${m.nome} (${m.unidade})`,
  }))

  const [form, setForm] = useState({
    prognostico_semanas: 12,
    frequencia_semanal: 3,
    data_av_inicial: new Date().toISOString().split('T')[0],
    objetivos_gerais: '',
  })

  const [fases, setFases] = useState<FaseForm[]>([
    {
      nome: 'Fase 1 — Controle da dor e inflamação',
      semana_inicio: 1,
      semana_fim: 4,
      objetivos: '',
      criterios: [],
      expanded: true,
    },
  ])

  // ── Fases ─────────────────────────────────────────────────

  function addFase() {
    // Usa prev para sempre ler o estado mais recente
    setFases(prev => {
      const ultima = prev[prev.length - 1]
      return [...prev, {
        nome: `Fase ${prev.length + 1}`,
        semana_inicio: ultima ? ultima.semana_fim + 1 : 1,
        semana_fim: ultima ? ultima.semana_fim + 4 : 4,
        objetivos: '',
        criterios: [],
        expanded: true,
      }]
    })
  }

  function removeFase(i: number) {
    setFases(prev => prev.filter((_, idx) => idx !== i))
  }

  function updateFase(i: number, patch: Partial<FaseForm>) {
    setFases(prev => prev.map((fase, idx) => idx === i ? { ...fase, ...patch } : fase))
  }

  // ── Critérios — todos usam setFases(prev=>) para evitar stale closure ──

  function addCriterio(faseIdx: number) {
    const primeiraMedidaId = medidas?.[0]?.id ?? ''
    setFases(prev => prev.map((fase, idx) => {
      if (idx !== faseIdx) return fase
      return {
        ...fase,
        criterios: [
          ...fase.criterios,
          { medida_id: primeiraMedidaId, operador: '>=' as OperadorCriterio, valor_alvo: 0 },
        ],
      }
    }))
  }

  function updateCriterio(faseIdx: number, cIdx: number, patch: Partial<Criterio>) {
    setFases(prev => prev.map((fase, idx) => {
      if (idx !== faseIdx) return fase
      return {
        ...fase,
        criterios: fase.criterios.map((c, ci) => ci === cIdx ? { ...c, ...patch } : c),
      }
    }))
  }

  function removeCriterio(faseIdx: number, cIdx: number) {
    setFases(prev => prev.map((fase, idx) => {
      if (idx !== faseIdx) return fase
      return {
        ...fase,
        criterios: fase.criterios.filter((_, ci) => ci !== cIdx),
      }
    }))
  }

  // ── Submit ────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!profissional) return
    setErro(null)

    for (const [i, f] of fases.entries()) {
      if (f.semana_fim < f.semana_inicio) {
        setErro(`Fase ${i + 1}: semana fim deve ser ≥ semana início.`)
        return
      }
    }

    setLoading(true)
    try {
      const plano = await criarPlanoCompleto(profissional.id, {
        plano: {
          paciente_id: pacienteId,
          prognostico_semanas: form.prognostico_semanas,
          frequencia_semanal: form.frequencia_semanal,
          data_av_inicial: form.data_av_inicial,
          status: 'ativo',
          objetivos: form.objetivos_gerais.split('\n').filter(Boolean),
        },
        fases: fases.map((f, i) => ({
          nome: f.nome,
          ordem: i + 1,
          semana_inicio: f.semana_inicio,
          semana_fim: f.semana_fim,
          objetivos: f.objetivos.split('\n').filter(Boolean),
          criterios: f.criterios.filter(c => c.medida_id), // só inclui critérios com medida selecionada
        })),
      })
      navigate(`/pacientes/${pacienteId}/plano/${plano.id}`)
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao criar plano')
    } finally {
      setLoading(false)
    }
  }

  // ── Render ────────────────────────────────────────────────

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      {/* Cabeçalho do plano */}
      <div className="grid grid-cols-3 gap-4">
        <Input
          label="Data da avaliação inicial *"
          type="date"
          required
          value={form.data_av_inicial}
          onChange={e => setForm(f => ({ ...f, data_av_inicial: e.target.value }))}
        />
        <Input
          label="Prognóstico (semanas) *"
          type="number"
          min={1}
          max={104}
          required
          value={form.prognostico_semanas}
          onChange={e => setForm(f => ({ ...f, prognostico_semanas: Number(e.target.value) }))}
        />
        <Input
          label="Frequência semanal *"
          type="number"
          min={1}
          max={7}
          required
          value={form.frequencia_semanal}
          onChange={e => setForm(f => ({ ...f, frequencia_semanal: Number(e.target.value) }))}
        />
      </div>

      <Textarea
        label="Objetivos gerais do tratamento"
        placeholder="Um objetivo por linha"
        value={form.objetivos_gerais}
        onChange={e => setForm(f => ({ ...f, objetivos_gerais: e.target.value }))}
        rows={3}
      />

      {/* Fases */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900">Fases do protocolo</h3>
          <Button type="button" variant="secondary" size="sm" onClick={addFase}>
            <Plus size={14} /> Adicionar fase
          </Button>
        </div>

        <div className="space-y-3">
          {fases.map((fase, fi) => (
            <div key={fi} className="border border-gray-200 rounded-lg overflow-hidden">
              {/* Header */}
              <div
                className="flex items-center gap-3 px-4 py-3 bg-gray-50 cursor-pointer select-none"
                onClick={() => updateFase(fi, { expanded: !fase.expanded })}
              >
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-xs font-bold shrink-0">
                  {fi + 1}
                </span>
                <span className="flex-1 text-sm font-medium text-gray-800 truncate">
                  {fase.nome || `Fase ${fi + 1}`}
                </span>
                <span className="text-xs text-gray-500 shrink-0">Sem. {fase.semana_inicio}–{fase.semana_fim}</span>
                <div className="flex items-center gap-1 shrink-0">
                  {fases.length > 1 && (
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); removeFase(fi) }}
                      className="text-gray-400 hover:text-red-500 transition-colors p-1"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                  {fase.expanded
                    ? <ChevronUp size={16} className="text-gray-400" />
                    : <ChevronDown size={16} className="text-gray-400" />
                  }
                </div>
              </div>

              {fase.expanded && (
                <div className="px-4 py-4 space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    <Input
                      label="Nome da fase"
                      value={fase.nome}
                      onChange={e => updateFase(fi, { nome: e.target.value })}
                    />
                    <Input
                      label="Semana início"
                      type="number"
                      min={1}
                      value={fase.semana_inicio}
                      onChange={e => updateFase(fi, { semana_inicio: Number(e.target.value) })}
                    />
                    <Input
                      label="Semana fim"
                      type="number"
                      min={fase.semana_inicio}
                      value={fase.semana_fim}
                      onChange={e => updateFase(fi, { semana_fim: Number(e.target.value) })}
                    />
                  </div>

                  <Textarea
                    label="Objetivos da fase"
                    placeholder="Um objetivo por linha"
                    value={fase.objetivos}
                    onChange={e => updateFase(fi, { objetivos: e.target.value })}
                    rows={2}
                  />

                  {/* Critérios */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <span className="text-xs font-medium text-gray-700">
                          Critérios para avançar a fase
                        </span>
                        {fase.criterios.length > 0 && (
                          <span className="ml-2 text-xs text-gray-400">
                            ({fase.criterios.length} definido{fase.criterios.length !== 1 ? 's' : ''})
                          </span>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => addCriterio(fi)}
                        disabled={loadingMedidas}
                      >
                        <Plus size={12} />
                        {loadingMedidas ? 'Carregando…' : 'Critério'}
                      </Button>
                    </div>

                    {fase.criterios.length === 0 && (
                      <p className="text-xs text-gray-400 italic py-1">
                        Nenhum critério — a transição de fase será decidida manualmente pelo coordenador.
                      </p>
                    )}

                    <div className="space-y-2">
                      {fase.criterios.map((c, ci) => (
                        <div key={ci} className="flex items-end gap-2 p-2 bg-gray-50 rounded-lg">
                          {/* Medida */}
                          <div className="flex-1 min-w-0">
                            <label className="text-xs text-gray-500 block mb-1">Medida</label>
                            <select
                              value={c.medida_id}
                              onChange={e => updateCriterio(fi, ci, { medida_id: e.target.value })}
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="">— selecione —</option>
                              {medidasOpts.map(o => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                              ))}
                            </select>
                          </div>

                          {/* Operador */}
                          <div className="w-40 shrink-0">
                            <label className="text-xs text-gray-500 block mb-1">Condição</label>
                            <select
                              value={c.operador}
                              onChange={e => updateCriterio(fi, ci, { operador: e.target.value as OperadorCriterio })}
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              {OPERADORES.map(o => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                              ))}
                            </select>
                          </div>

                          {/* Valor */}
                          <div className="w-24 shrink-0">
                            <label className="text-xs text-gray-500 block mb-1">Valor meta</label>
                            <input
                              type="number"
                              step="0.1"
                              value={c.valor_alvo}
                              onChange={e => updateCriterio(fi, ci, { valor_alvo: Number(e.target.value) })}
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>

                          {/* Remover */}
                          <button
                            type="button"
                            onClick={() => removeCriterio(fi, ci)}
                            className="shrink-0 p-2 text-gray-400 hover:text-red-500 transition-colors"
                            title="Remover critério"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {erro && (
        <div className="px-3 py-2.5 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-700">{erro}</p>
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <Button type="submit" loading={loading}>Criar plano de tratamento</Button>
        <Button type="button" variant="secondary" onClick={() => navigate(`/pacientes/${pacienteId}`)}>
          Cancelar
        </Button>
      </div>
    </form>
  )
}
