import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, Check, X, ChevronDown, ChevronUp } from 'lucide-react'
import { buscarPlanoCompleto, atualizarFase } from '../api'
import { calcularSemanaAtual } from '../utils'
import { Spinner } from '@/components/ui/spinner'
import type { FaseCompleta } from '@/types/queries'

// Paleta de cores por fase (cíclica)
const CORES_FASE = [
  { bg: 'bg-blue-500',   leve: 'bg-blue-100',   borda: 'border-blue-300',   texto: 'text-blue-800',   hex: '#3b82f6' },
  { bg: 'bg-emerald-500', leve: 'bg-emerald-100', borda: 'border-emerald-300', texto: 'text-emerald-800', hex: '#10b981' },
  { bg: 'bg-violet-500', leve: 'bg-violet-100', borda: 'border-violet-300', texto: 'text-violet-800', hex: '#8b5cf6' },
  { bg: 'bg-amber-500',  leve: 'bg-amber-100',  borda: 'border-amber-300',  texto: 'text-amber-800',  hex: '#f59e0b' },
  { bg: 'bg-rose-500',   leve: 'bg-rose-100',   borda: 'border-rose-300',   texto: 'text-rose-800',   hex: '#f43f5e' },
  { bg: 'bg-cyan-500',   leve: 'bg-cyan-100',   borda: 'border-cyan-300',   texto: 'text-cyan-800',   hex: '#06b6d4' },
]

interface Props { planoId: string }

export function LinhaDoTempo({ planoId }: Props) {
  const qc = useQueryClient()

  const { data: plano, isLoading } = useQuery({
    queryKey: ['plano', planoId],
    queryFn: () => buscarPlanoCompleto(planoId),
  })

  if (isLoading) return <Spinner />
  if (!plano) return null

  const total = plano.prognostico_semanas
  const semanaAtual = calcularSemanaAtual(plano.data_av_inicial)
  const semAtualClamp = Math.min(semanaAtual, total)
  const pctAtual = ((semAtualClamp - 0.5) / total) * 100

  const fases = [...(plano.fase as FaseCompleta[])].sort((a, b) => a.ordem - b.ordem)

  // Marcadores de semana para o ruler (a cada 2 semanas ou menos)
  const passo = total <= 8 ? 1 : total <= 16 ? 2 : total <= 24 ? 3 : 4
  const marcadores: number[] = []
  for (let s = 1; s <= total; s += passo) marcadores.push(s)
  if (marcadores[marcadores.length - 1] !== total) marcadores.push(total)

  return (
    <div className="space-y-6">
      {/* ── Barra horizontal (Gantt) ────────────────────────── */}
      <div>
        {/* Ruler de semanas */}
        <div className="relative h-6 mb-1 select-none">
          {marcadores.map(s => (
            <span
              key={s}
              className="absolute -translate-x-1/2 text-xs text-gray-400"
              style={{ left: `${((s - 0.5) / total) * 100}%` }}
            >
              {s}
            </span>
          ))}
          <span className="absolute right-0 text-xs text-gray-400">sem.</span>
        </div>

        {/* Trilho das fases */}
        <div className="relative h-10 bg-gray-100 rounded-full overflow-hidden">
          {fases.map((fase, i) => {
            const cor = CORES_FASE[i % CORES_FASE.length]
            const left = ((fase.semana_inicio - 1) / total) * 100
            const width = ((fase.semana_fim - fase.semana_inicio + 1) / total) * 100
            const isFaseAtual = semanaAtual >= fase.semana_inicio && semanaAtual <= fase.semana_fim

            return (
              <div
                key={fase.id}
                title={`${fase.nome} (Sem. ${fase.semana_inicio}–${fase.semana_fim})`}
                className={`absolute top-0 h-full flex items-center justify-center
                  ${cor.bg} ${isFaseAtual ? 'opacity-100' : 'opacity-70'}
                  transition-opacity`}
                style={{ left: `${left}%`, width: `${width}%` }}
              >
                <span className="text-white text-xs font-semibold truncate px-2 pointer-events-none">
                  {fase.nome}
                </span>
                {/* Separador entre fases */}
                {i < fases.length - 1 && (
                  <div className="absolute right-0 top-0 h-full w-0.5 bg-white/50" />
                )}
              </div>
            )
          })}

          {/* Indicador da semana atual */}
          {semanaAtual <= total && (
            <div
              className="absolute top-0 h-full flex flex-col items-center pointer-events-none z-10"
              style={{ left: `${pctAtual}%` }}
            >
              <div className="w-0.5 h-full bg-white shadow-md" />
            </div>
          )}
        </div>

        {/* Marcador da semana atual abaixo */}
        <div className="relative h-6 mt-1">
          <div
            className="absolute -translate-x-1/2 flex flex-col items-center"
            style={{ left: `${pctAtual}%` }}
          >
            <div className="text-xs font-bold text-gray-700 bg-white border border-gray-300 px-2 py-0.5 rounded-full shadow-sm whitespace-nowrap">
              {semanaAtual > total
                ? `Vencido (Sem. ${semanaAtual})`
                : `Sem. ${semanaAtual} ← agora`}
            </div>
          </div>
        </div>
      </div>

      {/* ── Cards de objetivos por fase ─────────────────────── */}
      <div className="space-y-3">
        {fases.map((fase, i) => {
          const cor = CORES_FASE[i % CORES_FASE.length]
          const isAtual = semanaAtual >= fase.semana_inicio && semanaAtual <= fase.semana_fim
          const concluida = semanaAtual > fase.semana_fim

          return (
            <FaseObjetivosCard
              key={fase.id}
              fase={fase}
              cor={cor}
              isAtual={isAtual}
              concluida={concluida}
              onAtualizar={async (id, novosObjetivos) => {
                await atualizarFase(id, { objetivos: novosObjetivos })
                qc.invalidateQueries({ queryKey: ['plano', planoId] })
              }}
            />
          )
        })}
      </div>
    </div>
  )
}

