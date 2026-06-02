import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, BellOff, Check } from 'lucide-react'
import { listarNotificacoes, marcarLida, marcarTodasLidas, subscribeNotificacoes } from '../api'
import { useAuth } from '@/lib/AuthContext'
import { Spinner } from '@/components/ui/spinner'
import { Button } from '@/components/ui/button'

const TIPO_LABELS: Record<string, { label: string; cor: string }> = {
  sessao_alterada: { label: 'Sessão alterada', cor: 'text-amber-700 bg-amber-50' },
  criterio_nao_atingido: { label: 'Critério não atingido', cor: 'text-red-700 bg-red-50' },
  plano_vencido: { label: 'Plano vencido', cor: 'text-red-700 bg-red-50' },
  checkin_pendente: { label: 'Check-in pendente', cor: 'text-orange-700 bg-orange-50' },
  fase_transicao: { label: 'Transição de fase', cor: 'text-blue-700 bg-blue-50' },
}

export function FeedNotificacoes() {
  const { profissional } = useAuth()
  const qc = useQueryClient()

  const { data: notificacoes, isLoading } = useQuery({
    queryKey: ['notificacoes', profissional?.id],
    queryFn: () => listarNotificacoes(profissional!.id),
    enabled: !!profissional,
    refetchInterval: 30_000, // polling a cada 30s como fallback
  })

  // Subscrição realtime
  useEffect(() => {
    if (!profissional) return
    const channel = subscribeNotificacoes(profissional.id, () => {
      qc.invalidateQueries({ queryKey: ['notificacoes', profissional.id] })
    })
    return () => { channel.unsubscribe() }
  }, [profissional, qc])

  const naolidas = (notificacoes ?? []).filter(n => !n.lida).length

  if (isLoading) return <Spinner />

  async function handleMarcarLida(id: string) {
    await marcarLida(id)
    qc.invalidateQueries({ queryKey: ['notificacoes', profissional?.id] })
  }

  async function handleMarcarTodas() {
    if (!profissional) return
    await marcarTodasLidas(profissional.id)
    qc.invalidateQueries({ queryKey: ['notificacoes', profissional.id] })
  }

  function formatPayload(tipo: string, payload: Record<string, unknown>): string {
    if (tipo === 'sessao_alterada') {
      const base = `${payload.profissional_nome} alterou sessão de ${payload.paciente_nome}`
      if (payload.exercicio_nome) return `${base} — ${payload.exercicio_nome}`
      if (payload.motivo_nao_realizado) return `${base} (${payload.motivo_nao_realizado})`
      return base
    }
    return JSON.stringify(payload)
  }

  function tempoAtras(iso: string) {
    const diff = Date.now() - new Date(iso).getTime()
    const min = Math.floor(diff / 60000)
    if (min < 1) return 'agora'
    if (min < 60) return `${min}min`
    const h = Math.floor(min / 60)
    if (h < 24) return `${h}h`
    return `${Math.floor(h / 24)}d`
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-gray-900">Notificações</h2>
          {naolidas > 0 && (
            <span className="px-2 py-0.5 text-xs font-bold bg-red-500 text-white rounded-full">
              {naolidas}
            </span>
          )}
        </div>
        {naolidas > 0 && (
          <Button variant="ghost" size="sm" onClick={handleMarcarTodas}>
            <Check size={13} /> Marcar todas como lidas
          </Button>
        )}
      </div>

      {notificacoes?.length === 0 && (
        <div className="flex flex-col items-center py-16 text-center">
          <BellOff size={28} className="text-gray-300 mb-2" />
          <p className="text-sm text-gray-500">Nenhuma notificação</p>
        </div>
      )}

      <div className="space-y-1">
        {(notificacoes ?? []).map(n => {
          const info = TIPO_LABELS[n.tipo] ?? { label: n.tipo, cor: 'text-gray-700 bg-gray-50' }
          const payload = (n.payload ?? {}) as Record<string, unknown>
          return (
            <div
              key={n.id}
              className={`flex items-start gap-3 px-4 py-3 rounded-lg transition-colors ${
                n.lida ? 'bg-white' : 'bg-blue-50'
              }`}
            >
              <Bell size={14} className={`mt-0.5 shrink-0 ${n.lida ? 'text-gray-300' : 'text-blue-500'}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${info.cor}`}>
                    {info.label}
                  </span>
                  <span className="text-xs text-gray-400">{tempoAtras(n.criado_em)}</span>
                </div>
                <p className="text-sm text-gray-700">{formatPayload(n.tipo, payload)}</p>
              </div>
              {!n.lida && (
                <button onClick={() => handleMarcarLida(n.id)}
                  className="text-gray-300 hover:text-gray-600 transition-colors p-1 shrink-0">
                  <Check size={13} />
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
