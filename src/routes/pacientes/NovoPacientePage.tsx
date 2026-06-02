import { Link } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { FormPaciente } from '@/features/pacientes/components/FormPaciente'

export default function NovoPacientePage() {
  return (
    <div className="p-6 max-w-2xl mx-auto">
      <Link to="/pacientes" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 mb-5">
        <ChevronLeft size={16} /> Pacientes
      </Link>
      <h1 className="text-lg font-semibold text-gray-900 mb-5">Novo paciente</h1>
      <FormPaciente />
    </div>
  )
}
