import { Link } from 'react-router-dom'
import { Plus, Search } from 'lucide-react'
import { useState } from 'react'
import { ListaPacientes } from '@/features/pacientes/components/ListaPacientes'
import { Card } from '@/components/ui/card'

export default function PacientesPage() {
  const [busca, setBusca] = useState('')

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Pacientes</h1>
          <p className="text-sm text-gray-500 mt-0.5">Gerencie seus pacientes e planos de tratamento</p>
        </div>
        <Link
          to="/pacientes/novo"
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
        >
          <Plus size={16} /> Novo paciente
        </Link>
      </div>

      <div className="mb-4 relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar paciente…"
          value={busca}
          onChange={e => setBusca(e.target.value)}
          className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <Card className="overflow-hidden">
        <ListaPacientes />
      </Card>
    </div>
  )
}
