import { Navigate } from 'react-router-dom'
import { useAuth } from '@/lib/AuthContext'
import type { Papel } from '@/types/database'

interface Props {
  children: React.ReactNode
  minPapel?: Papel
}

const ORDEM: Record<Papel, number> = {
  fisioterapeuta: 0,
  coordenador: 1,
  admin: 2,
}

export default function ProtectedRoute({ children, minPapel }: Props) {
  const { session, profissional, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!session) return <Navigate to="/login" replace />

  if (minPapel && profissional) {
    const nivelMax = Math.max(...(profissional.papeis ?? ['fisioterapeuta']).map(p => ORDEM[p]))
    if (nivelMax < ORDEM[minPapel]) return <Navigate to="/pacientes" replace />
  }

  return <>{children}</>
}
