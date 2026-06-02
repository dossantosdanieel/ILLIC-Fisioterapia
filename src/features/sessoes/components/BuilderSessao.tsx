import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, GripVertical, ChevronDown, ChevronUp, Video, Search } from 'lucide-react'
import {
  buscarOuCriarTemplate, listarExercicios,
  criarBloco, removerBloco,
  adicionarExercicio, atualizarExercicioPrescrito, removerExercicioPrescrito,
} from '../api'
import type { BlocoCompleto, ExercicioPrescritoCompleto } from '../api'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { Card } from '@/components/ui/card'
import { Modal } from '@/components/ui/modal'
import type { CargaTipo } from '@/types/database'

const CARGA_TIPOS: { value: CargaTipo; label: string }[] = [
  { value: 'kg', label: 'kg' },
  { value: 'kgf', label: 'kgf (dinamômetro)' },
  { value: 'percent_1rm', label: '% de 1RM' },
  { value: 'rm', label: 'RM' },
  { value: 'banda_cor', label: 'Banda (cor)' },
  { value: 'peso_corporal', label: 'Peso corporal' },
  { value: 'tempo', label: 'Tempo (seg)' },
]

const NOMES_BLOCO = [
  'Aquecimento', 'Terapia Manual', 'Mobilização Articular',
  'Fortalecimento', 'Força Muscular', 'Controle Neuromuscular',
  'Propriocepção', 'Treino Funcional', 'Alongamento', 'Desaquecimento',
]

interface Props { microcicloId: string; semanas: string }

export function BuilderSessao({ microcicloId, semanas }: Props) {
  const qc = useQueryClient()
  const [saving, setSaving] = useState(false)
  const [novoBloco, setNovoBloco] = useState('')
  const [blocoExpandido, setBlocoExpandido] = useState<string | null>(null)
  const [modalExercicio, setModalExercicio] = useState<{ blocoId: string } | null>(null)
  const [editando, setEditando] = useState<string | null>(null) // exercicio_prescrito id

  const { data: template, isLoading } = useQuery({
    queryKey: ['sessao-template', microcicloId],
    queryFn: () => buscarOuCriarTemplate(microcicloId),
  })

  const blocos: BlocoCompleto[] = [...(template?.bloco ?? [])].sort((a, b) => a.ordem - b.ordem)

  async function handleAddBloco() {
    if (!novoBloco.trim() || !template) return
    setSaving(true)
    try {
      await criarBloco(template.id, novoBloco.trim(), blocos.length + 1)
      setNovoBloco('')
      qc.invalidateQueries({ queryKey: ['sessao-template', microcicloId] })
    } finally { setSaving(false) }
  }

  async function handleRemoveBloco(id: string) {
    if (!confirm('Remover bloco e todos os exercícios?')) return
    await removerBloco(id)
    qc.invalidateQueries({ queryKey: ['sessao-template', microcicloId] })
  }

  async function handleAddExercicio(blocoId: string, exercicioId: string) {
    const bloco = blocos.find(b => b.id === blocoId)
    const ordem = (bloco?.exercicio_prescrito?.length ?? 0) + 1
    await adicionarExercicio({
      bloco_id: blocoId, exercicio_id: exercicioId,
      series: 3, reps: 10, tempo_seg: null,
      carga_tipo: 'kg', carga_valor: '0',
      nota: null, condicional: false, ordem,
      regra_progressao: null,
    })
    qc.invalidateQueries({ queryKey: ['sessao-template', microcicloId] })
    setModalExercicio(null)
  }

  async function handleRemoveExercicio(id: string) {
    await removerExercicioPrescrito(id)
    qc.invalidateQueries({ queryKey: ['sessao-template', microcicloId] })
  }

  if (isLoading) return <Spinner />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Sessão proposta</h3>
          <p className="text-xs text-gray-500">Semanas {semanas}</p>
        </div>
      </div>

      {/* Blocos */}
      <div className="space-y-3">
        {blocos.map(bloco => {
          const exs = [...(bloco.exercicio_prescrito ?? [])].sort((a, b) => a.ordem - b.ordem)
          const expanded = blocoExpandido === bloco.id || blocoExpandido === null

          return (
            <Card key={bloco.id} className="overflow-hidden">
              {/* Header do bloco */}
              <div
                className="flex items-center gap-2 px-4 py-3 bg-gray-50 cursor-pointer select-none"
                onClick={() => setBlocoExpandido(expanded && blocoExpandido === bloco.id ? null : bloco.id)}
              >
                <GripVertical size={14} className="text-gray-300" />
                <span className="flex-1 text-sm font-medium text-gray-800">{bloco.nome}</span>
                <span className="text-xs text-gray-400">{exs.length} exercício{exs.length !== 1 ? 's' : ''}</span>
                <button
                  onClick={e => { e.stopPropagation(); handleRemoveBloco(bloco.id) }}
                  className="text-gray-300 hover:text-red-500 transition-colors p-1"
                >
                  <Trash2 size={13} />
                </button>
                {expanded ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
              </div>

              {expanded && (
                <div className="divide-y divide-gray-50">
                  {exs.map(ep => (
                    <ExercicioCard
                      key={ep.id}
                      ep={ep}
                      editando={editando === ep.id}
                      onEdit={() => setEditando(editando === ep.id ? null : ep.id)}
                      onRemove={() => handleRemoveExercicio(ep.id)}
                      onSave={async patch => {
                        await atualizarExercicioPrescrito(ep.id, patch)
                        qc.invalidateQueries({ queryKey: ['sessao-template', microcicloId] })
                        setEditando(null)
                      }}
                    />
                  ))}

                  <div className="px-4 py-2">
                    <button
                      onClick={() => setModalExercicio({ blocoId: bloco.id })}
                      className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors"
                    >
                      <Plus size={13} /> Adicionar exercício
                    </button>
                  </div>
                </div>
              )}
            </Card>
          )
        })}
      </div>

      {/* Adicionar bloco */}
      <div className="flex gap-2">
        <div className="flex-1">
          <Select
            options={NOMES_BLOCO.map(n => ({ value: n, label: n }))}
            value={novoBloco}
            onChange={e => setNovoBloco(e.target.value)}
            placeholder="Selecionar bloco…"
          />
        </div>
        <input
          type="text"
          placeholder="Ou digitar nome…"
          value={novoBloco}
          onChange={e => setNovoBloco(e.target.value)}
          className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          onKeyDown={e => e.key === 'Enter' && handleAddBloco()}
        />
        <Button size="sm" onClick={handleAddBloco} loading={saving} disabled={!novoBloco.trim()}>
          <Plus size={14} /> Bloco
        </Button>
      </div>

      {/* Modal seletor de exercício */}
      <SeletorExercicio
        open={!!modalExercicio}
        onClose={() => setModalExercicio(null)}
        onSelect={exId => modalExercicio && handleAddExercicio(modalExercicio.blocoId, exId)}
      />
    </div>
  )
}

