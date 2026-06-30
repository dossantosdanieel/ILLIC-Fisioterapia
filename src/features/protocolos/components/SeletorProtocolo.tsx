import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { X, Search, ChevronRight } from 'lucide-react'
import { listarProtocolos, buscarProtocolo, type ProtocoloResumo } from '../api'
import { Spinner } from '@/components/ui/spinner'
import { Button } from '@/components/ui/button'

export interface ProtocoloSelecionado {
  nome: string
  prognostico_semanas: number
  fases: {
    nome: string
    semana_inicio: number
    semana_fim: number
    objetivos: string[]
    exercicios: {
      exercicio_id: string
      nota: string | null
      regra_progressao: string | null
      series: number
      reps: number | null
      tempo_seg: number | null
      carga_tipo: string
      carga_valor: string
    }[]
  }[]
}

interface Props {
  onSelecionar: (proto: ProtocoloSelecionado) => void
  onClose: () => void
}

export function SeletorProtocolo({ onSelecionar, onClose }: Props) {
  const [busca, setBusca] = useState('')
  const [selecionado, setSelecionado] = useState<ProtocoloResumo | null>(null)
  const [loadingAplicar, setLoadingAplicar] = useState(false)
  const [erroAplicar, setErroAplicar] = useState<string | null>(null)

  const { data: protocolos, isLoading } = useQuery({
    queryKey: ['protocolos'],
    queryFn: listarProtocolos,
  })

  const filtrados = (protocolos ?? []).filter(p =>
    p.ativo && (
      p.nome.toLowerCase().includes(busca.toLowerCase()) ||
      p.lesao.toLowerCase().includes(busca.toLowerCase())
    )
  )

  const lesoes = [...new Set(filtrados.map(p => p.lesao))].sort()

  async function handleAplicar() {
    if (!selecionado) return
    setLoadingAplicar(true)
    setErroAplicar(null)
    try {
      const proto = await buscarProtocolo(selecionado.id)
      const fases = [...proto.protocolo_fase].sort((a, b) => a.ordem - b.ordem)
      const prognostico = fases[fases.length - 1]?.semana_fim ?? 12
      onSelecionar({
        nome: proto.nome,
        prognostico_semanas: prognostico,
        fases: fases.map(f => ({
          nome: f.nome,
          semana_inicio: f.semana_inicio,
          semana_fim: f.semana_fim,
          objetivos: f.objetivos
            .filter(o => o.texto.trim())
            .map(o =>
              o.semana_inicio != null || o.semana_fim != null
                ? `${o.texto} (sem. ${o.semana_inicio ?? '?'}–${o.semana_fim ?? '?'})`
                : o.texto
            ),
          exercicios: [...f.protocolo_fase_exercicio]
            .sort((a, b) => a.ordem - b.ordem)
            .map(ex => ({
              exercicio_id: ex.exercicio_id,
              nota: ex.nota,
              regra_progressao: ex.regra_progressao,
              series: ex.series ?? 3,
              reps: ex.reps ?? null,
              tempo_seg: ex.tempo_seg ?? null,
              carga_tipo: ex.carga_tipo ?? 'kg',
              carga_valor: ex.carga_valor ?? '0',
            })),
        })),
      })
    } catch (err) {
      setErroAplicar(err instanceof Error ? err.message : 'Erro ao carregar protocolo')
    } finally {
      setLoadingAplicar(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 shrink-0">
          <h2 className="text-base font-semibold text-gray-900">Usar protocolo pré-definido</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Busca */}
        <div className="px-5 py-3 border-b border-gray-100 shrink-0">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nome ou lesão…"
              value={busca}
              onChange={e => setBusca(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          </div>
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {isLoading ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : filtrados.length === 0 ? (
            <p className="text-sm text-gray-400 italic text-center py-8">Nenhum protocolo encontrado.</p>
          ) : (
            <div className="space-y-4">
              {lesoes.map(lesao => (
                <div key={lesao}>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{lesao}</p>
                  <div className="space-y-1">
                    {filtrados.filter(p => p.lesao === lesao).map(p => (
                      <button
                        key={p.id}
                        onClick={() => setSelecionado(p)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                          selecionado?.id === p.id
                            ? 'bg-blue-50 border border-blue-200'
                            : 'hover:bg-gray-50 border border-transparent'
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900">{p.nome}</p>
                          <p className="text-xs text-gray-500">{p.protocolo_fase.length} fase{p.protocolo_fase.length !== 1 ? 's' : ''}</p>
                        </div>
                        <ChevronRight size={14} className="text-gray-300 shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-200 shrink-0">
          {erroAplicar && (
            <p className="text-xs text-red-600 mb-2">
              Erro ao carregar protocolo. Verifique se as migrações de banco estão aplicadas.
            </p>
          )}
          <div className="flex gap-2">
            <Button onClick={handleAplicar} disabled={!selecionado} loading={loadingAplicar}>
              Aplicar protocolo
            </Button>
            <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          </div>
        </div>
      </div>
    </div>
  )
}
