import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, ChevronDown, ChevronUp, BookOpen, X, Copy } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { RichTextEditor } from '@/components/ui/RichTextEditor'
import { useAuth } from '@/lib/AuthContext'
import { criarPlanoCompleto, listarMedidas } from '../api'
import type { OperadorCriterio } from '@/types/database'
import { SeletorProtocolo, type ProtocoloSelecionado } from '@/features/protocolos/components/SeletorProtocolo'
import { buscarProtocolo, criarProtocolo } from '@/features/protocolos/api'
import { ExercicioCombobox } from '@/features/protocolos/components/ExercicioCombobox'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// ── Tipos ─────────────────────────────────────────────────────────────────────

const OPERADORES = [
  { value: '>=', label: '>= (maior ou igual)' },
  { value: '<=', label: '<= (menor ou igual)' },
  { value: '=',  label: '= (igual)' },
]

interface Criterio { medida_id: string; operador: OperadorCriterio; valor_alvo: number }

interface ExercicioSessao {
  exercicio_id: string
  nota: string
  regra_progressao: string
  series: number
  reps: number | null
  tempo_seg: number | null
  carga_tipo: string
  carga_valor: string
}

interface SessaoForm {
  nome: string
  exercicios: ExercicioSessao[]
}

interface FaseForm {
  nome: string
  semana_inicio: number
  semana_fim: number
  objetivos: string
  criterios: Criterio[]
  expanded: boolean
  tipo_sessao: 'igual' | 'diferente'
  sessoes: SessaoForm[]
}

interface ExercicioCatalogo { id: string; nome: string; grupo_muscular: string | null }

// ── Helpers ───────────────────────────────────────────────────────────────────

function htmlToArray(html: string): string[] {
  const div = document.createElement('div')
  div.innerHTML = html
  const items = div.querySelectorAll('li')
  if (items.length > 0)
    return Array.from(items).map(li => li.textContent?.trim() ?? '').filter(Boolean)
  return Array.from(div.querySelectorAll('p, h1, h2, h3'))
    .map(el => el.textContent?.trim() ?? '').filter(Boolean)
}

function nomeSessao(idx: number) {
  return `Sessão ${'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[idx] ?? idx + 1}`
}

async function listarCatalogo(): Promise<ExercicioCatalogo[]> {
  const { data, error } = await supabaseAdmin
    .from('exercicio').select('id, nome, grupo_muscular').eq('ativo', true).order('nome')
  if (error) throw error
  return data ?? []
}

function sessaoInicial(nome: string): SessaoForm {
  return { nome, exercicios: [] }
}

function faseInicial(anterior?: FaseForm, indice = 0): FaseForm {
  return {
    nome: `Fase ${indice + 1}`,
    semana_inicio: anterior ? anterior.semana_fim + 1 : 1,
    semana_fim: anterior ? anterior.semana_fim + 4 : 4,
    objetivos: '',
    criterios: [],
    expanded: indice === 0,
    tipo_sessao: 'igual',
    sessoes: [sessaoInicial('Sessão')],
  }
}

// ── Modal: Salvar como protocolo ──────────────────────────────────────────────

interface SalvarProtocoloModalProps {
  fases: FaseForm[]
  autorId: string
  onClose: () => void
}

