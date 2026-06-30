import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/lib/AuthContext'
import { signOut } from '@/lib/auth'
import { listarNotificacoes } from '@/features/coordenacao/api'
import { Users, ClipboardList, BarChart2, Bell, LogOut, Settings, BookOpen } from 'lucide-react'
import { cn } from '@/lib/cn'

export default function Layout() {
  const { profissional } = useAuth()
  const navigate = useNavigate()

  const isCoord = profissional?.papeis?.some(p => p === 'coordenador' || p === 'admin') ?? false
  const isAdmin = profissional?.papeis?.includes('admin') ?? false

  const { data: notifs } = useQuery({
    queryKey: ['notificacoes', profissional?.id],
    queryFn: () => listarNotificacoes(profissional!.id),
    enabled: !!profissional && isCoord,
    refetchInterval: 30_000,
  })
  const naolidas = (notifs ?? []).filter(n => !n.lida).length

  async function handleLogout() {
    await signOut()
    navigate('/login')
  }

  const nav = [
    { to: '/pacientes', label: 'Pacientes', icon: Users },
    { to: '/sessoes', label: 'Exercícios', icon: ClipboardList },
    { to: '/protocolos', label: 'Protocolos', icon: BookOpen },
    ...(isCoord ? [{ to: '/coordenacao', label: 'Coordenação', icon: Bell, badge: naolidas }] : []),
    ...(isCoord ? [{ to: '/performance', label: 'Performance', icon: BarChart2 }] : []),
    ...(isAdmin ? [{ to: '/admin', label: 'Admin', icon: Settings }] : []),
  ]

  return (
    <div className="flex h-screen bg-gray-50">
      <aside className="w-56 bg-white border-r border-gray-200 flex flex-col shrink-0">
        <div className="px-4 py-4 border-b border-gray-200">
          <img src="/logo.png" alt="ILLIC" className="h-6 w-auto mb-1" />
          <p className="text-xs text-gray-500">Reabilitação</p>
        </div>

        <nav className="flex-1 px-2 py-4 space-y-0.5">
          {nav.map(({ to, label, icon: Icon, badge }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors',
                  isActive
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
                )
              }
            >
              <Icon size={16} />
              <span className="flex-1">{label}</span>
              {badge != null && badge > 0 && (
                <span className="px-1.5 py-0.5 text-xs font-bold bg-red-500 text-white rounded-full leading-none">
                  {badge}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="px-4 py-4 border-t border-gray-200">
          <div className="mb-3">
            <p className="text-xs font-medium text-gray-900 truncate">{profissional?.nome}</p>
            <p className="text-xs text-gray-500 capitalize">{profissional?.papeis?.join(', ')}</p>
          </div>
          <button onClick={handleLogout}
            className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-900 transition-colors">
            <LogOut size={14} /> Sair
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
