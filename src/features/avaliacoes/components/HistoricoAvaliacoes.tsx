import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Activity } from 'lucide-react'
import { listarAvaliacoesDoPaciente } from '../api'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { Empty } from '@/components/ui/empty'
import { formatarData } from '@/features/planos/utils'
import type { AvaliacaoCompleta } from '@/types/queries'

interface Props { pacienteId: string; planoId?: string }

export function HistoricoAvaliacoes({ pacienteId, planoId }: Props) {
  const { data: avaliacoes, isLoading } = useQuery({
    queryKey: ['avaliacoes', pacienteId],
    queryFn: () => listarAvaliacoesDoPaciente(pacienteId),
  })

  if (isLoading) return <Spinner />
  if (!avaliacoes?.length) return (
    <Empty
      icon={Activity}
      title="Nenhuma avaliação registrada"
      description="Registre a avaliação inicial para começar o acompanhamento."
    />
  )

  return (
    <div className="divide-y divide-gray-100">
      {(avaliacoes as AvaliacaoCompleta[]).map(av => {
        const profissional = av.profissional as { nome: string } | null
        return (
          <Link
            key={av.id}
            to={`/pacientes/${pacienteId}/avaliacoes/${av.id}${planoId ? `?plano=${planoId}` : ''}`}
            className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors"
          >
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-900">
                  {formatarData(av.data)}
                </span>
                <Badge variant={av.tipo === 'inicial' ? 'info' : 'default'}>
                  {av.tipo === 'inicial' ? 'Inicial' : 'Reavaliação'}
                </Badge>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                {profissional?.nome} · {av.valor_medida?.length ?? 0} medidas
              </p>
            </div>
            <Activity size={14} className="text-gray-300" />
          </Link>
        )
      })}
    </div>
  )
}
