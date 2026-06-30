import { useState, useRef, useEffect, useCallback } from 'react'
import { Plus, Trash2, ChevronDown, ChevronUp, X, GripVertical, Copy } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ExercicioCombobox } from './ExercicioCombobox'

// ── Tipos exportados ──────────────────────────────────────────────────────────

export interface ExercicioFaseForm {
  exercicio_id: string
  nota: string
  semana_inicio: number | null
  semana_fim: number | null
}

export interface ObjetivoComExercicios {
  texto: string
  semana_inicio: number | null
  semana_fim: number | null
  exercicios: ExercicioFaseForm[]
}

export interface FaseForm {
  nome: string
  semana_inicio: number
  semana_fim: number
  objetivos: ObjetivoComExercicios[]
  expanded: boolean
}

export interface Exercicio {
  id: string
  nome: string
  grupo_muscular: string | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function novaFase(anterior?: FaseForm, indice = 0): FaseForm {
  return {
    nome: `Fase ${indice + 1}`,
    semana_inicio: anterior ? anterior.semana_fim + 1 : 1,
    semana_fim: anterior ? anterior.semana_fim + 4 : 4,
    objetivos: [novoObjetivo()],
    expanded: true,
  }
}

export function novoObjetivo(): ObjetivoComExercicios {
  return { texto: '', semana_inicio: null, semana_fim: null, exercicios: [] }
}

export function novoExercicio(): ExercicioFaseForm {
  return { exercicio_id: '', nota: '', semana_inicio: null, semana_fim: null }
}

export function flattenFases(fases: FaseForm[]) {
  return fases.map((f, i) => ({
    ordem: i + 1,
    nome: f.nome,
    semana_inicio: f.semana_inicio,
    semana_fim: f.semana_fim,
    objetivos: f.objetivos
      .filter(o => o.texto.trim())
      .map(({ texto, semana_inicio, semana_fim }) => ({ texto, semana_inicio, semana_fim })),
    exercicios: f.objetivos.flatMap((obj) =>
      obj.exercicios
        .filter(ex => ex.exercicio_id)
        .map((ex, idx) => ({
          exercicio_id: ex.exercicio_id,
          nota: ex.nota,
          ordem: idx,
          objetivo_texto: obj.texto,
          semana_inicio: ex.semana_inicio,
          semana_fim: ex.semana_fim,
        }))
    ),
  }))
}

// ── Popover genérico de cópia ─────────────────────────────────────────────────

interface CopyPopoverProps {
  label: string
  opcoes: { label: string; sub?: string; onClick: () => void }[]
  onClose: () => void
  anchorEl: HTMLElement | null
}

function CopyPopover({ label, opcoes, onClose, anchorEl }: CopyPopoverProps) {
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (anchorEl) {
      const r = anchorEl.getBoundingClientRect()
      setPos({ top: r.bottom + 4, left: r.left })
    }
    function handleClick(e: MouseEvent) {
      if (
        ref.current && !ref.current.contains(e.target as Node) &&
        anchorEl && !anchorEl.contains(e.target as Node)
      ) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [anchorEl, onClose])

  return (
    <div
      ref={ref}
      style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999 }}
      className="bg-white border border-gray-200 rounded-lg shadow-xl min-w-56 max-w-72 py-1"
    >
      <p className="px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wide border-b border-gray-100">
        {label}
      </p>
      {opcoes.length === 0 && (
        <p className="px-3 py-2 text-xs text-gray-400 italic">Sem destinos disponíveis.</p>
      )}
      {opcoes.map((op, i) => (
        <button key={i} type="button"
          onClick={() => { op.onClick(); onClose() }}
          className="w-full flex flex-col px-3 py-2 text-left hover:bg-blue-50 transition-colors"
        >
          <span className="text-sm text-gray-800">{op.label}</span>
          {op.sub && <span className="text-xs text-gray-400">{op.sub}</span>}
        </button>
      ))}
    </div>
  )
}

// ── ExercicioRow ──────────────────────────────────────────────────────────────

