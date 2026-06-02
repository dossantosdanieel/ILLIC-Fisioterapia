import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { listarMedidas } from '@/features/planos/api'
import { registrarAvaliacao } from '../api'
import { useAuth } from '@/lib/AuthContext'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardBody, CardTitle } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'

const TIPOS = [
  { value: 'inicial', label: 'Avaliação inicial' },
  { value: 'reavaliacao', label: 'Reavaliação' },
]

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
  const [valores, setValores] = useState<Record<string, string>>({})

  const { data: medidas, isLoading } = useQuery({
    queryKey: ['medidas'],
    queryFn: listarMedidas,
  })

  if (isLoading) return <Spinner />

  // Agrupar medidas por categoria de unidade
  const grupos = {
    'Dor': medidas?.filter(m => m.unidade === 'eva') ?? [],
    'Amplitude (graus)': medidas?.filter(m => m.unidade === 'graus') ?? [],
    'Força (kgf)': medidas?.filter(m => m.unidade === 'kgf') ?? [],
    'Funcional (%)': medidas?.filter(m => m.unidade === 'percent') ?? [],
    'Tempo (seg)': medidas?.filter(m => m.unidade === 'seg') ?? [],
    'Testes (pass/fail)': medidas?.filter(m => m.unidade === 'passfail') ?? [],
  }

  function setValor(medidaId: string, valor: string) {
    setValores(v => ({ ...v, [medidaId]: valor }))
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

      if (valoresLista.length === 0) {
        setErro('Insira pelo menos um valor de medida.')
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
        },
        valores: valoresLista,
      })

      navigate(`/pacientes/${pacienteId}/avaliacoes/${av.id}`)
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao registrar avaliação')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-2xl">
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

      {Object.entries(grupos).map(([grupo, medidasGrupo]) => {
        if (!medidasGrupo.length) return null
        return (
          <Card key={grupo}>
            <CardHeader>
              <CardTitle>{grupo}</CardTitle>
            </CardHeader>
            <CardBody>
              <div className="grid grid-cols-2 gap-3">
                {medidasGrupo.map(m => {
                  const isPassFail = m.unidade === 'passfail'
                  return (
                    <div key={m.id}>
                      <label className="text-xs font-medium text-gray-600 block mb-1">
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
                })}
              </div>
            </CardBody>
          </Card>
        )
      })}

      {erro && <p className="text-sm text-red-600">{erro}</p>}

      <div className="flex gap-3 pt-2">
        <Button type="submit" loading={loading}>Registrar avaliação</Button>
        <Button type="button" variant="secondary" onClick={() => navigate(`/pacientes/${pacienteId}`)}>
          Cancelar
        </Button>
      </div>
    </form>
  )
}