// ── Card editável de objetivos de uma fase ─────────────────

interface CorFase {
  bg: string; leve: string; borda: string; texto: string; hex: string
}

interface FaseCardProps {
  fase: FaseCompleta
  cor: CorFase
  isAtual: boolean
  concluida: boolean
  onAtualizar: (faseId: string, objetivos: string[]) => Promise<void>
}

function FaseObjetivosCard({ fase, cor, isAtual, concluida, onAtualizar }: FaseCardProps) {
  const [expandido, setExpandido] = useState(isAtual) // abre a fase atual por padrão
  const [objetivos, setObjetivos] = useState<string[]>(fase.objetivos ?? [])
  const [editandoIdx, setEditandoIdx] = useState<number | null>(null)
  const [textoEdit, setTextoEdit] = useState('')
  const [novoTexto, setNovoTexto] = useState('')
  const [adicionando, setAdicionando] = useState(false)
  const [salvando, setSalvando] = useState(false)

  async function salvar(novosObjetivos: string[]) {
    setSalvando(true)
    try {
      await onAtualizar(fase.id, novosObjetivos)
      setObjetivos(novosObjetivos)
    } finally {
      setSalvando(false) }
  }

  function iniciarEdicao(idx: number) {
    setEditandoIdx(idx)
    setTextoEdit(objetivos[idx])
  }

  async function confirmarEdicao(idx: number) {
    if (!textoEdit.trim()) { cancelarEdicao(); return }
    const novos = objetivos.map((o, i) => i === idx ? textoEdit.trim() : o)
    await salvar(novos)
    setEditandoIdx(null)
  }

  function cancelarEdicao() {
    setEditandoIdx(null)
    setTextoEdit('')
  }

  async function removerObjetivo(idx: number) {
    await salvar(objetivos.filter((_, i) => i !== idx))
  }

  async function adicionarObjetivo() {
    if (!novoTexto.trim()) return
    await salvar([...objetivos, novoTexto.trim()])
    setNovoTexto('')
    setAdicionando(false)
  }

  return (
    <div className={`rounded-xl border-2 transition-all ${
      isAtual ? `${cor.borda} shadow-md` : concluida ? 'border-gray-200 opacity-80' : 'border-gray-100'
    }`}>
      {/* Header clicável */}
      <button
        onClick={() => setExpandido(!expandido)}
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-colors ${
          isAtual ? cor.leve : 'bg-gray-50 hover:bg-gray-100'
        }`}
      >
        {/* Bolinha de status */}
        <div className={`w-3 h-3 rounded-full shrink-0 ${
          concluida ? 'bg-green-400' : isAtual ? cor.bg : 'bg-gray-300'
        }`} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-sm font-semibold ${isAtual ? cor.texto : 'text-gray-700'}`}>
              {fase.nome}
            </span>
            {isAtual && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cor.leve} ${cor.texto} border ${cor.borda}`}>
                Fase atual
              </span>
            )}
            {concluida && (
              <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-green-100 text-green-700 border border-green-200">
                Concluída
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            Semanas {fase.semana_inicio}–{fase.semana_fim}
            {objetivos.length > 0 && ` · ${objetivos.length} objetivo${objetivos.length > 1 ? 's' : ''}`}
          </p>
        </div>

        {expandido
          ? <ChevronUp size={16} className="text-gray-400 shrink-0" />
          : <ChevronDown size={16} className="text-gray-400 shrink-0" />
        }
      </button>

      {/* Corpo — objetivos */}
      {expandido && (
        <div className="px-4 pb-4 pt-2 space-y-1.5">
          {objetivos.length === 0 && !adicionando && (
            <p className="text-xs text-gray-400 italic py-1">
              Nenhum objetivo definido para esta fase.
            </p>
          )}

          {objetivos.map((obj, idx) => (
            <div key={idx} className="group flex items-start gap-2">
              {/* Bolinha de marcador */}
              <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${cor.bg} opacity-70`} />

              {editandoIdx === idx ? (
                /* Modo edição */
                <div className="flex-1 flex items-center gap-2">
                  <input
                    autoFocus
                    type="text"
                    value={textoEdit}
                    onChange={e => setTextoEdit(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') confirmarEdicao(idx)
                      if (e.key === 'Escape') cancelarEdicao()
                    }}
                    className="flex-1 px-2 py-1 text-sm border border-blue-400 rounded focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
                  />
                  <button
                    onClick={() => confirmarEdicao(idx)}
                    disabled={salvando}
                    className="p-1 text-green-600 hover:text-green-800 transition-colors"
                    title="Confirmar (Enter)"
                  >
                    <Check size={14} />
                  </button>
                  <button
                    onClick={cancelarEdicao}
                    className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                    title="Cancelar (Esc)"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                /* Modo visualização */
                <div className="flex-1 flex items-start justify-between gap-2">
                  <span className="text-sm text-gray-700 leading-snug">{obj}</span>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button
                      onClick={() => iniciarEdicao(idx)}
                      className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                      title="Editar objetivo"
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      onClick={() => removerObjetivo(idx)}
                      className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                      title="Remover objetivo"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Adicionar novo objetivo */}
          {adicionando ? (
            <div className="flex items-center gap-2 mt-1 pl-4">
              <input
                autoFocus
                type="text"
                placeholder="Descreva o objetivo…"
                value={novoTexto}
                onChange={e => setNovoTexto(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') adicionarObjetivo()
                  if (e.key === 'Escape') { setAdicionando(false); setNovoTexto('') }
                }}
                className="flex-1 px-2 py-1 text-sm border border-blue-400 rounded focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
              />
              <button
                onClick={adicionarObjetivo}
                disabled={salvando || !novoTexto.trim()}
                className="p-1 text-green-600 hover:text-green-800 disabled:opacity-40 transition-colors"
                title="Adicionar (Enter)"
              >
                <Check size={14} />
              </button>
              <button
                onClick={() => { setAdicionando(false); setNovoTexto('') }}
                className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                title="Cancelar (Esc)"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setAdicionando(true)}
              className={`flex items-center gap-1.5 text-xs mt-1 pl-4 font-medium transition-colors ${cor.texto} opacity-70 hover:opacity-100`}
            >
              <Plus size={12} /> Adicionar objetivo
            </button>
          )}
        </div>
      )}
    </div>
  )
}