interface ExercicioRowProps {
  ex: ExercicioFaseForm
  faseInicio: number
  faseFim: number
  objInicio: number | null
  objFim: number | null
  exerciciosCatalogo: Exercicio[]
  loadingCatalogo: boolean
  onChange: (patch: Partial<ExercicioFaseForm>) => void
  onRemove: () => void
  onCopyClick: (el: HTMLElement) => void
  showingCopy: boolean
}

function ExercicioRow({ ex, faseInicio, faseFim, objInicio, objFim, exerciciosCatalogo, loadingCatalogo, onChange, onRemove, onCopyClick, showingCopy }: ExercicioRowProps) {
  const copyRef = useRef<HTMLButtonElement>(null)

  return (
    <div className="flex items-end gap-2 p-2.5 bg-white rounded-md border border-gray-200">
      <div className="flex-1 min-w-0">
        <label className="text-xs text-gray-500 block mb-1">Exercício / Terapia</label>
        <ExercicioCombobox
          exercicios={exerciciosCatalogo}
          value={ex.exercicio_id}
          onChange={id => onChange({ exercicio_id: id })}
          disabled={loadingCatalogo}
        />
      </div>

      <div className="w-32 shrink-0">
        <label className="text-xs text-gray-500 block mb-1">Parâmetro</label>
        <input
          type="text"
          placeholder="3×12…"
          value={ex.nota}
          onChange={e => onChange({ nota: e.target.value })}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="flex items-center gap-1 shrink-0 bg-gray-50 border border-gray-200 rounded-md px-2 py-1.5 mb-0.5">
        <span className="text-xs text-gray-400">Sem.</span>
        <input
          type="number" min={faseInicio} max={faseFim}
          placeholder={String(objInicio ?? faseInicio)}
          value={ex.semana_inicio ?? ''}
          onChange={e => onChange({ semana_inicio: e.target.value ? Number(e.target.value) : null })}
          className="w-9 text-xs text-center bg-transparent focus:outline-none"
        />
        <span className="text-xs text-gray-400">–</span>
        <input
          type="number" min={ex.semana_inicio ?? faseInicio} max={faseFim}
          placeholder={String(objFim ?? faseFim)}
          value={ex.semana_fim ?? ''}
          onChange={e => onChange({ semana_fim: e.target.value ? Number(e.target.value) : null })}
          className="w-9 text-xs text-center bg-transparent focus:outline-none"
        />
      </div>

      <button
        ref={copyRef}
        type="button"
        title="Copiar para outro objetivo"
        onClick={() => copyRef.current && onCopyClick(copyRef.current)}
        className={`p-1.5 mb-0.5 transition-colors shrink-0 ${showingCopy ? 'text-blue-600' : 'text-gray-400 hover:text-blue-600'}`}
      >
        <Copy size={14} />
      </button>

      <button type="button" onClick={onRemove}
        className="p-1.5 mb-0.5 text-gray-400 hover:text-red-500 transition-colors shrink-0">
        <X size={14} />
      </button>
    </div>
  )
}

// ── ObjetivoRow ───────────────────────────────────────────────────────────────

interface ObjetivoRowProps {
  obj: ObjetivoComExercicios
  fi: number
  oi: number
  fase: FaseForm
  exerciciosCatalogo: Exercicio[]
  loadingCatalogo: boolean
  canRemove: boolean
  onUpdate: (patch: Partial<ObjetivoComExercicios>) => void
  onRemove: () => void
  onCopyClick: (el: HTMLElement) => void
  showingCopy: boolean
  onAddExercicio: () => void
  onUpdateExercicio: (ei: number, patch: Partial<ExercicioFaseForm>) => void
  onRemoveExercicio: (ei: number) => void
  onCopyExercicioClick: (ei: number, el: HTMLElement) => void
  showingCopyEx: number | null
}

