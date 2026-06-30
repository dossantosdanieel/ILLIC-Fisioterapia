import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { buscarProtocolo } from '@/features/protocolos/api'
import { DetalheProtocolo } from '@/features/protocolos/components/DetalheProtocolo'
import { Spinner } from '@/components/ui/spinner'

export default function ProtocoloDetalhePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data, isLoading } = useQuery({
    queryKey: ['protocolo', id],
    queryFn: () => buscarProtocolo(id!),
    enabled: !!id,
  })

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <button onClick={() => navigate('/protocolos')}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors mb-6">
        <ArrowLeft size={14} /> Protocolos
      </button>
      {isLoading ? <div className="flex justify-center py-16"><Spinner /></div> : data ? <DetalheProtocolo protocolo={data} /> : null}
    </div>
  )
}