// ── Card de exercício prescrito ───────────────────────────

interface ExercicioCardProps {
  ep: ExercicioPrescritoCompleto
  editando: boolean
  onEdit: () => void
  onRemove: () => void
  onSave: (patch: Partial<ExercicioPrescritoCompleto>) => Promise<void>
}

function ExercicioCard({ ep, editando, onEdit, onRemove, onSave }: ExercicioCardProps) {
  const [form, setForm] = useState({
    series: ep.series,
    reps: ep.reps ?? 0,
    tempo_seg: ep.tempo_seg ?? 0,
    carga_tipo: ep.carga_tipo,
    carga_valor: ep.carga_valor,
    nota: ep.nota ?? '',
    condicional: ep.condicional,
    regra_progressao: ep.regra_progressao ?? '',
    usa_tempo: !ep.reps && !!ep.tempo_seg,
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setForm({
      series: ep.series, reps: ep.reps ?? 0, tempo_seg: ep.tempo_seg ?? 0,
      carga_tipo: ep.carga_tipo, carga_valor: ep.carga_valor,
      nota: ep.nota ?? '', condicional: ep.condicional,
      regra_progressao: ep.regra_progressao ?? '',
      usa_tempo: !ep.reps && !!ep.tempo_seg,
    })
  }, [ep])

  async function handleSave() {
    setSaving(true)
    try {
      await onSave({
        series: form.series,
        reps: form.usa_tempo ? null : form.reps,
        tempo_seg: form.usa_tempo ? form.tempo_seg : null,
        carga_tipo: form.carga_tipo,
        carga_valor: form.carga_valor,
        nota: form.nota || null,
        condicional: form.condicional,
        regra_progressao: form.regra_progressao || null,
      })
    } finally { setSaving(false) }
  }

  const prescricao = ep.reps
    ? `${ep.series}×${ep.reps} rep · ${ep.carga_valor} ${ep.carga_tipo}`
    : `${ep.series}×${ep.tempo_seg}s · ${ep.carga_valor} ${ep.carga_tipo}`

  return (
    <div className="px-4 py-2.5">
      <div className="flex items-start gap-2">
        <GripVertical size={14} className="text-gray-200 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-800">{ep.exercicio.nome}</span>
            {ep.condicional && (
              <span className="text-xs text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">se necessário</span>
            )}
            {ep.exercicio.video_url && (
              <a href={ep.exercicio.video_url} target="_blank" rel="noreferrer"
                className="text-gray-300 hover:text-blue-500 transition-colors">
                <Video size={12} />
              </a>
            )}
          </div>

          {!editando && (
            <div className="flex items-center gap-3 mt-0.5">
              <span className="text-xs text-gray-500 font-mono">{prescricao}</span>
              {ep.regra_progressao && (
                <span className="text-xs text-blue-500">↗ {ep.regra_progressao}</span>
              )}
              {ep.nota && <span className="text-xs text-gray-400 italic truncate max-w-xs">{ep.nota}</span>}
            </div>
          )}

          {editando && (
            <div className="mt-2 space-y-2">
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.usa_tempo}
                    onChange={e => setForm(f => ({ ...f, usa_tempo: e.target.checked }))}
                    className="h-3.5 w-3.5"
                  />
                  Usar tempo (seg)
                </label>
                <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.condicional}
                    onChange={e => setForm(f => ({ ...f, condicional: e.target.checked }))}
                    className="h-3.5 w-3.5"
                  />
                  Condicional
                </label>
              </div>

              <div className="grid grid-cols-4 gap-2">
                <div>
                  <label className="text-xs text-gray-500">Séries</label>
                  <input type="number" min={1} value={form.series}
                    onChange={e => setForm(f => ({ ...f, series: Number(e.target.value) }))}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-xs text-gray-500">{form.usa_tempo ? 'Tempo (s)' : 'Reps'}</label>
                  <input type="number" min={1}
                    value={form.usa_tempo ? form.tempo_seg : form.reps}
                    onChange={e => setForm(f => form.usa_tempo
                      ? { ...f, tempo_seg: Number(e.target.value) }
                      : { ...f, reps: Number(e.target.value) })}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Tipo carga</label>
                  <select value={form.carga_tipo}
                    onChange={e => setForm(f => ({ ...f, carga_tipo: e.target.value as CargaTipo }))}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500">
                    {CARGA_TIPOS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500">Carga / Valor</label>
                  <input type="text" value={form.carga_valor}
                    onChange={e => setForm(f => ({ ...f, carga_valor: e.target.value }))}
                    placeholder="ex: 10, azul, 60%"
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-500">Progressão (próx. microciclo)</label>
                  <input type="text" value={form.regra_progressao}
                    onChange={e => setForm(f => ({ ...f, regra_progressao: e.target.value }))}
                    placeholder="ex: +2 kg, azul→vinho, 15RM→12RM"
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Nota / Observação</label>
                  <input type="text" value={form.nota}
                    onChange={e => setForm(f => ({ ...f, nota: e.target.value }))}
                    placeholder="instrução adicional"
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500" />
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <Button size="sm" onClick={handleSave} loading={saving}>Salvar</Button>
                <Button size="sm" variant="ghost" onClick={onEdit}>Cancelar</Button>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button onClick={onEdit}
            className="text-xs text-gray-400 hover:text-blue-600 transition-colors px-1.5 py-1">
            {editando ? '—' : 'Editar'}
          </button>
          <button onClick={onRemove}
            className="text-gray-300 hover:text-red-500 transition-colors p-1">
            <Trash2 size={12} />
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Seletor de exercício ───────────────────────────────────

function SeletorExercicio({
  open, onClose, onSelect,
}: { open: boolean; onClose: () => void; onSelect: (id: string) => void }) {
  const [busca, setBusca] = useState('')

  const { data: exercicios } = useQuery({
    queryKey: ['exercicios', busca],
    queryFn: () => listarExercicios(busca),
  })

  return (
    <Modal open={open} onClose={onClose} title="Selecionar exercício" size="md">
      <div className="space-y-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar exercício…"
            value={busca}
            onChange={e => setBusca(e.target.value)}
            autoFocus
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
          {(exercicios ?? []).map(ex => (
            <button
              key={ex.id}
              onClick={() => onSelect(ex.id)}
              className="w-full flex items-start gap-3 px-3 py-2.5 hover:bg-blue-50 transition-colors text-left"
            >
              <div>
                <p className="text-sm font-medium text-gray-800">{ex.nome}</p>
                {ex.grupo_muscular && (
                  <p className="text-xs text-gray-400">{ex.grupo_muscular}</p>
                )}
              </div>
              {ex.video_url && <Video size={12} className="text-gray-300 mt-0.5 shrink-0" />}
            </button>
          ))}
          {exercicios?.length === 0 && (
            <p className="py-6 text-center text-sm text-gray-400">Nenhum exercício encontrado</p>
          )}
        </div>
      </div>
    </Modal>
  )
}
