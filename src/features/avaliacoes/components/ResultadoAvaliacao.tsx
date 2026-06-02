import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, XCircle, MinusCircle, TrendingUp, TrendingDown } from 'lucide-react'
import { buscarAvaliacao, avaliarCriterios } from '../api'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardBody, CardTitle } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { formatarData } from '@/features/planos/utils'
import type { ValorMedidaComMedida } from '@/types/queries'

interface Props { avaliacaoId: string; planoId?: string }

export function ResultadoAvaliacao({ avaliacaoId, planoId }: Props) {
  const { data: avaliacao, isLoading } = useQuery({
    queryKey: ['avaliacao', avaliacaoId],
    queryFn: () => buscarAvaliacao(avaliacaoId),
  })

  const { data: resultados, isLoading: loadingResultados } = useQuery({
    queryKey: ['criterios', planoId, avaliacaoId],
    queryFn: () => avaliarCriterios(planoId!, avaliacaoId),
    enabled: !!planoId,
  })

  if (isLoading) return <Spinner />
  if (!avaliacao) return null

  const valores: ValorMedidaComMedida[] = (avaliacao.valor_medida ?? []) as ValorMedidaComMedida[]

  // Agrupar por unidade
  const grupos: Record<string, ValorMedidaComMedida[]> = {}
  for (const v of valores) {
    const u = v.medida?.unidade ?? 'outros'
    if (!grupos[u]) grupos[u] = []
    grupos[u].push(v)
  }

  const labelGrupo: Record<string, string> = {
    eva: 'Dor (EVA)',
    graus: 'Amplitude (graus)',
    kgf: 'Força (kgf)',
    percent: 'Funcional (%)',
    seg: 'Tempo (seg)',
    passfail: 'Testes clínicos',
  }

  const profissional = avaliacao.profissional as { nome: string } | null

  return (
    <div className="space-y-5">
      {/* Cabeçalho */}
      <div className="flex items-center gap-3">
        <Badge variant={avaliacao.tipo === 'inicial' ? 'info' : 'default'}>
          {avaliacao.tipo === 'inicial' ? 'Avaliação inicial' : 'Reavaliação'}
        </Badge>
        <span className="text-sm text-gray-500">
          {formatarData(avaliacao.data)} · {profissional?.nome}
        </span>
      </div>

      {/* Valores registrados */}
      {Object.entries(grupos).map(([unidade, vals]) => (
        <Card key={unidade}>
          <CardHeader><CardTitle>{labelGrupo[unidade] ?? unidade}</CardTitle></CardHeader>
          <CardBody>
            <div className="grid grid-cols-2 gap-2">
              {vals.map(v => {
                const isPassFail = v.medida?.unidade === 'passfail'
                return (
                  <div key={v.id} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                    <span className="text-xs text-gray-600">{v.medida?.nome}</span>
                    <div className="flex items-center gap-1.5">
                      {v.medida?.direcao_melhora === 'maior'
                        ? <TrendingUp size={12} className="text-gray-300" />
                        : <TrendingDown size={12} className="text-gray-300" />
                      }
                      <span className="text-sm font-semibold text-gray-900">
                        {isPassFail ? (v.valor === 1 ? 'Positivo' : 'Negativo') : v.valor}
                        {!isPassFail && <span className="text-xs font-normal text-gray-400 ml-1">{v.medida?.unidade}</span>}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardBody>
        </Card>
      ))}

      {/* Motor de critérios */}
      {planoId && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Análise de critérios por fase</CardTitle>
              {loadingResultados && <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />}
            </div>
          </CardHeader>
          <CardBody className="space-y-5">
            {(resultados ?? []).filter(f => f.criterios.length > 0).map(fase => (
              <div key={fase.fase_id}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-semibold text-gray-700">{fase.fase_nome}</span>
                  {fase.todos_atingidos === true && <Badge variant="success">✓ Todos atingidos</Badge>}
                  {fase.todos_atingidos === false && <Badge variant="danger">Critérios pendentes</Badge>}
                  {fase.todos_atingidos === null && <Badge variant="muted">Dados insuficientes</Badge>}
                </div>

                <div className="space-y-1.5">
                  {fase.criterios.map(c => (
                    <div
                      key={c.criterio_id}
                      className={`flex items-center gap-3 px-3 py-2 rounded-md text-xs ${
                        c.atingido === true ? 'bg-green-50'
                        : c.atingido === false ? 'bg-red-50'
                        : 'bg-gray-50'
                      }`}
                    >
                      {c.atingido === true
                        ? <CheckCircle2 size={14} className="text-green-500 shrink-0" />
                        : c.atingido === false
                        ? <XCircle size={14} className="text-red-500 shrink-0" />
                        : <MinusCircle size={14} className="text-gray-300 shrink-0" />
                      }
                      <span className="flex-1 text-gray-700">{c.medida_nome}</span>
                      <span className="font-mono text-gray-500">
                        meta: {c.operador} {c.valor_alvo} {c.medida_unidade}
                      </span>
                      {c.valor_obtido !== null ? (
                        <span className={`font-semibold ${c.atingido ? 'text-green-700' : 'text-red-700'}`}>
                          obtido: {c.valor_obtido}
                        </span>
                      ) : (
                        <span className="text-gray-400 italic">sem dado</span>
                      )}
                      {c.delta !== null && (
                        <span className={`font-mono ${c.delta >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          ({c.delta >= 0 ? '+' : ''}{c.delta.toFixed(1)})
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </CardBody>
        </Card>
      )}
    </div>
  )
}
