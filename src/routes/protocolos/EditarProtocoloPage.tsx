import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { buscarProtocolo } from '@/features/protocolos/api'
import { FormEditarProtocolo } from '@/features/protocolos/components/FormEditarProtocolo'
import { Spinner } from '@/components/ui/spinner'

export default function EditarProtocoloPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data, isLoading } = useQuery({
    queryKey: ['protocolo', id],
    queryFn: () => buscarProtocolo(id!),
    enabled: !!id,
  })

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <button onClick={() => navigate(`/protocolos/${id}`)}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors mb-6">
        <ArrowLeft size={14} /> Voltar ao protocolo
      </button>
      <h1 className="text-lg font-semibold text-gray-900 mb-6">Editar protocolo</h1>
      {isLoading ? <div className="flex justify-center py-16"><Spinner /></div>
        : data ? <FormEditarProtocolo protocolo={data} />
        : null}
    </div>
  )
}
