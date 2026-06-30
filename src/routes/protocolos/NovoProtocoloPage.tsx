import { ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { FormProtocolo } from '@/features/protocolos/components/FormProtocolo'

export default function NovoProtocoloPage() {
  const navigate = useNavigate()
  return (
    <div className="p-6 max-w-3xl mx-auto">
      <button onClick={() => navigate('/protocolos')}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors mb-6">
        <ArrowLeft size={14} /> Protocolos
      </button>
      <h1 className="text-lg font-semibold text-gray-900 mb-6">Novo protocolo</h1>
      <FormProtocolo />
    </div>
  )
}
