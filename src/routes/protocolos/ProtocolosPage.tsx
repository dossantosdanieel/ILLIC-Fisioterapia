import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Plus, Search, ChevronRight } from 'lucide-react'
import { listarProtocolos } from '@/features/protocolos/api'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { useAuth } from '@/lib/AuthContext'

export default function ProtocolosPage() {
  const navigate = useNavigate()
  const { profissional } = useAuth()
  const [busca, setBusca] = useState('')

  const podeEditar = profissional?.papeis?.some(p => p === 'coordenador' || p === 'admin')

  const { data: protocolos, isLoading } = useQuery({
    queryKey: ['protocolos'],
    queryFn: listarProtocolos,
  })

  const filtrados = (protocolos ?? []).filter(p =>
    p.nome.toLowerCase().includes(busca.toLowerCase()) ||
    p.lesao.toLowerCase().includes(busca.toLowerCase())
  )

  const lesoes = [...new Set(filtrados.map(p => p.lesao))].sort()

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Protocolos</h1>
          <p className="text-sm text-gray-500">{protocolos?.length ?? 0} protocolo{(protocolos?.length ?? 0) !== 1 ? 's' : ''} cadastrado{(protocolos?.length ?? 0) !== 1 ? 's' : ''}</p>
        </div>
        {podeEditar && (
          <Button onClick={() => navigate('/protocolos/novo')}>
            <Plus size={15} /> Novo protocolo
          </Button>
        )}
      </div>

      <div className="relative mb-5">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar por nome ou lesão…"
          value={busca}
          onChange={e => setBusca(e.target.value)}
          className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : filtrados.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-sm text-gray-400 italic">Nenhum protocolo encontrado.</p>
          {podeEditar && (
            <button onClick={() => navigate('/protocolos/novo')}
              className="mt-3 text-sm text-blue-600 hover:underline">
              Criar o primeiro protocolo
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {lesoes.map(lesao => (
            <div key={lesao}>
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{lesao}</h2>
              <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
                {filtrados.filter(p => p.lesao === lesao).map(p => (
                  <button
                    key={p.id}
                    onClick={() => navigate(`/protocolos/${p.id}`)}
                    className="w-full flex items-center gap-4 px-4 py-3.5 text-left hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-900">{p.nome}</p>
                        {!p.ativo && (
                          <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-400 rounded">Inativo</span>
                        )}
                      </div>
                      {p.descricao && (
                        <p className="text-xs text-gray-500 mt-0.5 truncate max-w-md">
                          {p.descricao.replace(/<[^>]+>/g, '').slice(0, 100)}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs text-gray-400">{p.protocolo_fase.length} fase{p.protocolo_fase.length !== 1 ? 's' : ''}</span>
                      <ChevronRight size={14} className="text-gray-300" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
