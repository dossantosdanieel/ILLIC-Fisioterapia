import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Plus, Trash2, Star } from 'lucide-react'
import { listarMedidas, buscarPlanoCompleto } from '@/features/planos/api'
import { registrarAvaliacao } from '../api'
import { calcularSemanaAtual } from '@/features/planos/utils'
import { useAuth } from '@/lib/AuthContext'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardBody, CardTitle } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import type { FaseCompleta } from '@/types/queries'

const TIPOS = [
  { value: 'inicial', label: 'Avaliação inicial' },
  { value: 'reavaliacao', label: 'Reavaliação' },
]

interface CampoAdicional { nome: string; valor: string; unidade: string }

interface Props { pacienteId: string }

export function FormAvaliacao({ pacienteId }: Props) {
  const { profissional } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const planoId = searchParams.get('plano')

  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [tipo, setTipo] = useState<'inicial' | 'reavaliacao'>('reavaliacao')
  const [data, setData] = useState(new Date().toISOString().split('T')[0])
  const [observacoes, setObservacoes] = useState('')
  const [valores, setValores] = useState<Record<string, string>>({})
  const [camposAdicionais, setCamposAdicionais] = useState<CampoAdicional[]>([])

  const { data: medidas, isLoading: loadingMedidas } = useQuery({
    queryKey: ['medidas'],
    queryFn: listarMedidas,
  })

  const { data: plano } = useQuery({
    queryKey: ['plano', planoId],
    queryFn: () => buscarPlanoCompleto(planoId!),
    enabled: !!planoId,
  })

  // Fase atual do plano (para destacar critérios)
  const semanaAtual = plano ? calcularSemanaAtual(plano.data_av_inicial) : null
  const faseAtual = semanaAtual
    ? (plano?.fase as FaseCompleta[] | undefined)?.find(
        f => semanaAtual >= f.semana_inicio && semanaAtual <= f.semana_fim,
      )
    : undefined

  // IDs das medidas que são critérios da fase atual
  const criteriosMedidaIds = new Set(
    (faseAtual?.criterio_fase ?? []).map(c => c.medida_id),
  )

  if (loadingMedidas) return <Spinner />

  // Agrupar medidas: primeiro os critérios da fase, depois por unidade
  const criteriosMedidas = (medidas ?? []).filter(m => criteriosMedidaIds.has(m.id))
  const grupos: Record<string, typeof medidas> = {}
  for (const m of medidas ?? []) {
    if (criteriosMedidaIds.has(m.id)) continue // já aparece no topo
    const u = m.unidade
    if (!grupos[u]) grupos[u] = []
    grupos[u]!.push(m)
  }

  const labelGrupo: Record<string, string> = {
    eva: 'Dor (EVA)', graus: 'Amplitude de movimento (graus)',
    kgf: 'Força (kgf — dinamômetro)', percent: 'Funcional (%)',
    seg: 'Tempo (segundos)', passfail: 'Testes clínicos (pass/fail)',
  }

  function setValor(medidaId: string, valor: string) {
    setValores(v => ({ ...v, [medidaId]: valor }))
  }

  function addCampoAdicional() {
    setCamposAdicionais(prev => [...prev, { nome: '', valor: '', unidade: '' }])
  }

  function updateCampoAdicional(idx: number, patch: Partial<CampoAdicional>) {
    setCamposAdicionais(prev => prev.map((c, i) => i === idx ? { ...c, ...patch } : c))
  }

  function removeCampoAdicional(idx: number) {
    setCamposAdicionais(prev => prev.filter((_, i) => i !== idx))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!profissional) return
    setErro(null)
    setLoading(true)

    try {
      const valoresLista = Object.entries(valores)
        .filter(([, v]) => v !== '' && v !== undefined)
        .map(([medida_id, v]) => ({ medida_id, valor: parseFloat(v) }))

      const camposValidos = camposAdicionais.filter(c => c.nome.trim() && c.valor.trim())

      if (valoresLista.length === 0 && camposValidos.length === 0) {
        setErro('Insira pelo menos um valor de medida ou campo adicional.')
        setLoading(false)
        return
      }

      const av = await registrarAvaliacao({
        avaliacao: {
          paciente_id: pacienteId,
          profissional_id: profissional.id,
          plano_id: planoId ?? null,
          tipo,
          data,
          numero_reav: tipo === 'reavaliacao' ? 1 : null,
          observacoes: observacoes.trim() || null,
          campos_adicionais: camposValidos,
        },
        valores: valoresLista,
      })

      navigate(`/pacientes/${pacienteId}/avaliacoes/${av.id}${planoId ? `?plano=${planoId}` : ''}`)
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao registrar avaliação')
    } finally {
      setLoading(false)
    }
  }

  const MedidaInput = ({ m }: { m: NonNullable<typeof medidas>[0]; isCriterio?: boolean }) => {
    const isPassFail = m.unidade === 'passfail'
    return (
      <div>
        <label className="text-xs font-medium text-gray-700 block mb-1">
          {m.nome}
          <span className="ml-1 text-gray-400 font-normal">
            ({m.direcao_melhora === 'maior' ? '↑ maior = melhor' : '↓ menor = melhor'})
          </span>
        </label>
        {isPassFail ? (
          <select
            value={valores[m.id] ?? ''}
            onChange={e => setValor(m.id, e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">—</option>
            <option value="0">Negativo</option>
            <option value="1">Positivo</option>
          </select>
        ) : (
          <Input
            type="number"
            step="0.1"
            min={0}
            placeholder="—"
            value={valores[m.id] ?? ''}
            onChange={e => setValor(m.id, e.target.value)}
          />
        )}
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-2xl">
      {/* Tipo e data */}
      <div className="grid grid-cols-2 gap-4">
        <Select
          label="Tipo *"
          options={TIPOS}
          value={tipo}
          onChange={e => setTipo(e.target.value as 'inicial' | 'reavaliacao')}
        />
        <Input
          label="Data *"
          type="date"
          required
          value={data}
          onChange={e => setData(e.target.value)}
        />
      </div>

      {/* Critérios da fase atual — destaque */}
      {criteriosMedidas.length > 0 && (
        <Card className="border-blue-200 bg-blue-50/30">
          <CardHeader className="border-blue-200">
            <div className="flex items-center gap-2">
              <Star size={14} className="text-blue-500" />
              <CardTitle className="text-blue-800">
                Critérios da {faseAtual?.nome ?? 'fase atual'}
              </CardTitle>
              <span className="text-xs text-blue-500 ml-1">— preencha para análise automática</span>
            </div>
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-2 gap-3">
              {criteriosMedidas.map(m => (
                <div key={m.id} className="relative">
                  <MedidaInput m={m} isCriterio />
                  {/* Mini-badge com a meta */}
                  {faseAtual?.criterio_fase.filter(c => c.medida_id === m.id).map(c => (
                    <span key={c.id} className="absolute -top-1 right-0 text-xs text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded">
                      meta: {c.operador} {c.valor_alvo}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      {/* Demais medidas por grupo */}
      {Object.entries(grupos).map(([unidade, ms]) => {
        if (!ms?.length) return null
        return (
          <Card key={unidade}>
            <CardHeader>
              <CardTitle>{labelGrupo[unidade] ?? unidade}</CardTitle>
            </CardHeader>
            <CardBody>
              <div className="grid grid-cols-2 gap-3">
                {ms.map(m => <MedidaInput key={m.id} m={m} />)}
              </div>
            </CardBody>
          </Card>
        )
      })}

      {/* Campos adicionais livres */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Campos adicionais</CardTitle>
            <button
              type="button"
              onClick={addCampoAdicional}
              className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors"
            >
              <Plus size={13} /> Adicionar campo
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            Use para qualquer medida não listada acima — escalas específicas, achados clínicos, testes especiais, etc.
          </p>
        </CardHeader>
        {camposAdicionais.length > 0 && (
          <CardBody>
            <div className="space-y-2">
              {camposAdicionais.map((c, i) => (
                <div key={i} className="flex items-end gap-2 p-2 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <label className="text-xs text-gray-500 block mb-1">Nome do campo</label>
                    <input
                      type="text"
                      placeholder="Ex: Escala ASES, Teste de Jobe, Apley…"
                      value={c.nome}
                      onChange={e => updateCampoAdicional(i, { nome: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="w-28">
                    <label className="text-xs text-gray-500 block mb-1">Valor / Resultado</label>
                    <input
                      type="text"
                      placeholder="Ex: 72, Positivo…"
                      value={c.valor}
                      onChange={e => updateCampoAdicional(i, { valor: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="w-24">
                    <label className="text-xs text-gray-500 block mb-1">Unidade</label>
                    <input
                      type="text"
                      placeholder="pontos, %, —"
                      value={c.unidade}
                      onChange={e => updateCampoAdicional(i, { unidade: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeCampoAdicional(i)}
                    className="shrink-0 p-2 text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </CardBody>
        )}
        {camposAdicionais.length === 0 && (
          <CardBody>
            <p className="text-xs text-gray-400 italic text-center py-2">
              Nenhum campo adicional. Clique em "+ Adicionar campo" para incluir.
            </p>
          </CardBody>
        )}
      </Card>

      {/* Observações gerais */}
      <Card>
        <CardBody>
          <label className="text-sm font-medium text-gray-700 block mb-1.5">
            Observações gerais da avaliação
          </label>
          <textarea
            value={observacoes}
            onChange={e => setObservacoes(e.target.value)}
            placeholder="Achados clínicos relevantes, contexto, intercorrências…"
            rows={3}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
          />
        </CardBody>
      </Card>

      {erro && (
        <div className="px-3 py-2.5 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-700">{erro}</p>
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <Button type="submit" loading={loading}>Registrar avaliação</Button>
        <Button type="button" variant="secondary" onClick={() => navigate(`/pacientes/${pacienteId}`)}>
          Cancelar
        </Button>
      </div>
    </form>
  )
}