function SalvarProtocoloModal({ fases, autorId, onClose }: SalvarProtocoloModalProps) {
  const [nome, setNome] = useState('')
  const [lesao, setLesao] = useState('')
  const [loading, setLoading] = useState(false)
  const [salvo, setSalvo] = useState(false)
  const qc = useQueryClient()

  async function handleSalvar() {
    if (!nome.trim() || !lesao.trim()) return
    setLoading(true)
    try {
      await criarProtocolo({
        protocolo: { nome, lesao, descricao: '', referencia: '', autor_id: autorId },
        fases: fases.map((f, i) => ({
          ordem: i + 1,
          nome: f.nome,
          semana_inicio: f.semana_inicio,
          semana_fim: f.semana_fim,
          objetivos: htmlToArray(f.objetivos).map(t => ({ texto: t, semana_inicio: null, semana_fim: null })),
          exercicios: [],
        })),
      })
      qc.invalidateQueries({ queryKey: ['protocolos'] })
      setSalvo(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">Salvar como protocolo</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X size={18} /></button>
        </div>

        {salvo ? (
          <div className="px-5 py-8 text-center">
            <p className="text-green-600 font-medium mb-1">✓ Protocolo salvo com sucesso!</p>
            <p className="text-sm text-gray-500">Disponível na biblioteca de protocolos.</p>
            <Button className="mt-4" onClick={onClose}>Fechar</Button>
          </div>
        ) : (
          <div className="px-5 py-4 space-y-3">
            <p className="text-sm text-gray-600">
              Este plano será salvo como modelo reutilizável para futuros pacientes.
            </p>
            <Input
              label="Nome do protocolo *"
              value={nome}
              onChange={e => setNome(e.target.value)}
              placeholder="Ex: Protocolo pós-LCA"
            />
            <Input
              label="Lesão / Condição *"
              value={lesao}
              onChange={e => setLesao(e.target.value)}
              placeholder="Ex: Ruptura do LCA"
            />
            <div className="flex gap-3 pt-2">
              <Button onClick={handleSalvar} loading={loading} disabled={!nome.trim() || !lesao.trim()}>
                Salvar protocolo
              </Button>
              <Button variant="secondary" onClick={onClose}>Ignorar</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── SessaoEditor ──────────────────────────────────────────────────────────────

interface SessaoEditorProps {
  sessao: SessaoForm
  catalogo: ExercicioCatalogo[]
  loadingCatalogo: boolean
  onChange: (sessao: SessaoForm) => void
}

function SessaoEditor({ sessao, catalogo, loadingCatalogo, onChange }: SessaoEditorProps) {
  function addEx() {
    onChange({
      ...sessao,
      exercicios: [...sessao.exercicios, {
        exercicio_id: '', nota: '', regra_progressao: '',
        series: 3, reps: 10, tempo_seg: null, carga_tipo: 'kg', carga_valor: '0',
      }],
    })
  }
  function updateEx(ei: number, patch: Partial<ExercicioSessao>) {
    onChange({ ...sessao, exercicios: sessao.exercicios.map((e, i) => i === ei ? { ...e, ...patch } : e) })
  }
  function removeEx(ei: number) {
    onChange({ ...sessao, exercicios: sessao.exercicios.filter((_, i) => i !== ei) })
  }

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div className="px-3 py-2 bg-gray-50 border-b border-gray-200">
        <span className="text-xs font-semibold text-gray-600">{sessao.nome}</span>
      </div>
      <div className="px-3 py-3 space-y-2">
        {sessao.exercicios.length === 0 && (
          <p className="text-xs text-gray-400 italic">Nenhum exercício adicionado.</p>
        )}
        {sessao.exercicios.map((ex, ei) => (
          <div key={ei} className="rounded-lg border border-gray-100 bg-gray-50/50 p-2.5 space-y-2">
            {/* Linha 1: exercício + excluir */}
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <ExercicioCombobox
                  exercicios={catalogo}
                  value={ex.exercicio_id}
                  onChange={id => updateEx(ei, { exercicio_id: id })}
                  disabled={loadingCatalogo}
                />
              </div>
              <button type="button" onClick={() => removeEx(ei)}
                className="p-1.5 text-gray-400 hover:text-red-500 transition-colors shrink-0">
                <X size={14} />
              </button>
            </div>
            {/* Linha 2: parâmetros de prescrição */}
            <div className="flex items-end gap-2 flex-wrap">
              <div className="w-14">
                <label className="text-xs text-gray-500 block mb-0.5">Séries</label>
                <input type="number" min={1} value={ex.series}
                  onChange={e => updateEx(ei, { series: Number(e.target.value) })}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
              <div className="w-14">
                <label className="text-xs text-gray-500 block mb-0.5">Reps</label>
                <input type="number" min={0} value={ex.reps ?? ''}
                  placeholder="—"
                  onChange={e => updateEx(ei, { reps: e.target.value ? Number(e.target.value) : null })}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
              <div className="w-16">
                <label className="text-xs text-gray-500 block mb-0.5">Tempo(s)</label>
                <input type="number" min={0} value={ex.tempo_seg ?? ''}
                  placeholder="—"
                  onChange={e => updateEx(ei, { tempo_seg: e.target.value ? Number(e.target.value) : null })}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
              <div className="w-36">
                <label className="text-xs text-gray-500 block mb-0.5">Tipo carga</label>
                <select value={ex.carga_tipo}
                  onChange={e => updateEx(ei, { carga_tipo: e.target.value })}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-blue-500">
                  <option value="kg">kg</option>
                  <option value="peso_corporal">Peso corporal</option>
                  <option value="faixa_leve">Faixa Decathlon Leve (~3 kg)</option>
                  <option value="faixa_moderada">Faixa Decathlon Moderada (~6 kg)</option>
                  <option value="faixa_forte">Faixa Decathlon Forte (~12 kg)</option>
                  <option value="superband_leve">Superband Rinoforce Leve (~10 kg)</option>
                  <option value="superband_media">Superband Rinoforce Média (~20 kg)</option>
                  <option value="superband_forte">Superband Rinoforce Forte (~40 kg)</option>
                  <option value="kgf">kgf (dinamômetro)</option>
                  <option value="percent_1rm">% de 1RM</option>
                  <option value="rm">RM</option>
                </select>
              </div>
              {ex.carga_tipo !== 'peso_corporal' && !ex.carga_tipo.startsWith('faixa_') && !ex.carga_tipo.startsWith('superband_') && (
                <div className="w-20">
                  <label className="text-xs text-gray-500 block mb-0.5">Valor</label>
                  <input type="text" value={ex.carga_valor}
                    onChange={e => updateEx(ei, { carga_valor: e.target.value })}
                    placeholder="0"
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500" />
                </div>
              )}
              <div className="flex-1 min-w-32">
                <label className="text-xs text-green-600 block mb-0.5">↗ Progressão</label>
                <input type="text" value={ex.regra_progressao}
                  onChange={e => updateEx(ei, { regra_progressao: e.target.value })}
                  placeholder="+2 kg, faixa_leve→moderada…"
                  className="w-full px-2 py-1.5 text-sm border border-green-200 rounded-md focus:outline-none focus:ring-1 focus:ring-green-400 text-green-700 placeholder:text-green-300" />
              </div>
            </div>
            {/* Linha 3: instrução/nota */}
            <input type="text"
              placeholder="Instrução adicional (opcional)…"
              value={ex.nota}
              onChange={e => updateEx(ei, { nota: e.target.value })}
              className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400 text-gray-600 placeholder:text-gray-300" />
          </div>
        ))}
        <button type="button" onClick={addEx}
          className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium mt-1">
          <Plus size={12} /> Adicionar exercício ou terapia
        </button>
      </div>
    </div>
  )
}

// ── FormPlano ─────────────────────────────────────────────────────────────────

interface Props { pacienteId: string; protocoloIdInicial?: string }

export function FormPlano({ pacienteId, protocoloIdInicial }: Props) {
  const { profissional } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [seletorAberto, setSeletorAberto] = useState(false)
  const [planoSalvo, setPlanoSalvo] = useState<{ planoId: string; fases: FaseForm[] } | null>(null)

  const { data: exerciciosCatalogo, isLoading: loadingCatalogo } = useQuery({
    queryKey: ['exercicios-catalogo-admin'],
    queryFn: listarCatalogo,
  })

  const { data: medidas, isLoading: loadingMedidas } = useQuery({
    queryKey: ['medidas'],
    queryFn: listarMedidas,
  })

  const medidasOpts = (medidas ?? []).map(m => ({ value: m.id, label: `${m.nome} (${m.unidade})` }))

  const [form, setForm] = useState({
    prognostico_semanas: 12,
    frequencia_semanal: 3,
    data_av_inicial: new Date().toISOString().split('T')[0],
    objetivos_gerais: '',
  })

  const [fases, setFases] = useState<FaseForm[]>([faseInicial(undefined, 0)])

  // Auto-aplica protocolo vindo da URL (?protocolo=id)
  useEffect(() => {
    if (!protocoloIdInicial) return
    buscarProtocolo(protocoloIdInicial).then(proto => {
      const sortedFases = [...proto.protocolo_fase].sort((a, b) => a.ordem - b.ordem)
      aplicarProtocolo({
        nome: proto.nome,
        prognostico_semanas: sortedFases[sortedFases.length - 1]?.semana_fim ?? 12,
        fases: sortedFases.map(f => ({
          nome: f.nome,
          semana_inicio: f.semana_inicio,
          semana_fim: f.semana_fim,
          objetivos: f.objetivos.filter(o => o.texto.trim()).map(o =>
            o.semana_inicio != null || o.semana_fim != null
              ? `${o.texto} (sem. ${o.semana_inicio ?? f.semana_inicio}–${o.semana_fim ?? f.semana_fim})`
              : o.texto
          ),
          exercicios: [...f.protocolo_fase_exercicio]
            .sort((a, b) => a.ordem - b.ordem)
            .map(ex => ({
              exercicio_id: ex.exercicio_id,
              nota: ex.nota ?? '',
              regra_progressao: ex.regra_progressao ?? '',
              series: ex.series ?? 3,
              reps: ex.reps ?? null,
              tempo_seg: ex.tempo_seg ?? null,
              carga_tipo: ex.carga_tipo ?? 'kg',
              carga_valor: ex.carga_valor ?? '0',
            })),
        })),
      })
    }).catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [protocoloIdInicial])

  function aplicarProtocolo(proto: ProtocoloSelecionado) {
    setForm(f => ({ ...f, prognostico_semanas: proto.prognostico_semanas }))
    setFases(proto.fases.map((f, i) => ({
      nome: f.nome,
      semana_inicio: f.semana_inicio,
      semana_fim: f.semana_fim,
      objetivos: f.objetivos.join('\n'),
      criterios: [],
      expanded: i === 0,
      tipo_sessao: 'igual',
      sessoes: [{
        nome: 'Sessão',
        exercicios: (f.exercicios ?? []).map(ex => ({
          exercicio_id: ex.exercicio_id,
          nota: ex.nota ?? '',
          regra_progressao: ex.regra_progressao ?? '',
          series: ex.series ?? 3,
          reps: ex.reps ?? null,
          tempo_seg: ex.tempo_seg ?? null,
          carga_tipo: ex.carga_tipo ?? 'kg',
          carga_valor: ex.carga_valor ?? '0',
        })),
      }],
    })))
    setSeletorAberto(false)
  }

  // ── Fases ─────────────────────────────────────────────────────────────────

  function updateFase(fi: number, patch: Partial<FaseForm>) {
    setFases(prev => prev.map((f, i) => i === fi ? { ...f, ...patch } : f))
  }

  function setTipoSessao(fi: number, tipo: 'igual' | 'diferente') {
    setFases(prev => prev.map((f, i) => {
      if (i !== fi) return f
      const freq = form.frequencia_semanal
      const sessoes = tipo === 'igual'
        ? [sessaoInicial('Sessão')]
        : Array.from({ length: freq }, (_, idx) => sessaoInicial(nomeSessao(idx)))
      return { ...f, tipo_sessao: tipo, sessoes }
    }))
  }

  function updateSessao(fi: number, si: number, sessao: SessaoForm) {
    setFases(prev => prev.map((f, i) => {
      if (i !== fi) return f
      return { ...f, sessoes: f.sessoes.map((s, j) => j === si ? sessao : s) }
    }))
  }

  function duplicarSessao(fi: number, si: number) {
    setFases(prev => prev.map((f, i) => {
      if (i !== fi) return f
      const clone: SessaoForm = JSON.parse(JSON.stringify(f.sessoes[si]))
      clone.nome = nomeSessao(f.sessoes.length)
      return { ...f, sessoes: [...f.sessoes, clone] }
    }))
  }

  function removeSessao(fi: number, si: number) {
    setFases(prev => prev.map((f, i) => {
      if (i !== fi) return f
      return { ...f, sessoes: f.sessoes.filter((_, j) => j !== si) }
    }))
  }

  // ── Critérios ─────────────────────────────────────────────────────────────

  function addCriterio(fi: number) {
    const primeiraMedidaId = medidas?.[0]?.id ?? ''
    setFases(prev => prev.map((f, i) => i !== fi ? f : {
      ...f, criterios: [...f.criterios, { medida_id: primeiraMedidaId, operador: '>=' as OperadorCriterio, valor_alvo: 0 }],
    }))
  }

  function updateCriterio(fi: number, ci: number, patch: Partial<Criterio>) {
    setFases(prev => prev.map((f, i) => i !== fi ? f : {
      ...f, criterios: f.criterios.map((c, j) => j === ci ? { ...c, ...patch } : c),
    }))
  }

  function removeCriterio(fi: number, ci: number) {
    setFases(prev => prev.map((f, i) => i !== fi ? f : {
      ...f, criterios: f.criterios.filter((_, j) => j !== ci),
    }))
  }

  // ── Submit ────────────────────────────────────────────────────────────────

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
          objetivos: htmlToArray(form.objetivos_gerais),
        },
        fases: fases.map((f, i) => ({
          nome: f.nome,
          ordem: i + 1,
          semana_inicio: f.semana_inicio,
          semana_fim: f.semana_fim,
          objetivos: htmlToArray(f.objetivos),
          criterios: f.criterios.filter(c => c.medida_id),
          sessoes: f.sessoes
            .filter(s => s.exercicios.some(ex => ex.exercicio_id))
            .map(s => ({
              nome: s.nome,
              exercicios: s.exercicios
                .filter(ex => ex.exercicio_id)
                .map((ex, ordem) => ({
                  exercicio_id: ex.exercicio_id,
                  nota: ex.nota,
                  ordem,
                  regra_progressao: ex.regra_progressao || null,
                  series: ex.series,
                  reps: ex.reps,
                  tempo_seg: ex.tempo_seg,
                  carga_tipo: ex.carga_tipo,
                  carga_valor: ex.carga_valor,
                })),
            })),
        })),
      })

      // Pergunta se quer salvar como protocolo antes de navegar
      setPlanoSalvo({ planoId: plano.id, fases })
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao criar plano')
    } finally {
      setLoading(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      {/* Usar protocolo */}
      <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-100 rounded-lg">
        <div>
          <p className="text-sm font-medium text-blue-900">Usar protocolo pré-definido</p>
          <p className="text-xs text-blue-600">Preenche as fases automaticamente</p>
        </div>
        <Button type="button" variant="secondary" size="sm" onClick={() => setSeletorAberto(true)}>
          <BookOpen size={14} /> Selecionar
        </Button>
      </div>

      {/* Cabeçalho */}
      <div className="grid grid-cols-3 gap-4">
        <Input label="Data da avaliação inicial *" type="date" required
          value={form.data_av_inicial}
          onChange={e => setForm(f => ({ ...f, data_av_inicial: e.target.value }))} />
        <Input label="Prognóstico (semanas) *" type="number" min={1} max={104} required
          value={form.prognostico_semanas}
          onChange={e => setForm(f => ({ ...f, prognostico_semanas: Number(e.target.value) }))} />
        <Input label="Frequência semanal *" type="number" min={1} max={7} required
          value={form.frequencia_semanal}
          onChange={e => setForm(f => ({ ...f, frequencia_semanal: Number(e.target.value) }))} />
      </div>

      <RichTextEditor
        label="Objetivos gerais do tratamento"
        placeholder="Use lista com marcadores para separar objetivos…"
        value={form.objetivos_gerais}
        onChange={v => setForm(f => ({ ...f, objetivos_gerais: v }))}
        minHeight={90}
      />

      {/* Fases */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900">Fases do protocolo</h3>
          <Button type="button" variant="secondary" size="sm"
            onClick={() => setFases(prev => [...prev, faseInicial(prev[prev.length - 1], prev.length)])}>
            <Plus size={14} /> Adicionar fase
          </Button>
        </div>

        <div className="space-y-3">
          {fases.map((fase, fi) => (
            <div key={fi} className="border border-gray-200 rounded-lg">
              {/* Header */}
              <div
                className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-t-lg cursor-pointer select-none"
                onClick={() => updateFase(fi, { expanded: !fase.expanded })}
              >
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-xs font-bold shrink-0">
                  {fi + 1}
                </span>
                <span className="flex-1 text-sm font-medium text-gray-800 truncate">
                  {fase.nome || `Fase ${fi + 1}`}
                </span>
                <span className="text-xs text-gray-500 shrink-0">Sem. {fase.semana_inicio}–{fase.semana_fim}</span>
                <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                  {fases.length > 1 && (
                    <button type="button"
                      onClick={() => setFases(prev => prev.filter((_, i) => i !== fi))}
                      className="p-1.5 text-gray-400 hover:text-red-500 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
                {fase.expanded
                  ? <ChevronUp size={16} className="text-gray-400 shrink-0" />
                  : <ChevronDown size={16} className="text-gray-400 shrink-0" />}
              </div>

              {fase.expanded && (
                <div className="px-4 py-4 space-y-5">
                  {/* Nome e semanas */}
                  <div className="grid grid-cols-3 gap-3">
                    <Input label="Nome da fase" value={fase.nome}
                      onChange={e => updateFase(fi, { nome: e.target.value })} />
                    <Input label="Semana início" type="number" min={1} value={fase.semana_inicio}
                      onChange={e => updateFase(fi, { semana_inicio: Number(e.target.value) })} />
                    <Input label="Semana fim" type="number" min={fase.semana_inicio} value={fase.semana_fim}
                      onChange={e => updateFase(fi, { semana_fim: Number(e.target.value) })} />
                  </div>

                  <RichTextEditor
                    label="Objetivos da fase"
                    placeholder="Use lista com marcadores para separar objetivos…"
                    value={fase.objetivos}
                    onChange={v => updateFase(fi, { objetivos: v })}
                    minHeight={72}
                  />

                  {/* ── Sessões da semana ───────────────────────────────── */}
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-3">
                      Sessões da semana
                      <span className="ml-1.5 text-xs font-normal text-gray-400">
                        ({form.frequencia_semanal}×/semana)
                      </span>
                    </p>

                    {/* Tipo de sessão */}
                    <div className="flex gap-3 mb-4">
                      <label className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 cursor-pointer transition-colors text-sm font-medium
                        ${fase.tipo_sessao === 'igual'
                          ? 'border-blue-500 bg-blue-50 text-blue-800'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                        <input type="radio" className="sr-only"
                          checked={fase.tipo_sessao === 'igual'}
                          onChange={() => setTipoSessao(fi, 'igual')} />
                        Todas as sessões iguais
                      </label>
                      <label className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 cursor-pointer transition-colors text-sm font-medium
                        ${fase.tipo_sessao === 'diferente'
                          ? 'border-blue-500 bg-blue-50 text-blue-800'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                        <input type="radio" className="sr-only"
                          checked={fase.tipo_sessao === 'diferente'}
                          onChange={() => setTipoSessao(fi, 'diferente')} />
                        Sessões diferentes
                      </label>
                    </div>

                    {fase.tipo_sessao === 'igual' && (
                      <div className="space-y-2">
                        <p className="text-xs text-gray-500 mb-2">
                          Esta sessão será repetida {form.frequencia_semanal}× por semana.
                        </p>
                        <SessaoEditor
                          sessao={fase.sessoes[0]}
                          catalogo={exerciciosCatalogo ?? []}
                          loadingCatalogo={loadingCatalogo}
                          onChange={s => updateSessao(fi, 0, s)}
                        />
                      </div>
                    )}

                    {fase.tipo_sessao === 'diferente' && (
                      <div className="space-y-3">
                        <p className="text-xs text-gray-500">
                          Defina cada sessão individualmente. O fisioterapeuta seleciona qual aplicar em cada atendimento.
                        </p>
                        {fase.sessoes.map((s, si) => (
                          <div key={si} className="relative">
                            <SessaoEditor
                              sessao={s}
                              catalogo={exerciciosCatalogo ?? []}
                              loadingCatalogo={loadingCatalogo}
                              onChange={sessao => updateSessao(fi, si, sessao)}
                            />
                            <div className="absolute top-2 right-2 flex gap-1">
                              <button type="button" title="Duplicar sessão"
                                onClick={() => duplicarSessao(fi, si)}
                                className="p-1 text-gray-400 hover:text-blue-600 transition-colors bg-white rounded border border-gray-200">
                                <Copy size={12} />
                              </button>
                              {fase.sessoes.length > 1 && (
                                <button type="button" title="Remover sessão"
                                  onClick={() => removeSessao(fi, si)}
                                  className="p-1 text-gray-400 hover:text-red-500 transition-colors bg-white rounded border border-gray-200">
                                  <X size={12} />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                        <button type="button"
                          onClick={() => setFases(prev => prev.map((f, i) => i !== fi ? f : {
                            ...f, sessoes: [...f.sessoes, sessaoInicial(nomeSessao(f.sessoes.length))],
                          }))}
                          className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium">
                          <Plus size={12} /> Adicionar outra sessão
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Critérios */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-gray-700">
                        Critérios para avançar a fase
                        {fase.criterios.length > 0 && (
                          <span className="ml-2 text-gray-400">({fase.criterios.length} definido{fase.criterios.length !== 1 ? 's' : ''})</span>
                        )}
                      </span>
                      <Button type="button" variant="ghost" size="sm" onClick={() => addCriterio(fi)} disabled={loadingMedidas}>
                        <Plus size={12} /> {loadingMedidas ? 'Carregando…' : 'Critério'}
                      </Button>
                    </div>
                    {fase.criterios.length === 0 && (
                      <p className="text-xs text-gray-400 italic py-1">
                        Nenhum critério — a transição será decidida manualmente.
                      </p>
                    )}
                    <div className="space-y-2">
                      {fase.criterios.map((c, ci) => (
                        <div key={ci} className="flex items-end gap-2 p-2 bg-gray-50 rounded-lg">
                          <div className="flex-1 min-w-0">
                            <label className="text-xs text-gray-500 block mb-1">Medida</label>
                            <select value={c.medida_id}
                              onChange={e => updateCriterio(fi, ci, { medida_id: e.target.value })}
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                              <option value="">— selecione —</option>
                              {medidasOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                          </div>
                          <div className="w-40 shrink-0">
                            <label className="text-xs text-gray-500 block mb-1">Condição</label>
                            <select value={c.operador}
                              onChange={e => updateCriterio(fi, ci, { operador: e.target.value as OperadorCriterio })}
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                              {OPERADORES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                          </div>
                          <div className="w-24 shrink-0">
                            <label className="text-xs text-gray-500 block mb-1">Valor meta</label>
                            <input type="number" step="0.1" value={c.valor_alvo}
                              onChange={e => updateCriterio(fi, ci, { valor_alvo: Number(e.target.value) })}
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
                          </div>
                          <button type="button" onClick={() => removeCriterio(fi, ci)}
                            className="p-2 text-gray-400 hover:text-red-500 shrink-0">
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

      {seletorAberto && (
        <SeletorProtocolo onSelecionar={aplicarProtocolo} onClose={() => setSeletorAberto(false)} />
      )}
    </form>

    {/* Modal: salvar como protocolo (aparece após salvar) */}
    {planoSalvo && profissional && (
      <SalvarProtocoloModal
        fases={planoSalvo.fases}
        autorId={profissional.id}
        onClose={() => {
          navigate(`/pacientes/${pacienteId}/plano/${planoSalvo.planoId}`)
          setPlanoSalvo(null)
        }}
      />
    )}
    </>
  )
}
