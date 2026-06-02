import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ClipboardList, CheckCircle2 } from 'lucide-react'
import { listarSessoesRealizadas } from '../api'
import { Spinner } from '@/components/ui/spinner'
import { Empty } from '@/components/ui/empty'
import { formatarData } from '@/features/planos/utils'

interface Props { pacienteId: string; planoId?: string }

export function HistoricoSessoes({ pacienteId, planoId }: Props) {
  const { data: sessoes, isLoading } = useQuery({
    queryKey: ['sessoes-realizadas', pacienteId],
    queryFn: () => listarSessoesRealizadas(pacienteId),
  })

  if (isLoading) return <Spinner />
  if (!sessoes?.length) return (
    <Empty
      icon={ClipboardList}
      title="Nenhuma sessão registrada"
      description="Execute a primeira sessão a partir da fase do plano."
    />
  )

  return (
    <div className="divide-y divide-gray-100">
      {sessoes.map(s => {
        const realizados = s.execucao_exercicio.filter(e => e.realizado).length
        const total = s.execucao_exercicio.length
        const fidelidade = total > 0 ? Math.round((realizados / total) * 100) : 100
        const alterados = s.execucao_exercicio.filter(e => e.alterado_em_tempo_real).length

        return (
          <Link
            key={s.id}
            to={`/pacientes/${pacienteId}/sessoes/${s.id}${planoId ? `?plano=${planoId}` : ''}`}
            className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors"
          >
            <CheckCircle2 size={16} className={fidelidade === 100 ? 'text-green-500' : fidelidade >= 70 ? 'text-amber-500' : 'text-red-400'} />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-900">{formatarData(s.data)}</span>
                <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                  fidelidade === 100 ? 'bg-green-50 text-green-700'
                  : fidelidade >= 70 ? 'bg-amber-50 text-amber-700'
                  : 'bg-red-50 text-red-700'
                }`}>
                  {fidelidade}% fidelidade
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                {realizados}/{total} exercícios
                {alterados > 0 && ` · ${alterados} ajuste${alterados > 1 ? 's' : ''} em tempo real`}
                {s.observacao && ` · ${s.observacao.slice(0, 60)}…`}
              </p>
            </div>
            <ClipboardList size={14} className="text-gray-300" />
          </Link>
        )
      })}
    </div>
  )
}
