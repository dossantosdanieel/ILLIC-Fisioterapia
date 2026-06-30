import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, GripVertical, Video, TrendingUp, TrendingDown, Minus, X, AlertTriangle, CheckCircle2 } from 'lucide-react'
import {
  buscarOuCriarTemplate, listarExercicios,
  criarBloco, removerBloco,
  adicionarExercicio, atualizarExercicioPrescrito, removerExercicioPrescrito,
  buscarVolumeMicrocicloAnterior,
} from '../api'
import type { BlocoCompleto, ExercicioPrescritoCompleto } from '../api'
import { calcularVolume, CARGA_TIPO_LABELS, classificarGrupo, progressaoEsperada, detectarModo } from '@/lib/carga'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { ExercicioCombobox } from '@/features/protocolos/components/ExercicioCombobox'
import type { CargaTipo } from '@/types/database'

const CARGA_TIPOS = Object.entries(CARGA_TIPO_LABELS).map(([value, label]) => ({ value: value as CargaTipo, label }))

const NOMES_BLOCO_EXTRA = [
  'Aquecimento', 'Terapia Manual', 'Mobilização Articular',
  'Fortalecimento', 'Controle Neuromuscular',
  'Propriocepção', 'Treino Funcional', 'Alongamento', 'Desaquecimento',
]

interface Props {
  microcicloId: string
  semanas: string
  objetivos?: string[]  // objetivos da fase — opcional, default []
}

