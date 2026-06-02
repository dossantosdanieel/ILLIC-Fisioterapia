import { Link, Navigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { FormPaciente } from '@/features/pacientes/components/FormPaciente'
import { useAuth } from '@/lib/AuthContext'

export default function NovoPacientePage() {
  const { profissional } = useAuth()

  // Fisioterapeuta não tem acesso — redireciona silenciosamente
  if (profissional && profissional.papel === 'fisioterapeuta') {
    return <Navigate to="/pacientes" replace />
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <Link to="/pacientes" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 mb-5">
        <ChevronLeft size={16} /> Pacientes
      </Link>
      <div className="mb-5">
        <h1 className="text-lg font-semibold text-gray-900">Novo paciente</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Preencha os dados e designe o fisioterapeuta responsável.
        </p>
      </div>
      <FormPaciente />
    </div>
  )
}
