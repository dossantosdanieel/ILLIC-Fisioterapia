import { useState, useRef, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, Check, X } from 'lucide-react'
import { buscarPlanoCompleto } from '../api'
import { calcularSemanaAtual } from '../utils'
import {
  listarObjetivos, criarObjetivo, atualizarObjetivo, removerObjetivo,
  agruparPorLinha, gerarCelulas, proximaOrdem,
  type ObjetivoTimeline, type CorTimeline, type Linha,
} from '../timelineApi'
import { Spinner } from '@/components/ui/spinner'
import type { FaseCompleta } from '@/types/queries'

// ── Paleta ────────────────────────────────────────────────
const CORES: Record<CorTimeline, { bg: string; text: string; border: string; hover: string }> = {
  blue:   { bg: 'bg-blue-500',    text: 'text-white', border: 'border-blue-600',   hover: 'hover:bg-blue-600'   },
  green:  { bg: 'bg-emerald-500', text: 'text-white', border: 'border-emerald-600', hover: 'hover:bg-emerald-600' },
  purple: { bg: 'bg-violet-500',  text: 'text-white', border: 'border-violet-600', hover: 'hover:bg-violet-600' },
  amber:  { bg: 'bg-amber-400',   text: 'text-white', border: 'border-amber-500',  hover: 'hover:bg-amber-500'  },
  rose:   { bg: 'bg-rose-500',    text: 'text-white', border: 'border-rose-600',   hover: 'hover:bg-rose-600'   },
  cyan:   { bg: 'bg-cyan-500',    text: 'text-white', border: 'border-cyan-600',   hover: 'hover:bg-cyan-600'   },
  slate:  { bg: 'bg-slate-500',   text: 'text-white', border: 'border-slate-600',  hover: 'hover:bg-slate-600'  },
}

const LISTA_CORES = Object.keys(CORES) as CorTimeline[]

// Cores das fases (mesmas do LinhaDoTempo)
const CORES_FASE_BG = ['bg-blue-600','bg-emerald-600','bg-violet-600','bg-amber-500','bg-rose-500','bg-cyan-600']

interface Props { planoId: string }

interface EditState {
  id: string | null       // null = novo
  linhaCategoria: string  // para novo segmento numa linha existente
  nome: string
  semana_inicio: number
  semana_fim: number
  cor: CorTimeline
}

