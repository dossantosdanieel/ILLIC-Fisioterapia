import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { CheckCircle2, Circle, Clock, AlertTriangle, ChevronRight } from 'lucide-react'
import { buscarPlanoCompleto } from '../api'
import { calcularSemanaAtual, calcularMicrocicloAtual, dataReavaliacao, formatarData, formatarDataCurta } from '../utils'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardBody, CardTitle } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import type { FaseCompleta } from '@/types/queries'

interface Props { planoId: string; pacienteId: string }

export function PainelPlano({ planoId, pacienteId }: Props) {
  const { data: plano, isLoading } = useQuery({
    queryKey: ['plano', planoId],
    queryFn: () => buscarPlanoCompleto(planoId),
  })

  if (isLoading) return <Spinner />
  if (!plano) return null

  const semanaAtual = calcularSemanaAtual(plano.data_av_inicial)
  const microcicloAtual = calcularMicrocicloAtual(semanaAtual)
  const vencido = semanaAtual > plano.prognostico_semanas
  const progresso = Math.min(100, Math.round((semanaAtual / plano.prognostico_semanas) * 100))

  const fases: FaseCompleta[] = [...(plano.fase ?? [])].sort((a, b) => a.ordem - b.ordem)
  const faseAtual = fases.find(f => semanaAtual >= f.semana_inicio && semanaAtual <= f.semana_fim)

  return (
    <div className="space-y-4">
      {/* Cabeçalho do plano */}
      <Card>
        <CardBody className="flex items-center justify-between gap-6">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-semibold text-gray-900">Plano ativo</span>
              {vencido
                ? <Badge variant="danger"><AlertTriangle size={10} className="mr-1" />Vencido</Badge>
                : <Badge variant="success">No prazo</Badge>
              }
            </div>
            <p className="text-xs text-gray-500">
              Início: {formatarData(plano.data_av_inicial)} · {plano.frequencia_semanal}×/semana · {plano.prognostico_semanas} semanas
            </p>
            {plano.objetivos?.length > 0 && (
              <ul className="mt-2 space-y-0.5">
                {plano.objetivos.map((o, i) => (
                  <li key={i} className="text-xs text-gray-600 flex items-start gap-1.5">
                    <span className="text-blue-400 mt-0.5">›</span>{o}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="text-center shrink-0">
            <div className="text-3xl font-bold text-gray-900">{semanaAtual}</div>
            <div className="text-xs text-gray-500">de {plano.prognostico_semanas} semanas</div>
            <div className="mt-2 w-32 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${vencido ? 'bg-red-500' : 'bg-blue-500'}`}
                style={{ width: `${progresso}%` }}
              />
            </div>
            <div className="text-xs text-gray-400 mt-1">{progresso}%</div>
          </div>
        </CardBody>
      </Card>

      {/* Fases */}
      <Card>
        <CardHeader><CardTitle>Fases do protocolo</CardTitle></CardHeader>
        <div className="divide-y divide-gray-100">
          {fases.map(fase => {
            const isAtual = fase.id === faseAtual?.id
            const concluida = semanaAtual > fase.semana_fim
            const futura = semanaAtual < fase.semana_inicio
            const dataReav = dataReavaliacao(plano.data_av_inicial, fase.semana_fim)
            const microciclos = [...(fase.microciclo ?? [])].sort((a, b) => a.ordem - b.ordem)

            return (
              <div key={fase.id} className={`px-5 py-4 ${isAtual ? 'bg-blue-50/50' : ''}`}>
                <div className="flex items-start gap-3">
                  {concluida
                    ? <CheckCircle2 size={18} className="text-green-500 mt-0.5 shrink-0" />
                    : isAtual
                    ? <Clock size={18} className="text-blue-500 mt-0.5 shrink-0" />
                    : <Circle size={18} className="text-gray-300 mt-0.5 shrink-0" />
                  }

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-sm font-medium ${isAtual ? 'text-blue-800' : concluida ? 'text-gray-500' : 'text-gray-700'}`}>
                        {fase.nome}
                      </span>
                      {isAtual && <Badge variant="info">Atual · MC {microcicloAtual}</Badge>}
                      {concluida && <Badge variant="success">Concluída</Badge>}
                      {futura && <Badge variant="muted">Futura</Badge>}
                    </div>

                    <p className="text-xs text-gray-500 mt-0.5">
                      Semanas {fase.semana_inicio}–{fase.semana_fim} · Reavaliação prevista: {formatarDataCurta(dataReav.toISOString())}
                    </p>

                    {fase.objetivos?.length > 0 && (
                      <ul className="mt-1.5 space-y-0.5">
                        {fase.objetivos.map((o, i) => (
                          <li key={i} className="text-xs text-gray-500 flex items-start gap-1">
                            <span className="text-gray-300 mt-0.5">›</span>{o}
                          </li>
                        ))}
                      </ul>
                    )}

                    {/* Critérios */}
                    {(fase.criterio_fase ?? []).length > 0 && (
                      <div className="mt-2 space-y-1">
                        <p className="text-xs font-medium text-gray-500">Critérios para avançar:</p>
                        {fase.criterio_fase.map(c => (
                          <div key={c.id} className="flex items-center gap-1.5 text-xs text-gray-600">
                            <span className="text-gray-400">›</span>
                            <span>{c.medida?.nome}</span>
                            <span className="font-mono text-gray-500">{c.operador} {c.valor_alvo} {c.medida?.unidade}</span>
                            <span className="text-gray-400">
                              ({c.medida?.direcao_melhora === 'maior' ? '↑ maior = melhor' : '↓ menor = melhor'})
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Microciclos */}
                    {microciclos.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {microciclos.map(mc => {
                          const isCurrentMc = isAtual && microcicloAtual === mc.ordem
                          return (
                            <span
                              key={mc.id}
                              className={`px-2 py-0.5 rounded text-xs font-medium ${
                                isCurrentMc ? 'bg-blue-600 text-white'
                                : semanaAtual > mc.semana_fim ? 'bg-green-100 text-green-700'
                                : 'bg-gray-100 text-gray-500'
                              }`}
                            >
                              MC{mc.ordem} · Sem {mc.semana_inicio}–{mc.semana_fim}
                            </span>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  <Link
                    to={`/pacientes/${pacienteId}/plano/${planoId}/fase/${fase.id}`}
                    className="shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <ChevronRight size={16} />
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      <div className="flex justify-end">
        <Link
          to={`/pacientes/${pacienteId}/avaliacoes/nova?plano=${planoId}`}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
        >
          Registrar reavaliação
        </Link>
      </div>
    </div>
  )
}
