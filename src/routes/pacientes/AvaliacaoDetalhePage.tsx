import { useParams, Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft } from 'lucide-react'
import { buscarPaciente } from '@/features/pacientes/api'
import { ResultadoAvaliacao } from '@/features/avaliacoes/components/ResultadoAvaliacao'
import { Spinner } from '@/components/ui/spinner'
import type { PacienteDetalhe } from '@/types/queries'

export default function AvaliacaoDetalhePage() {
  const { id, avaliacaoId } = useParams<{ id: string; avaliacaoId: string }>()
  const [searchParams] = useSearchParams()
  const planoId = searchParams.get('plano') ?? undefined

  const { data, isLoading } = useQuery({
    queryKey: ['paciente', id],
    queryFn: () => buscarPaciente(id!),
    enabled: !!id,
  })
  const paciente = data as PacienteDetalhe | undefined

  if (isLoading) return <Spinner />

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <Link to={`/pacientes/${id}`} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 mb-5">
        <ChevronLeft size={16} /> {paciente?.nome ?? 'Paciente'}
      </Link>
      <h1 className="text-lg font-semibold text-gray-900 mb-5">Avaliação</h1>
      <ResultadoAvaliacao avaliacaoId={avaliacaoId!} planoId={planoId} />
    </div>
  )
}