export function LinhaDoTempoGantt({ planoId }: Props) {
  const qc = useQueryClient()
  const [edit, setEdit] = useState<EditState | null>(null)
  const [novaLinha, setNovaLinha] = useState(false)
  const [novaCategoria, setNovaCategoria] = useState('')
  const [novaCor, setNovaCor] = useState<CorTimeline>('blue')
  const inputRef = useRef<HTMLInputElement>(null)

  const { data: plano, isLoading: loadingPlano } = useQuery({
    queryKey: ['plano', planoId],
    queryFn: () => buscarPlanoCompleto(planoId),
  })

  const { data: objetivosRaw, isLoading: loadingObj } = useQuery({
    queryKey: ['objetivo_timeline', planoId],
    queryFn: () => listarObjetivos(planoId),
  })

  useEffect(() => { if (edit) inputRef.current?.focus() }, [edit])

  if (loadingPlano || loadingObj) return <Spinner />
  if (!plano) return null

  const total = plano.prognostico_semanas
  const semanaAtual = calcularSemanaAtual(plano.data_av_inicial)
  const semanas = Array.from({ length: total }, (_, i) => i + 1)
  const fases = [...(plano.fase as FaseCompleta[])].sort((a, b) => a.ordem - b.ordem)
  const linhas = agruparPorLinha(objetivosRaw ?? [])

  function invalidar() {
    qc.invalidateQueries({ queryKey: ['objetivo_timeline', planoId] })
  }

  // Abre edição de segmento existente
  function abrirEditar(seg: ObjetivoTimeline) {
    setEdit({ id: seg.id, linhaCategoria: seg.categoria, nome: seg.nome, semana_inicio: seg.semana_inicio, semana_fim: seg.semana_fim, cor: seg.cor })
  }

  // Abre criação de novo segmento numa célula vazia
  function abrirNovoCelula(linha: Linha, semIni: number, colspan: number) {
    setEdit({
      id: null,
      linhaCategoria: linha.categoria,
      nome: '',
      semana_inicio: semIni,
      semana_fim: semIni + colspan - 1,
      cor: linha.cor,
    })
  }

  async function salvarEdit() {
    if (!edit || !edit.nome.trim()) return
    if (edit.semana_fim < edit.semana_inicio) return

    if (edit.id) {
      await atualizarObjetivo(edit.id, {
        nome: edit.nome.trim(),
        semana_inicio: edit.semana_inicio,
        semana_fim: edit.semana_fim,
        cor: edit.cor,
      })
    } else {
      const ordem = linhas.find(l => l.categoria === edit.linhaCategoria)?.linha_ordem
        ?? proximaOrdem(objetivosRaw ?? [])
      await criarObjetivo({
        plano_id: planoId,
        categoria: edit.linhaCategoria,
        nome: edit.nome.trim(),
        semana_inicio: edit.semana_inicio,
        semana_fim: edit.semana_fim,
        cor: edit.cor,
        linha_ordem: ordem,
      })
    }
    invalidar()
    setEdit(null)
  }

  async function remover(id: string) {
    await removerObjetivo(id)
    invalidar()
  }

  async function criarNovaLinha() {
    if (!novaCategoria.trim()) return
    await criarObjetivo({
      plano_id: planoId,
      categoria: novaCategoria.trim(),
      nome: novaCategoria.trim(),
      semana_inicio: 1,
      semana_fim: total,
      cor: novaCor,
      linha_ordem: proximaOrdem(objetivosRaw ?? []),
    })
    invalidar()
    setNovaCategoria('')
    setNovaLinha(false)
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-xs" style={{ minWidth: `${Math.max(600, total * 56)}px` }}>
        {/* ── colgroup: uma col por semana ─── */}
        <colgroup>
          {semanas.map(s => <col key={s} style={{ width: `${100 / total}%` }} />)}
        </colgroup>

        <thead>
          {/* ── Linha 1: título ─────────────────── */}
          <tr>
            <th
              colSpan={total}
              className="bg-slate-700 text-white text-center font-bold py-2 text-sm tracking-wide border border-slate-600"
            >
              PLANEJAMENTO DO TRATAMENTO
            </th>
          </tr>

          {/* ── Linha 2: fases ──────────────────── */}
          <tr>
            {fases.map((fase, i) => {
              const cols = fase.semana_fim - fase.semana_inicio + 1
              return (
                <th
                  key={fase.id}
                  colSpan={cols}
                  className={`${CORES_FASE_BG[i % CORES_FASE_BG.length]} text-white text-center font-bold py-1.5 border border-white/30`}
                >
                  {fase.nome.toUpperCase()}
                </th>
              )
            })}
          </tr>

          {/* ── Linha 3: números de semana ──────── */}
          <tr className="relative">
            {semanas.map(s => {
              const isAtual = s === Math.min(semanaAtual, total)
              return (
                <th
                  key={s}
                  className={`relative py-1.5 text-center font-semibold border border-gray-200 ${
                    isAtual
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  Sem {s}
                  {isAtual && (
                    <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-blue-600 rotate-45" />
                  )}
                </th>
              )
            })}
          </tr>
        </thead>

        <tbody>
          {linhas.map(linha => {
            const celulas = gerarCelulas(linha.segmentos, total)
            const cor = CORES[linha.cor] ?? CORES.blue

            return (
              <tr key={linha.categoria} className="group/row">
                {celulas.map((cel, ci) => {
                  // Célula preenchida
                  if (cel.tipo === 'filled' && cel.segmento) {
                    const seg = cel.segmento
                    const editando = edit?.id === seg.id

                    if (editando) {
                      return (
                        <td key={ci} colSpan={cel.colspan} className="p-1 border border-blue-400 bg-blue-50">
                          <EditCelula
                            edit={edit!}
                            total={total}
                            onChange={setEdit}
                            onSave={salvarEdit}
                            onCancel={() => setEdit(null)}
                            inputRef={inputRef}
                          />
                        </td>
                      )
                    }

                    return (
                      <td
                        key={ci}
                        colSpan={cel.colspan}
                        className={`
                          relative border border-white/50 px-2 py-2 text-center font-medium cursor-pointer
                          ${cor.bg} ${cor.text} ${cor.hover}
                          transition-colors group
                        `}
                        onClick={() => abrirEditar(seg)}
                        title="Clique para editar"
                      >
                        <span className="block truncate">{seg.nome}</span>
                        <button
                          onClick={e => { e.stopPropagation(); remover(seg.id) }}
                          className="absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-100 transition-opacity bg-black/20 rounded p-0.5"
                          title="Remover"
                        >
                          <Trash2 size={10} />
                        </button>
                      </td>
                    )
                  }

                  // Célula vazia — clicável para adicionar
                  const novoCelEdit = edit?.id === null && edit?.linhaCategoria === linha.categoria && edit?.semana_inicio === cel.semana_inicio
                  if (novoCelEdit) {
                    return (
                      <td key={ci} colSpan={cel.colspan} className="p-1 border border-blue-400 bg-blue-50">
                        <EditCelula
                          edit={edit!}
                          total={total}
                          onChange={setEdit}
                          onSave={salvarEdit}
                          onCancel={() => setEdit(null)}
                          inputRef={inputRef}
                        />
                      </td>
                    )
                  }

                  return (
                    <td
                      key={ci}
                      colSpan={cel.colspan}
                      className="border border-gray-100 bg-white hover:bg-blue-50 cursor-pointer transition-colors group/empty"
                      onClick={() => abrirNovoCelula(linha, cel.semana_inicio, cel.colspan)}
                      title="Clique para adicionar objetivo"
                    >
                      <div className="flex items-center justify-center h-7 opacity-0 group-hover/empty:opacity-100 transition-opacity">
                        <Plus size={12} className="text-blue-400" />
                      </div>
                    </td>
                  )
                })}
              </tr>
            )
          })}

          {/* ── Linha de marcador "agora" ────────── */}
          {semanaAtual <= total && (
            <tr className="pointer-events-none select-none">
              {semanas.map(s => (
                <td
                  key={s}
                  className={`h-1 ${s === Math.min(semanaAtual, total) ? 'bg-blue-500' : ''}`}
                />
              ))}
            </tr>
          )}

          {/* ── Nova linha ───────────────────────── */}
          {novaLinha ? (
            <tr>
              <td colSpan={total} className="p-2 bg-gray-50 border border-dashed border-gray-300">
                <div className="flex items-center gap-2">
                  <input
                    autoFocus
                    type="text"
                    placeholder="Nome da linha (ex: HSR de glúteo médio)"
                    value={novaCategoria}
                    onChange={e => setNovaCategoria(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') criarNovaLinha(); if (e.key === 'Escape') { setNovaLinha(false); setNovaCategoria('') } }}
                    className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {/* Seletor de cor */}
                  <div className="flex items-center gap-1">
                    {LISTA_CORES.map(c => (
                      <button
                        key={c}
                        onClick={() => setNovaCor(c)}
                        className={`w-5 h-5 rounded-full ${CORES[c].bg} transition-transform ${novaCor === c ? 'scale-125 ring-2 ring-offset-1 ring-gray-400' : ''}`}
                        title={c}
                      />
                    ))}
                  </div>
                  <button onClick={criarNovaLinha} className="p-1.5 text-green-600 hover:text-green-800">
                    <Check size={16} />
                  </button>
                  <button onClick={() => { setNovaLinha(false); setNovaCategoria('') }} className="p-1.5 text-gray-400 hover:text-gray-600">
                    <X size={16} />
                  </button>
                </div>
              </td>
            </tr>
          ) : (
            <tr>
              <td colSpan={total} className="border-t border-gray-200">
                <button
                  onClick={() => setNovaLinha(true)}
                  className="w-full flex items-center justify-center gap-2 py-2 text-xs text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                >
                  <Plus size={13} /> Adicionar linha de objetivo
                </button>
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Legenda semana atual */}
      {semanaAtual <= total && (
        <div className="flex items-center gap-1.5 mt-2 text-xs text-gray-500">
          <div className="w-3 h-3 bg-blue-600 rounded-sm" />
          <span>Semana {semanaAtual} — posição atual do paciente</span>
        </div>
      )}
      {semanaAtual > total && (
        <div className="flex items-center gap-1.5 mt-2 text-xs text-red-500">
          <div className="w-3 h-3 bg-red-500 rounded-sm" />
          <span>Plano vencido — semana {semanaAtual} (prognóstico: {total} semanas)</span>
        </div>
      )}
    </div>
  )
}

// ── Sub-componente: edição inline de célula ────────────────

interface EditCelulaProps {
  edit: {
    nome: string
    semana_inicio: number
    semana_fim: number
    cor: CorTimeline
  }
  total: number
  onChange: (e: any) => void
  onSave: () => void
  onCancel: () => void
  inputRef: React.RefObject<HTMLInputElement | null>
}

function EditCelula({ edit, total, onChange, onSave, onCancel, inputRef }: EditCelulaProps) {
  return (
    <div className="space-y-1.5">
      <input
        ref={inputRef}
        type="text"
        placeholder="Descrição do objetivo…"
        value={edit.nome}
        onChange={e => onChange((prev: any) => ({ ...prev, nome: e.target.value }))}
        onKeyDown={e => { if (e.key === 'Enter') onSave(); if (e.key === 'Escape') onCancel() }}
        className="w-full px-2 py-1 text-xs border border-blue-400 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
      <div className="flex items-center gap-1.5">
        <span className="text-gray-500">Sem.</span>
        <input
          type="number"
          min={1}
          max={edit.semana_fim}
          value={edit.semana_inicio}
          onChange={e => onChange((prev: any) => ({ ...prev, semana_inicio: Number(e.target.value) }))}
          className="w-12 px-1 py-0.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-center"
        />
        <span className="text-gray-400">–</span>
        <input
          type="number"
          min={edit.semana_inicio}
          max={total}
          value={edit.semana_fim}
          onChange={e => onChange((prev: any) => ({ ...prev, semana_fim: Number(e.target.value) }))}
          className="w-12 px-1 py-0.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-center"
        />
        {/* Cor */}
        <div className="flex items-center gap-0.5 ml-1">
          {LISTA_CORES.map(c => (
            <button
              key={c}
              onClick={() => onChange((prev: any) => ({ ...prev, cor: c }))}
              className={`w-3.5 h-3.5 rounded-full ${CORES[c].bg} ${edit.cor === c ? 'ring-1 ring-offset-1 ring-gray-500 scale-110' : ''}`}
              title={c}
            />
          ))}
        </div>
        <div className="ml-auto flex gap-1">
          <button onClick={onSave} className="p-0.5 text-green-600 hover:text-green-800" title="Salvar (Enter)">
            <Check size={14} />
          </button>
          <button onClick={onCancel} className="p-0.5 text-gray-400 hover:text-gray-600" title="Cancelar (Esc)">
            <X size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}
