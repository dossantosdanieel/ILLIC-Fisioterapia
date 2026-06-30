import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { X, Search, UserRound } from 'lucide-react'
import { listarPacientes } from '@/features/pacientes/api'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { useAuth } from '@/lib/AuthContext'

interface Props {
  protocoloId: string
  onClose: () => void
}

export function AplicarProtocoloModal({ protocoloId, onClose }: Props) {
  const navigate = useNavigate()
  const { profissional, temPapel } = useAuth()
  const [busca, setBusca] = useState('')

  const fisioId = temPapel('coordenador', 'admin') ? undefined : profissional?.id

  const { data: pacientes, isLoading } = useQuery({
    queryKey: ['pacientes', fisioId],
    queryFn: () => listarPacientes(fisioId),
  })

  const filtrados = (pacientes ?? []).filter(p =>
    p.nome.toLowerCase().includes(busca.toLowerCase())
  )

  function handleSelecionar(pacienteId: string) {
    navigate(`/pacientes/${pacienteId}/plano/novo?protocolo=${protocoloId}`)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 flex flex-col max-h-[75vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 shrink-0">
          <h2 className="text-base font-semibold text-gray-900">Aplicar a um paciente</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X size={18} /></button>
        </div>

        <div className="px-5 py-3 border-b border-gray-100 shrink-0">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Buscar paciente…" value={busca} onChange={e => setBusca(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" autoFocus />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3">
          {isLoading ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : filtrados.length === 0 ? (
            <p className="text-sm text-gray-400 italic text-center py-8">Nenhum paciente encontrado.</p>
          ) : (
            <div className="space-y-1">
              {filtrados.map(p => (
                <button key={p.id} onClick={() => handleSelecionar(p.id)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-200">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                    <UserRound size={14} className="text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{p.nome}</p>
                    <p className="text-xs text-gray-500">{p.diagnostico ?? 'Sem diagnóstico'}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-gray-100 shrink-0">
          <Button variant="secondary" onClick={onClose} className="w-full">Cancelar</Button>
        </div>
      </div>
    </div>
  )
}
