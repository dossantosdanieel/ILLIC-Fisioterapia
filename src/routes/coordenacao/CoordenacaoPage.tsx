import { useState } from 'react'
import { Bell } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/lib/AuthContext'
import { PainelCoordenador } from '@/features/coordenacao/components/PainelCoordenador'
import { ModoReuniao } from '@/features/coordenacao/components/ModoReuniao'
import { FeedNotificacoes } from '@/features/coordenacao/components/FeedNotificacoes'
import { listarNotificacoes } from '@/features/coordenacao/api'

type Tab = 'painel' | 'reuniao' | 'notificacoes'

export default function CoordenacaoPage() {
  const { profissional } = useAuth()
  const [tab, setTab] = useState<Tab>('painel')

  const { data: notifs } = useQuery({
    queryKey: ['notificacoes', profissional?.id],
    queryFn: () => listarNotificacoes(profissional!.id),
    enabled: !!profissional,
    refetchInterval: 30_000,
  })
  const naolidas = (notifs ?? []).filter(n => !n.lida).length

  const TABS: { key: Tab; label: React.ReactNode }[] = [
    { key: 'painel', label: 'Painel' },
    { key: 'reuniao', label: 'Modo reunião' },
    {
      key: 'notificacoes',
      label: (
        <span className="flex items-center gap-1.5">
          <Bell size={13} />
          Notificações
          {naolidas > 0 && (
            <span className="px-1.5 py-0.5 text-xs font-bold bg-red-500 text-white rounded-full leading-none">
              {naolidas}
            </span>
          )}
        </span>
      ),
    },
  ]

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Coordenação</h1>
          <p className="text-sm text-gray-500 mt-0.5">Visão consolidada da clínica</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-5">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'painel' && <PainelCoordenador />}
      {tab === 'reuniao' && <ModoReuniao />}
      {tab === 'notificacoes' && <FeedNotificacoes />}
    </div>
  )
}
