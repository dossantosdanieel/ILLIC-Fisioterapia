import { useState, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2 } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  atualizarFase, criarCriterio, atualizarCriterio, removerCriterio, listarMedidas,
} from '../api'
import { useQuery } from '@tanstack/react-query'
import type { FaseCompleta } from '@/types/queries'
import type { OperadorCriterio } from '@/types/database'

const OPERADORES: { value: OperadorCriterio; label: string }[] = [
  { value: '>=', label: '>= (maior ou igual)' },
  { value: '<=', label: '<= (menor ou igual)' },
  { value: '=', label: '= (igual)' },
]

interface Props {
  open: boolean
  onClose: () => void
  fase: FaseCompleta
  planoId: string
}

interface CriterioLocal {
  id: string | null      // null = novo (ainda não salvo)
  medida_id: string
  operador: OperadorCriterio
  valor_alvo: number
  _salvando?: boolean
  _removendo?: boolean
}

export function EditarFaseModal({ open, onClose, fase, planoId }: Props) {
  const qc = useQueryClient()

  // Campos básicos
  const [nome, setNome] = useState(fase.nome)
  const [semIni, setSemIni] = useState(fase.semana_inicio)
  const [semFim, setSemFim] = useState(fase.semana_fim)
  const [salvandoBase, setSalvandoBase] = useState(false)
  const [erroBase, setErroBase] = useState<string | null>(null)

  // Critérios locais (cópia mutável)
  const [criterios, setCriterios] = useState<CriterioLocal[]>(() =>
    (fase.criterio_fase ?? []).map(c => ({
      id: c.id,
      medida_id: c.medida_id,
      operador: c.operador,
      valor_alvo: c.valor_alvo,
    })),
  )

  // Sincroniza quando a fase muda externamente
  useEffect(() => {
    setNome(fase.nome)
    setSemIni(fase.semana_inicio)
    setSemFim(fase.semana_fim)
    setCriterios(
      (fase.criterio_fase ?? []).map(c => ({
        id: c.id, medida_id: c.medida_id,
        operador: c.operador, valor_alvo: c.valor_alvo,
      })),
    )
  }, [fase])

  const { data: medidas } = useQuery({
    queryKey: ['medidas'],
    queryFn: listarMedidas,
    enabled: open,
  })
  const medidasOpts = (medidas ?? []).map(m => ({
    value: m.id,
    label: `${m.nome} (${m.unidade})`,
  }))

  function invalidar() {
    qc.invalidateQueries({ queryKey: ['plano', planoId] })
  }

  // ── Salvar campos básicos ────────────────────────────────
  async function handleSalvarBase() {
    if (!nome.trim()) { setErroBase('Nome obrigatório.'); return }
    if (semFim < semIni) { setErroBase('Semana fim deve ser ≥ semana início.'); return }
    setErroBase(null)
    setSalvandoBase(true)
    try {
      await atualizarFase(fase.id, { nome: nome.trim(), semana_inicio: semIni, semana_fim: semFim })
      invalidar()
    } catch { setErroBase('Erro ao salvar.') }
    finally { setSalvandoBase(false) }
  }

  // ── Critérios ────────────────────────────────────────────

  function updateCriterioLocal(idx: number, patch: Partial<CriterioLocal>) {
    setCriterios(prev => prev.map((c, i) => i === idx ? { ...c, ...patch } : c))
  }

  function addCriterioLocal() {
    setCriterios(prev => [...prev, {
      id: null,
      medida_id: medidas?.[0]?.id ?? '',
      operador: '>=',
      valor_alvo: 0,
    }])
  }

  async function salvarCriterio(idx: number) {
    const c = criterios[idx]
    if (!c.medida_id) return
    updateCriterioLocal(idx, { _salvando: true })
    try {
      if (c.id) {
        await atualizarCriterio(c.id, { medida_id: c.medida_id, operador: c.operador, valor_alvo: c.valor_alvo })
      } else {
        const novo = await criarCriterio(fase.id, { medida_id: c.medida_id, operador: c.operador, valor_alvo: c.valor_alvo })
        updateCriterioLocal(idx, { id: novo.id })
      }
      invalidar()
    } finally {
      updateCriterioLocal(idx, { _salvando: false })
    }
  }

  async function remover(idx: number) {
    const c = criterios[idx]
    if (!c.id) { setCriterios(prev => prev.filter((_, i) => i !== idx)); return }
    updateCriterioLocal(idx, { _removendo: true })
    try {
      await removerCriterio(c.id)
      setCriterios(prev => prev.filter((_, i) => i !== idx))
      invalidar()
    } finally {
      updateCriterioLocal(idx, { _removendo: false })
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={`Editar fase: ${fase.nome}`} size="lg">
      <div className="space-y-6">

        {/* ── Dados básicos ─────────────────────────────────── */}
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Dados da fase
          </h3>
          <div className="space-y-3">
            <Input
              label="Nome da fase"
              value={nome}
              onChange={e => setNome(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Semana início"
                type="number"
                min={1}
                value={semIni}
                onChange={e => setSemIni(Number(e.target.value))}
              />
              <Input
                label="Semana fim"
                type="number"
                min={semIni}
                value={semFim}
                onChange={e => setSemFim(Number(e.target.value))}
              />
            </div>

            {erroBase && (
              <p className="text-xs text-red-600 bg-red-50 px-3 py-1.5 rounded-md">{erroBase}</p>
            )}

            <div className="flex justify-end">
              <Button size="sm" onClick={handleSalvarBase} loading={salvandoBase}>
                Salvar dados da fase
              </Button>
            </div>
          </div>
        </div>

        {/* Separador */}
        <div className="border-t border-gray-200" />

        {/* ── Critérios de avanço ───────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Critérios para avançar a fase
            </h3>
            <button
              onClick={addCriterioLocal}
              disabled={!medidas?.length}
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium disabled:opacity-40"
            >
              <Plus size={13} /> Adicionar critério
            </button>
          </div>

          {criterios.length === 0 && (
            <p className="text-xs text-gray-400 italic py-2">
              Sem critérios — transição de fase será manual pelo coordenador.
            </p>
          )}

          <div className="space-y-2">
            {criterios.map((c, idx) => (
              <div key={idx} className="flex items-end gap-2 p-3 bg-gray-50 rounded-lg">
                {/* Medida */}
                <div className="flex-1 min-w-0">
                  <label className="text-xs text-gray-500 block mb-1">Medida</label>
                  <select
                    value={c.medida_id}
                    onChange={e => updateCriterioLocal(idx, { medida_id: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">— selecione —</option>
                    {medidasOpts.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>

                {/* Operador */}
                <div className="w-38 shrink-0">
                  <label className="text-xs text-gray-500 block mb-1">Condição</label>
                  <select
                    value={c.operador}
                    onChange={e => updateCriterioLocal(idx, { operador: e.target.value as OperadorCriterio })}
                    className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {OPERADORES.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>

                {/* Valor meta */}
                <div className="w-24 shrink-0">
                  <label className="text-xs text-gray-500 block mb-1">Meta</label>
                  <input
                    type="number"
                    step="0.1"
                    value={c.valor_alvo}
                    onChange={e => updateCriterioLocal(idx, { valor_alvo: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Ações */}
                <div className="flex items-center gap-1 shrink-0 pb-0.5">
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={c._salvando}
                    disabled={!c.medida_id || c._removendo}
                    onClick={() => salvarCriterio(idx)}
                  >
                    {c.id ? 'Salvar' : 'Adicionar'}
                  </Button>
                  <button
                    onClick={() => remover(idx)}
                    disabled={c._removendo || c._salvando}
                    className="p-1.5 text-gray-400 hover:text-red-500 transition-colors disabled:opacity-40"
                    title="Remover critério"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {criterios.some(c => !c.id) && (
            <p className="text-xs text-amber-600 mt-2">
              Critérios novos precisam ser salvos individualmente com o botão "Adicionar".
            </p>
          )}
        </div>

        {/* Rodapé */}
        <div className="flex justify-end border-t border-gray-200 pt-4">
          <Button variant="secondary" onClick={onClose}>Fechar</Button>
        </div>
      </div>
    </Modal>
  )
}