function ObjetivoRow({
  obj, fi, oi, fase, exerciciosCatalogo, loadingCatalogo,
  canRemove, onUpdate, onRemove, onCopyClick, showingCopy,
  onAddExercicio, onUpdateExercicio, onRemoveExercicio, onCopyExercicioClick, showingCopyEx,
}: ObjetivoRowProps) {
  const copyRef = useRef<HTMLButtonElement>(null)

  return (
    <div className="border border-blue-100 rounded-lg">
      {/* Header do objetivo */}
      <div className="flex items-start gap-2 px-3 py-3 bg-blue-50/60 rounded-t-lg">
        <GripVertical size={14} className="text-gray-300 mt-2.5 shrink-0" />

        <div className="flex-1 min-w-0">
          <input
            type="text"
            placeholder={`Objetivo ${oi + 1} — Ex: Redução dos sintomas`}
            value={obj.texto}
            onChange={e => onUpdate({ texto: e.target.value })}
            className="w-full px-3 py-2 text-sm font-medium border border-blue-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Semanas do objetivo */}
        <div className="flex items-center gap-1 shrink-0 bg-white border border-blue-200 rounded-md px-2 py-1.5">
          <span className="text-xs text-gray-400 whitespace-nowrap">Sem.</span>
          <input
            type="number" min={fase.semana_inicio} max={fase.semana_fim}
            placeholder={String(fase.semana_inicio)}
            value={obj.semana_inicio ?? ''}
            onChange={e => {
              const v = e.target.value ? Number(e.target.value) : null
              onUpdate({ semana_inicio: v, semana_fim: obj.semana_fim ?? (v !== null ? fase.semana_fim : null) })
            }}
            className="w-10 text-xs text-center bg-transparent focus:outline-none"
          />
          <span className="text-xs text-gray-400">–</span>
          <input
            type="number" min={obj.semana_inicio ?? fase.semana_inicio} max={fase.semana_fim}
            placeholder={String(fase.semana_fim)}
            value={obj.semana_fim ?? ''}
            onChange={e => {
              const v = e.target.value ? Number(e.target.value) : null
              onUpdate({ semana_fim: v, semana_inicio: obj.semana_inicio ?? (v !== null ? fase.semana_inicio : null) })
            }}
            className="w-10 text-xs text-center bg-transparent focus:outline-none"
          />
        </div>

        {/* Copiar objetivo */}
        <button
          ref={copyRef}
          type="button"
          title="Copiar objetivo para outra fase"
          onClick={() => copyRef.current && onCopyClick(copyRef.current)}
          className={`p-1.5 mt-0.5 transition-colors shrink-0 ${showingCopy ? 'text-blue-600' : 'text-gray-400 hover:text-blue-600'}`}
        >
          <Copy size={14} />
        </button>

        {canRemove && (
          <button type="button" onClick={onRemove}
            className="p-1.5 mt-0.5 text-gray-300 hover:text-red-500 transition-colors shrink-0">
            <X size={14} />
          </button>
        )}
      </div>

      {/* Exercícios do objetivo */}
      <div className="px-3 py-3 space-y-2">
        {obj.exercicios.length === 0 && (
          <p className="text-xs text-gray-400 italic pl-1">Nenhum exercício ou terapia adicionado.</p>
        )}

        {obj.exercicios.map((ex, ei) => (
          <ExercicioRow
            key={ei}
            ex={ex}
            faseInicio={fase.semana_inicio}
            faseFim={fase.semana_fim}
            objInicio={obj.semana_inicio}
            objFim={obj.semana_fim}
            exerciciosCatalogo={exerciciosCatalogo}
            loadingCatalogo={loadingCatalogo}
            onChange={patch => onUpdateExercicio(ei, patch)}
            onRemove={() => onRemoveExercicio(ei)}
            onCopyClick={el => onCopyExercicioClick(ei, el)}
            showingCopy={showingCopyEx === ei}
          />
        ))}

        <button
          type="button"
          onClick={onAddExercicio}
          className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium mt-1 pl-1"
        >
          <Plus size={12} /> Adicionar exercício ou terapia
        </button>
      </div>
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────

type PopoverState =
  | { tipo: 'objetivo'; fi: number; oi: number; el: HTMLElement }
  | { tipo: 'exercicio'; fi: number; oi: number; ei: number; el: HTMLElement }

interface Props {
  fases: FaseForm[]
  onChange: (fases: FaseForm[]) => void
  exerciciosCatalogo: Exercicio[]
  loadingCatalogo: boolean
}

export function FaseEditorProtocolo({ fases, onChange, exerciciosCatalogo, loadingCatalogo }: Props) {
  const [popover, setPopover] = useState<PopoverState | null>(null)

  const setFases = useCallback((fn: (prev: FaseForm[]) => FaseForm[]) => {
    onChange(fn(fases))
  }, [fases, onChange])

  function updateFase(fi: number, patch: Partial<FaseForm>) {
    setFases(prev => prev.map((f, i) => i === fi ? { ...f, ...patch } : f))
  }

  function duplicarFase(fi: number) {
    setFases(prev => {
      const clone: FaseForm = JSON.parse(JSON.stringify(prev[fi]))
      clone.nome = clone.nome + ' (cópia)'
      const next = [...prev]
      next.splice(fi + 1, 0, clone)
      return next
    })
  }

  function updateObjetivo(fi: number, oi: number, patch: Partial<ObjetivoComExercicios>) {
    setFases(prev => prev.map((f, i) => i !== fi ? f : {
      ...f,
      objetivos: f.objetivos.map((o, j) => j === oi ? { ...o, ...patch } : o),
    }))
  }

  function copiarObjetivoParaFase(fi: number, oi: number, destFi: number) {
    setFases(prev => {
      const clone: ObjetivoComExercicios = JSON.parse(JSON.stringify(prev[fi].objetivos[oi]))
      return prev.map((f, i) => i !== destFi ? f : { ...f, objetivos: [...f.objetivos, clone] })
    })
  }

  function updateExercicio(fi: number, oi: number, ei: number, patch: Partial<ExercicioFaseForm>) {
    setFases(prev => prev.map((f, i) => i !== fi ? f : {
      ...f,
      objetivos: f.objetivos.map((o, j) => j !== oi ? o : {
        ...o,
        exercicios: o.exercicios.map((e, k) => k !== ei ? e : { ...e, ...patch }),
      }),
    }))
  }

  function copiarExercicioParaObjetivo(fi: number, oi: number, ei: number, destFi: number, destOi: number) {
    setFases(prev => {
      const clone: ExercicioFaseForm = JSON.parse(JSON.stringify(prev[fi].objetivos[oi].exercicios[ei]))
      return prev.map((f, i) => i !== destFi ? f : {
        ...f,
        objetivos: f.objetivos.map((o, j) => j !== destOi ? o : {
          ...o, exercicios: [...o.exercicios, clone],
        }),
      })
    })
  }

  const closePopover = useCallback(() => setPopover(null), [])

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900">Fases do protocolo</h3>
        <Button type="button" variant="secondary" size="sm"
          onClick={() => setFases(prev => [...prev, novaFase(prev[prev.length - 1], prev.length)])}>
          <Plus size={14} /> Adicionar fase
        </Button>
      </div>

      <div className="space-y-3">
        {fases.map((fase, fi) => (
          <div key={fi} className="border border-gray-200 rounded-lg">
            {/* Header da fase */}
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
                <button type="button" title="Duplicar fase"
                  onClick={() => duplicarFase(fi)}
                  className="p-1.5 text-gray-400 hover:text-blue-600 transition-colors">
                  <Copy size={14} />
                </button>
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
              <div className="px-4 py-4 space-y-3">
                {/* Nome e semanas */}
                <div className="grid grid-cols-3 gap-3">
                  <Input label="Nome da fase" value={fase.nome}
                    onChange={e => updateFase(fi, { nome: e.target.value })} />
                  <Input label="Semana início" type="number" min={1} value={fase.semana_inicio}
                    onChange={e => updateFase(fi, { semana_inicio: Number(e.target.value) })} />
                  <Input label="Semana fim" type="number" min={fase.semana_inicio} value={fase.semana_fim}
                    onChange={e => updateFase(fi, { semana_fim: Number(e.target.value) })} />
                </div>

                {/* Objetivos */}
                <div className="space-y-3">
                  {fase.objetivos.map((obj, oi) => (
                    <ObjetivoRow
                      key={oi}
                      obj={obj} fi={fi} oi={oi} fase={fase}
                      exerciciosCatalogo={exerciciosCatalogo}
                      loadingCatalogo={loadingCatalogo}
                      canRemove={fase.objetivos.length > 1}
                      onUpdate={patch => updateObjetivo(fi, oi, patch)}
                      onRemove={() => setFases(prev => prev.map((f, i) => i !== fi ? f : {
                        ...f, objetivos: f.objetivos.filter((_, j) => j !== oi),
                      }))}
                      onCopyClick={el => setPopover({ tipo: 'objetivo', fi, oi, el })}
                      showingCopy={popover?.tipo === 'objetivo' && popover.fi === fi && popover.oi === oi}
                      onAddExercicio={() => setFases(prev => prev.map((f, i) => i !== fi ? f : {
                        ...f,
                        objetivos: f.objetivos.map((o, j) => j !== oi ? o : {
                          ...o, exercicios: [...o.exercicios, novoExercicio()],
                        }),
                      }))}
                      onUpdateExercicio={(ei, patch) => updateExercicio(fi, oi, ei, patch)}
                      onRemoveExercicio={ei => setFases(prev => prev.map((f, i) => i !== fi ? f : {
                        ...f,
                        objetivos: f.objetivos.map((o, j) => j !== oi ? o : {
                          ...o, exercicios: o.exercicios.filter((_, k) => k !== ei),
                        }),
                      }))}
                      onCopyExercicioClick={(ei, el) => setPopover({ tipo: 'exercicio', fi, oi, ei, el })}
                      showingCopyEx={
                        popover?.tipo === 'exercicio' && popover.fi === fi && popover.oi === oi
                          ? popover.ei
                          : null
                      }
                    />
                  ))}
                </div>

                <button type="button"
                  onClick={() => setFases(prev => prev.map((f, i) => i !== fi ? f : {
                    ...f, objetivos: [...f.objetivos, novoObjetivo()],
                  }))}
                  className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium">
                  <Plus size={12} /> Adicionar objetivo
                </button>

                <p className="text-xs text-gray-400">
                  Deixe as semanas do objetivo em branco para que valha por toda a fase.
                </p>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Popover: copiar objetivo */}
      {popover?.tipo === 'objetivo' && (
        <CopyPopover
          label="Copiar objetivo para…"
          anchorEl={popover.el}
          onClose={closePopover}
          opcoes={fases
            .map((f, i) => ({ fi: i, label: f.nome || `Fase ${i + 1}`, sub: `Sem. ${f.semana_inicio}–${f.semana_fim}` }))
            .filter(o => o.fi !== popover.fi)
            .map(o => ({ label: o.label, sub: o.sub, onClick: () => copiarObjetivoParaFase(popover.fi, popover.oi, o.fi) }))
          }
        />
      )}

      {/* Popover: copiar exercício */}
      {popover?.tipo === 'exercicio' && (() => {
        const { fi, oi, ei } = popover
        const opcoes: { label: string; sub: string; onClick: () => void }[] = []
        fases.forEach((f, destFi) => {
          f.objetivos.forEach((o, destOi) => {
            if (destFi === fi && destOi === oi) return
            if (!o.texto.trim()) return
            opcoes.push({
              label: o.texto,
              sub: `${f.nome || `Fase ${destFi + 1}`} · Sem. ${o.semana_inicio ?? f.semana_inicio}–${o.semana_fim ?? f.semana_fim}`,
              onClick: () => copiarExercicioParaObjetivo(fi, oi, ei, destFi, destOi),
            })
          })
        })
        return (
          <CopyPopover
            label="Copiar exercício para…"
            anchorEl={popover.el}
            onClose={closePopover}
            opcoes={opcoes}
          />
        )
      })()}
    </div>
  )
}
