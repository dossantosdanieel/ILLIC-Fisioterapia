import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft } from 'lucide-react'
import { buscarPaciente } from '@/features/pacientes/api'
import { CheckInForm } from '@/features/coordenacao/components/CheckInForm'
import { Spinner } from '@/components/ui/spinner'
import type { PacienteDetalhe } from '@/types/queries'

export default function CheckInPage() {
  const { id } = useParams<{ id: string }>()
  const { data, isLoading } = useQuery({
    queryKey: ['paciente', id],
    queryFn: () => buscarPaciente(id!),
    enabled: !!id,
  })
  const paciente = data as PacienteDetalhe | undefined

  if (isLoading) return <Spinner />

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <Link to={`/pacientes/${id}`} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 mb-5">
        <ChevronLeft size={16} /> {paciente?.nome ?? 'Paciente'}
      </Link>
      <div className="mb-5">
        <h1 className="text-lg font-semibold text-gray-900">Check-in semanal</h1>
        <p className="text-sm text-gray-500 mt-0.5">Percepção Clínica — {paciente?.nome}</p>
      </div>
      <CheckInForm pacienteId={id!} pacienteNome={paciente?.nome ?? ''} />
    </div>
  )
}
