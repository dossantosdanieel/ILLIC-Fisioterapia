import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useAuth } from '@/lib/AuthContext'
import { listarPacientes, prioridadeBadge, prioridadeLabel } from '../api'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { Empty } from '@/components/ui/empty'
import { Users, AlertTriangle, Clock } from 'lucide-react'
import { calcularSemanaAtual, statusPlano } from '@/features/planos/utils'
import type { PacienteComPlano } from '@/types/queries'

export function ListaPacientes() {
  const { profissional } = useAuth()
  const isCoord = profissional?.papeis?.some(p => p === 'coordenador' || p === 'admin')

  const { data: pacientes, isLoading } = useQuery({
    queryKey: ['pacientes', profissional?.id],
    queryFn: () => listarPacientes(isCoord ? undefined : profissional?.id),
    enabled: !!profissional,
  })

  if (isLoading) return <Spinner />
  if (!pacientes?.length) return (
    <Empty
      icon={Users}
      title="Nenhum paciente cadastrado"
      description="Cadastre o primeiro paciente para começar."
    />
  )

  const ordenados = [...pacientes].sort((a: PacienteComPlano, b: PacienteComPlano) => {
    const planoA = a.plano_tratamento?.[0]
    const planoB = b.plano_tratamento?.[0]
    const semA = planoA ? calcularSemanaAtual(planoA.data_av_inicial) : 0
    const semB = planoB ? calcularSemanaAtual(planoB.data_av_inicial) : 0
    const vencidoA = planoA ? semA > planoA.prognostico_semanas : false
    const vencidoB = planoB ? semB > planoB.prognostico_semanas : false
    if (vencidoA !== vencidoB) return vencidoA ? -1 : 1
    const ordem: Record<string, number> = { alta: 0, moderada: 1, baixa: 2 }
    return (ordem[a.prioridade] ?? 1) - (ordem[b.prioridade] ?? 1)
  })

  return (
    <div className="divide-y divide-gray-100">
      {ordenados.map((p: PacienteComPlano) => {
        const plano = p.plano_tratamento?.[0]
        const semanaAtual = plano ? calcularSemanaAtual(plano.data_av_inicial) : null
        const vencido = plano && semanaAtual ? semanaAtual > plano.prognostico_semanas : false
        const st = plano && semanaAtual ? statusPlano(plano, semanaAtual) : null

        return (
          <Link
            key={p.id}
            to={`/pacientes/${p.id}`}
            className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-gray-900">{p.nome}</span>
                <Badge variant={prioridadeBadge(p.prioridade)}>
                  {prioridadeLabel(p.prioridade)}
                </Badge>
                {vencido && (
                  <span className="flex items-center gap-1 text-xs text-red-600 font-medium">
                    <AlertTriangle size={12} /> Vencido
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 mt-0.5">
                {p.diagnostico && (
                  <span className="text-xs text-gray-500 truncate max-w-xs">{p.diagnostico}</span>
                )}
                {p.convenio_plano && (
                  <span className="text-xs text-gray-400">{p.convenio_plano}</span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs text-gray-500 shrink-0">
              {isCoord && p.profissional && (
                <span>{p.profissional.nome}</span>
              )}
              {plano && semanaAtual !== null && (
                <span className="flex items-center gap-1">
                  <Clock size={12} />
                  Sem. {semanaAtual}/{plano.prognostico_semanas}
                </span>
              )}
              {st && <Badge variant={st.variant}>{st.label}</Badge>}
            </div>
          </Link>
        )
      })}
    </div>
  )
}
