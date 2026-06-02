import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, Play } from 'lucide-react'
import { buscarPlanoCompleto } from '@/features/planos/api'
import { supabase } from '@/lib/supabase'
import { BuilderSessao } from '@/features/sessoes/components/BuilderSessao'
import { Card, CardHeader, CardBody, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { Button } from '@/components/ui/button'
import { calcularSemanaAtual } from '@/features/planos/utils'
import type { FaseCompleta } from '@/types/queries'

export default function FaseDetalhePage() {
  const { id, planoId, faseId } = useParams<{ id: string; planoId: string; faseId: string }>()
  const navigate = useNavigate()

  const { data: plano, isLoading } = useQuery({
    queryKey: ['plano', planoId],
    queryFn: () => buscarPlanoCompleto(planoId!),
    enabled: !!planoId,
  })

  if (isLoading) return <Spinner />
  if (!plano) return null

  const fase = (plano.fase as FaseCompleta[]).find(f => f.id === faseId)
  if (!fase) return <p className="p-8 text-gray-500">Fase não encontrada.</p>

  const semanaAtual = calcularSemanaAtual(plano.data_av_inicial)
  const microciclos = [...(fase.microciclo ?? [])].sort((a, b) => a.ordem - b.ordem)

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Link to={`/pacientes/${id}/plano/${planoId}`}
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 mb-5">
        <ChevronLeft size={16} /> Plano
      </Link>

      <div className="mb-5">
        <h1 className="text-lg font-semibold text-gray-900">{fase.nome}</h1>
        <p className="text-sm text-gray-500">Semanas {fase.semana_inicio}–{fase.semana_fim}</p>
      </div>

      {/* Microciclos */}
      <div className="space-y-6">
        {microciclos.map(mc => {
          const isAtual = semanaAtual >= mc.semana_inicio && semanaAtual <= mc.semana_fim
          const concluido = semanaAtual > mc.semana_fim
          const templateExiste = mc.sessao_template?.[0]

          return (
            <Card key={mc.id} className={isAtual ? 'ring-2 ring-blue-200' : ''}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CardTitle>Microciclo {mc.ordem} · Semanas {mc.semana_inicio}–{mc.semana_fim}</CardTitle>
                    {isAtual && <Badge variant="info">Atual</Badge>}
                    {concluido && <Badge variant="success">Concluído</Badge>}
                    {!isAtual && !concluido && <Badge variant="muted">Futuro</Badge>}
                  </div>
                  {templateExiste && (
                    <Button
                      size="sm"
                      onClick={() => navigate(
                        `/pacientes/${id}/sessoes/executar/${templateExiste.id}?plano=${planoId}`,
                      )}
                    >
                      <Play size={13} /> Executar sessão
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardBody>
                <MicrocicloBuilder microcicloId={mc.id} semanas={`${mc.semana_inicio}–${mc.semana_fim}`} />
              </CardBody>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

// Lazy-carrega o template apenas quando necessário
function MicrocicloBuilder({ microcicloId, semanas }: { microcicloId: string; semanas: string }) {
  const [aberto, setAberto] = useState(false)
  const { data: template } = useQuery({
    queryKey: ['sessao-template-check', microcicloId],
    queryFn: async () => {
      const { data } = await supabase
        .from('sessao_template').select('id').eq('microciclo_id', microcicloId).maybeSingle()
      return data
    },
  })

  if (!aberto) {
    return (
      <button
        onClick={() => setAberto(true)}
        className="text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors"
      >
        {template ? '✎ Editar sessão proposta' : '+ Montar sessão proposta'}
      </button>
    )
  }

  return <BuilderSessao microcicloId={microcicloId} semanas={semanas} />
}