export function BuilderSessao({ microcicloId, semanas, objetivos = [] }: Props) {
  const qc = useQueryClient()
  const [saving, setSaving] = useState(false)
  const [novoBloco, setNovoBloco] = useState('')
  // Qual seção está com o seletor inline aberto:
  // `obj:<texto>` para objetivo, `bloco:<id>` para bloco extra
  const [adicionandoEm, setAdicionandoEm] = useState<string | null>(null)

  const { data: template, isLoading } = useQuery({
    queryKey: ['sessao-template', microcicloId],
    queryFn: () => buscarOuCriarTemplate(microcicloId),
  })

  const { data: prevVolume } = useQuery({
    queryKey: ['volume-anterior', microcicloId],
    queryFn: () => buscarVolumeMicrocicloAnterior(microcicloId),
  })

  const { data: exerciciosCatalogo = [] } = useQuery({
    queryKey: ['exercicios-catalogo-admin'],
    queryFn: () => listarExercicios(''),
  })

  const blocos: BlocoCompleto[] = [...(template?.bloco ?? [])].sort((a, b) => a.ordem - b.ordem)

  // Mapeamento: objetivo texto → bloco correspondente
  const objetivoParaBloco = new Map<string, BlocoCompleto>()
  for (const bloco of blocos) {
    if (objetivos.includes(bloco.nome)) {
      objetivoParaBloco.set(bloco.nome, bloco)
    }
  }

  // Blocos extras (não vinculados a nenhum objetivo)
  const extraBlocos = blocos.filter(b => !objetivos.includes(b.nome))

  // Objetivos sem nenhuma ação
  const objetivosSemAcao = objetivos.filter(obj => {
    const bloco = objetivoParaBloco.get(obj)
    return !bloco || (bloco.exercicio_prescrito?.length ?? 0) === 0
  })

  // Volume total por grupo muscular (todos os blocos)
  const volumeAtual: Record<string, { volume: number; unidade: string; tipo: 'grande' | 'pequeno' }> = {}
  for (const bloco of blocos) {
    for (const ep of bloco.exercicio_prescrito ?? []) {
      const grupo = ep.exercicio.grupo_muscular ?? 'Geral'
      const tipo = classificarGrupo(grupo)
      const vol = calcularVolume(ep.series, ep.reps, ep.tempo_seg, ep.carga_tipo, ep.carga_valor)
      if (vol) {
        if (!volumeAtual[grupo]) volumeAtual[grupo] = { volume: 0, unidade: vol.unidade, tipo }
        volumeAtual[grupo].volume += vol.volume
      }
    }
  }

  // Adicionar exercício a um objetivo (cria bloco automaticamente se ainda não existe)
  async function handleAddExercicioObjetivo(objetivoTexto: string, exercicioId: string) {
    const blocoExistente = objetivoParaBloco.get(objetivoTexto)
    let blocoId: string

    if (blocoExistente) {
      blocoId = blocoExistente.id
    } else {
      // Cria o bloco para este objetivo com ordem baseada na posição do objetivo
      const ordem = objetivos.indexOf(objetivoTexto) + 1
      const novo = await criarBloco(template!.id, objetivoTexto, ordem)
      blocoId = novo.id
      // Invalida para garantir que blocos refrescam antes de adicionar o exercício
      await qc.invalidateQueries({ queryKey: ['sessao-template', microcicloId] })
    }

    const blocoAtual = blocos.find(b => b.id === blocoId)
    const ordemEx = (blocoAtual?.exercicio_prescrito?.length ?? 0) + 1

    await adicionarExercicio({
      bloco_id: blocoId, exercicio_id: exercicioId,
      series: 3, reps: 10, tempo_seg: null,
      carga_tipo: 'kg', carga_valor: '0',
      nota: null, condicional: false, ordem: ordemEx,
      regra_progressao: null,
    })
    qc.invalidateQueries({ queryKey: ['sessao-template', microcicloId] })
    setAdicionandoEm(null)
  }

  // Adicionar exercício a um bloco extra
  async function handleAddExercicioBloco(blocoId: string, exercicioId: string) {
    const bloco = blocos.find(b => b.id === blocoId)
    const ordemEx = (bloco?.exercicio_prescrito?.length ?? 0) + 1
    await adicionarExercicio({
      bloco_id: blocoId, exercicio_id: exercicioId,
      series: 3, reps: 10, tempo_seg: null,
      carga_tipo: 'kg', carga_valor: '0',
      nota: null, condicional: false, ordem: ordemEx,
      regra_progressao: null,
    })
    qc.invalidateQueries({ queryKey: ['sessao-template', microcicloId] })
    setAdicionandoEm(null)
  }

  async function handleAddBlocoExtra(nome: string) {
    const nomeTrimado = nome.trim()
    if (!nomeTrimado || !template) return
    setSaving(true)
    try {
      const ordemExtra = objetivos.length + extraBlocos.length + 1
      const novo = await criarBloco(template.id, nomeTrimado, ordemExtra)
      setNovoBloco('')
      await qc.invalidateQueries({ queryKey: ['sessao-template', microcicloId] })
      setAdicionandoEm(`bloco:${novo.id}`)
    } finally { setSaving(false) }
  }

  async function handleRemoveBloco(id: string) {
    if (!confirm('Remover bloco e todos os exercícios?')) return
    await removerBloco(id)
    qc.invalidateQueries({ queryKey: ['sessao-template', microcicloId] })
  }

  async function handleRemoveExercicio(id: string) {
    await removerExercicioPrescrito(id)
    qc.invalidateQueries({ queryKey: ['sessao-template', microcicloId] })
  }

  if (isLoading) return <Spinner />

  const temDados = Object.keys(volumeAtual).length > 0
  const sessaoCompleta = objetivos.length > 0 && objetivosSemAcao.length === 0

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Sessão proposta</h3>
          <p className="text-xs text-gray-500">Semanas {semanas}</p>
        </div>
        {objetivos.length > 0 && (
          sessaoCompleta
            ? <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                <CheckCircle2 size={13} /> Todos os objetivos contemplados
              </span>
            : <span className="flex items-center gap-1 text-xs text-amber-600 font-medium">
                <AlertTriangle size={13} /> {objetivosSemAcao.length} objetivo{objetivosSemAcao.length > 1 ? 's' : ''} sem ação
              </span>
        )}
      </div>

      {/* Painel de volume por grupo muscular */}
      {temDados && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Volume prescrito por grupo muscular
          </p>
          <div className="space-y-1.5">
            {Object.entries(volumeAtual).map(([grupo, curr]) => {
              const prev = prevVolume?.volumePorGrupo[grupo]
              const progressao = prev && prev.volume > 0
                ? (curr.volume - prev.volume) / prev.volume
                : null
              const esp = progressaoEsperada(curr.tipo)
              const insuficiente = progressao !== null && progressao < esp.min
              const queda = progressao !== null && progressao < 0
              return (
                <div key={grupo} className="flex items-center gap-2 text-xs">
                  <span className="w-36 text-gray-700 font-medium truncate">{grupo}</span>
                  <span className="text-gray-900 font-mono">{curr.volume.toFixed(0)} {curr.unidade}</span>
                  {progressao !== null && (
                    <span className={`flex items-center gap-0.5 font-medium ${
                      queda ? 'text-red-600' : insuficiente ? 'text-amber-600' : 'text-green-600'
                    }`}>
                      {queda ? <TrendingDown size={11} /> : insuficiente ? <Minus size={11} /> : <TrendingUp size={11} />}
                      {progressao >= 0 ? '+' : ''}{(progressao * 100).toFixed(0)}%
                      {(queda || insuficiente) && (
                        <span className="text-gray-400 font-normal ml-0.5">(esperado {esp.label})</span>
                      )}
                    </span>
                  )}
                  {progressao === null && prev === undefined && prevVolume && (
                    <span className="text-gray-400 italic">novo grupo neste microciclo</span>
                  )}
                </div>
              )
            })}
          </div>
          {prevVolume && (
            <p className="text-xs text-gray-400 mt-2">
              Comparado com microciclo {prevVolume.ordem} (anterior)
            </p>
          )}
        </div>
      )}

      {/* ── Seções de objetivos (obrigatórias) ── */}
      {objetivos.length === 0 && (
        <div className="rounded-lg border border-dashed border-gray-200 px-4 py-6 text-center">
          <p className="text-sm text-gray-400">Esta fase não tem objetivos definidos.</p>
          <p className="text-xs text-gray-400 mt-1">Adicione blocos de exercícios abaixo.</p>
        </div>
      )}

      <div className="space-y-3">
        {objetivos.map((objetivo) => {
          const bloco = objetivoParaBloco.get(objetivo)
          const exs = [...(bloco?.exercicio_prescrito ?? [])].sort((a, b) => a.ordem - b.ordem)
          const temAcoes = exs.length > 0
          const chave = `obj:${objetivo}`

          let blocoVol = 0; let blocoUnidade = ''
          exs.forEach(ep => {
            const vol = calcularVolume(ep.series, ep.reps, ep.tempo_seg, ep.carga_tipo, ep.carga_valor)
            if (vol) { blocoVol += vol.volume; if (!blocoUnidade) blocoUnidade = vol.unidade }
          })

          return (
            <div key={objetivo} className={`border rounded-lg transition-colors ${
              temAcoes ? 'border-blue-100' : 'border-amber-200'
            }`}>
              {/* Cabeçalho do objetivo */}
              <div className={`flex items-center gap-2.5 px-3 py-3 rounded-t-lg ${
                temAcoes ? 'bg-blue-50/60' : 'bg-amber-50/60'
              }`}>
                {temAcoes
                  ? <CheckCircle2 size={14} className="text-blue-500 shrink-0" />
                  : <AlertTriangle size={14} className="text-amber-500 shrink-0" />}
                <span className="flex-1 text-sm font-semibold text-gray-800">{objetivo}</span>
                {blocoVol > 0 && (
                  <span className="text-xs text-blue-600 font-mono bg-blue-100/70 px-2 py-0.5 rounded">
                    {blocoVol.toFixed(0)} {blocoUnidade}
                  </span>
                )}
                {!temAcoes && (
                  <span className="text-xs text-amber-600 font-medium bg-amber-100/70 px-2 py-0.5 rounded">
                    Sem ação
                  </span>
                )}
              </div>

              {/* Exercícios */}
              <div className="px-3 py-3 space-y-2">
                {!temAcoes && adicionandoEm !== chave && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 rounded-md border border-amber-100">
                    <AlertTriangle size={12} className="text-amber-500 shrink-0" />
                    <p className="text-xs text-amber-700">
                      Proponha ao menos uma ação para este objetivo antes de executar a sessão.
                    </p>
                  </div>
                )}

                {exs.map(ep => (
                  <ExercicioRow
                    key={ep.id}
                    ep={ep}
                    onRemove={() => handleRemoveExercicio(ep.id)}
                    onSave={async patch => {
                      await atualizarExercicioPrescrito(ep.id, patch)
                      qc.invalidateQueries({ queryKey: ['sessao-template', microcicloId] })
                      qc.invalidateQueries({ queryKey: ['volume-anterior', microcicloId] })
                    }}
                  />
                ))}

                {/* Seletor inline */}
                {adicionandoEm === chave && (
                  <div className="p-3 bg-white rounded-md border border-blue-200">
                    <label className="text-xs font-medium text-gray-500 block mb-1.5">
                      Exercício / Terapia
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <ExercicioCombobox
                          exercicios={exerciciosCatalogo}
                          value=""
                          onChange={(id) => handleAddExercicioObjetivo(objetivo, id)}
                        />
                      </div>
                      <button
                        onClick={() => setAdicionandoEm(null)}
                        className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors border border-gray-200 rounded-md"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                )}

                <button
                  onClick={() => setAdicionandoEm(adicionandoEm === chave ? null : chave)}
                  className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium mt-1 pl-1 transition-colors"
                >
                  <Plus size={12} /> Adicionar exercício ou terapia
                </button>
              </div>
            </div>
          )
        })}

        {/* ── Blocos extras (não vinculados a objetivos) ── */}
        {extraBlocos.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider px-1">
              Blocos adicionais
            </p>
            {extraBlocos.map(bloco => {
              const exs = [...(bloco.exercicio_prescrito ?? [])].sort((a, b) => a.ordem - b.ordem)
              const chave = `bloco:${bloco.id}`

              let blocoVol = 0; let blocoUnidade = ''
              exs.forEach(ep => {
                const vol = calcularVolume(ep.series, ep.reps, ep.tempo_seg, ep.carga_tipo, ep.carga_valor)
                if (vol) { blocoVol += vol.volume; if (!blocoUnidade) blocoUnidade = vol.unidade }
              })

              return (
                <div key={bloco.id} className="border border-gray-200 rounded-lg">
                  <div className="flex items-center gap-2 px-3 py-3 bg-gray-50 rounded-t-lg">
                    <GripVertical size={14} className="text-gray-300 shrink-0" />
                    <span className="flex-1 text-sm font-semibold text-gray-700">{bloco.nome}</span>
                    {blocoVol > 0 && (
                      <span className="text-xs text-gray-500 font-mono bg-gray-100 px-2 py-0.5 rounded">
                        {blocoVol.toFixed(0)} {blocoUnidade}
                      </span>
                    )}
                    <button
                      onClick={() => handleRemoveBloco(bloco.id)}
                      className="p-1 text-gray-300 hover:text-red-500 transition-colors shrink-0"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>

                  <div className="px-3 py-3 space-y-2">
                    {exs.length === 0 && adicionandoEm !== chave && (
                      <p className="text-xs text-gray-400 italic pl-1">Nenhum exercício adicionado.</p>
                    )}

                    {exs.map(ep => (
                      <ExercicioRow
                        key={ep.id}
                        ep={ep}
                        onRemove={() => handleRemoveExercicio(ep.id)}
                        onSave={async patch => {
                          await atualizarExercicioPrescrito(ep.id, patch)
                          qc.invalidateQueries({ queryKey: ['sessao-template', microcicloId] })
                          qc.invalidateQueries({ queryKey: ['volume-anterior', microcicloId] })
                        }}
                      />
                    ))}

                    {adicionandoEm === chave && (
                      <div className="p-3 bg-white rounded-md border border-gray-200">
                        <label className="text-xs font-medium text-gray-500 block mb-1.5">
                          Exercício / Terapia
                        </label>
                        <div className="flex items-center gap-2">
                          <div className="flex-1">
                            <ExercicioCombobox
                              exercicios={exerciciosCatalogo}
                              value=""
                              onChange={(id) => handleAddExercicioBloco(bloco.id, id)}
                            />
                          </div>
                          <button
                            onClick={() => setAdicionandoEm(null)}
                            className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors border border-gray-200 rounded-md"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                    )}

                    <button
                      onClick={() => setAdicionandoEm(adicionandoEm === chave ? null : chave)}
                      className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium mt-1 pl-1 transition-colors"
                    >
                      <Plus size={12} /> Adicionar exercício ou terapia
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Adicionar bloco extra ── */}
      <div className="space-y-2 pt-1 border-t border-gray-100">
        <p className="text-xs font-medium text-gray-400 pt-2">Bloco adicional (opcional):</p>
        <div className="flex flex-wrap gap-1.5">
          {NOMES_BLOCO_EXTRA.filter(n => !objetivos.includes(n)).map(nome => (
            <button
              key={nome}
              onClick={() => handleAddBlocoExtra(nome)}
              disabled={saving}
              className="text-xs px-2.5 py-1 bg-gray-100 text-gray-500 rounded-full hover:bg-gray-200 hover:text-gray-700 transition-colors disabled:opacity-50"
            >
              + {nome}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Nome personalizado…"
            value={novoBloco}
            onChange={e => setNovoBloco(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddBlocoExtra(novoBloco)}
            className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <Button size="sm" variant="secondary" onClick={() => handleAddBlocoExtra(novoBloco)} loading={saving} disabled={!novoBloco.trim()}>
            <Plus size={14} /> Bloco
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Linha de exercício prescrito ──────────────────────────────

interface ExercicioRowProps {
  ep: ExercicioPrescritoCompleto
  onRemove: () => void
  onSave: (patch: Partial<ExercicioPrescritoCompleto>) => Promise<void>
}

function ExercicioRow({ ep, onRemove, onSave }: ExercicioRowProps) {
  const modoInicial = detectarModo(ep.reps, ep.tempo_seg)
  const [form, setForm] = useState({
    series: ep.series,
    reps: ep.reps ?? 10,
    tempo_seg: ep.tempo_seg ?? 0,
    carga_tipo: ep.carga_tipo,
    carga_valor: ep.carga_valor,
    nota: ep.nota ?? '',
    condicional: ep.condicional,
    regra_progressao: ep.regra_progressao ?? '',
    modo: modoInicial as 'reps' | 'tempo' | 'reps_e_tempo',
  })
  const [expandido, setExpandido] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setForm({
      series: ep.series,
      reps: ep.reps ?? 10,
      tempo_seg: ep.tempo_seg ?? 0,
      carga_tipo: ep.carga_tipo,
      carga_valor: ep.carga_valor,
      nota: ep.nota ?? '',
      condicional: ep.condicional,
      regra_progressao: ep.regra_progressao ?? '',
      modo: detectarModo(ep.reps, ep.tempo_seg),
    })
  }, [ep])

  async function handleSave() {
    setSaving(true)
    try {
      await onSave({
        series: form.series,
        reps: form.modo === 'tempo' ? null : form.reps || null,
        tempo_seg: form.modo === 'reps' ? null : form.tempo_seg || null,
        carga_tipo: form.carga_tipo,
        carga_valor: form.carga_valor,
        nota: form.nota || null,
        condicional: form.condicional,
        regra_progressao: form.regra_progressao || null,
      })
      setExpandido(false)
    } finally { setSaving(false) }
  }

  const repsParaVol = form.modo === 'tempo' ? null : form.reps || null
  const tempoParaVol = form.modo === 'reps' ? null : form.tempo_seg || null
  const vol = expandido
    ? calcularVolume(form.series, repsParaVol, tempoParaVol, form.carga_tipo, form.carga_valor)
    : calcularVolume(ep.series, ep.reps, ep.tempo_seg, ep.carga_tipo, ep.carga_valor)

  function prescricaoTexto() {
    const modo = detectarModo(ep.reps, ep.tempo_seg)
    const cargaLabel = CARGA_TIPO_LABELS[ep.carga_tipo] ?? ep.carga_tipo
    if (modo === 'reps') return `${ep.series}×${ep.reps} rep · ${ep.carga_valor} ${cargaLabel}`
    if (modo === 'tempo') return `${ep.series}×${ep.tempo_seg}s · ${ep.carga_valor} ${cargaLabel}`
    return `${ep.series}×${ep.reps}rep×${ep.tempo_seg}s · ${ep.carga_valor} ${cargaLabel}`
  }

  return (
    <div className="bg-white rounded-md border border-gray-200">
      {/* Linha compacta sempre visível */}
      <div className="flex items-start gap-2 p-2.5">
        <GripVertical size={14} className="text-gray-200 mt-0.5 shrink-0" />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-gray-800">{ep.exercicio.nome}</span>
            {ep.exercicio.grupo_muscular && (
              <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                {ep.exercicio.grupo_muscular}
              </span>
            )}
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

          {!expandido && (
            <div className="flex items-center gap-3 mt-0.5 flex-wrap">
              <span className="text-xs text-gray-500 font-mono">{prescricaoTexto()}</span>
              {vol && (
                <span className="text-xs text-blue-500 font-mono">
                  Vol: {vol.volume.toFixed(0)} {vol.unidade}
                </span>
              )}
              {ep.regra_progressao && (
                <span className="text-xs text-green-600">↗ {ep.regra_progressao}</span>
              )}
              {ep.nota && <span className="text-xs text-gray-400 italic truncate max-w-xs">{ep.nota}</span>}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setExpandido(!expandido)}
            className="text-xs text-gray-400 hover:text-blue-600 transition-colors px-1.5 py-1"
          >
            {expandido ? 'Fechar' : 'Editar'}
          </button>
          <button
            onClick={onRemove}
            className="text-gray-300 hover:text-red-500 transition-colors p-1"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* Painel de edição expansível */}
      {expandido && (
        <div className="px-3 pb-3 space-y-2.5 border-t border-gray-100 pt-2.5">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs text-gray-500 shrink-0">Modo:</span>
            {(['reps', 'tempo', 'reps_e_tempo'] as const).map(m => (
              <label key={m} className={`flex items-center gap-1.5 text-xs cursor-pointer px-2 py-1 rounded border transition-colors
                ${form.modo === m
                  ? 'border-blue-400 bg-blue-50 text-blue-700'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                <input type="radio" className="sr-only" checked={form.modo === m}
                  onChange={() => setForm(f => ({ ...f, modo: m }))} />
                {m === 'reps' ? 'Repetições' : m === 'tempo' ? 'Tempo' : 'Reps + Tempo (TUT)'}
              </label>
            ))}
            <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer ml-auto">
              <input type="checkbox" checked={form.condicional}
                onChange={e => setForm(f => ({ ...f, condicional: e.target.checked }))}
                className="h-3.5 w-3.5" />
              Condicional
            </label>
          </div>

          <div className="grid grid-cols-5 gap-2">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Séries</label>
              <input type="number" min={1} value={form.series}
                onChange={e => setForm(f => ({ ...f, series: Number(e.target.value) }))}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
            {form.modo !== 'tempo' && (
              <div>
                <label className="text-xs text-gray-500 block mb-1">Reps</label>
                <input type="number" min={1} value={form.reps}
                  onChange={e => setForm(f => ({ ...f, reps: Number(e.target.value) }))}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
            )}
            {form.modo !== 'reps' && (
              <div>
                <label className="text-xs text-gray-500 block mb-1">Tempo (s)</label>
                <input type="number" min={1} value={form.tempo_seg}
                  onChange={e => setForm(f => ({ ...f, tempo_seg: Number(e.target.value) }))}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
            )}
            <div>
              <label className="text-xs text-gray-500 block mb-1">Tipo carga</label>
              <select value={form.carga_tipo}
                onChange={e => setForm(f => ({ ...f, carga_tipo: e.target.value as CargaTipo }))}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500">
                {CARGA_TIPOS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Valor</label>
              <input type="text" value={form.carga_valor}
                onChange={e => setForm(f => ({ ...f, carga_valor: e.target.value }))}
                placeholder="ex: 10, 60%"
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
          </div>

          {vol && (
            <div className="flex items-center gap-2 text-xs text-blue-700 bg-blue-50 rounded px-2 py-1.5">
              <span className="font-medium">Volume calculado:</span>
              <span className="font-mono">{vol.descricao}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Regra de progressão</label>
              <input type="text" value={form.regra_progressao}
                onChange={e => setForm(f => ({ ...f, regra_progressao: e.target.value }))}
                placeholder="ex: +2 kg, faixa_leve→faixa_moderada"
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Nota / Instrução</label>
              <input type="text" value={form.nota}
                onChange={e => setForm(f => ({ ...f, nota: e.target.value }))}
                placeholder="instrução adicional"
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <Button size="sm" onClick={handleSave} loading={saving}>Salvar</Button>
            <Button size="sm" variant="ghost" onClick={() => setExpandido(false)}>Cancelar</Button>
          </div>
        </div>
      )}
    </div>
  )
}
