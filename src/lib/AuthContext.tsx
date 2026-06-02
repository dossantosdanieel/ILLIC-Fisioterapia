import { createContext, useContext, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import type { Database } from '@/types/database'

type Profissional = Database['public']['Tables']['profissional']['Row']

interface AuthContextValue {
  session: Session | null
  profissional: Profissional | null
  loading: boolean
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  profissional: null,
  loading: true,
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profissional, setProfissional] = useState<Profissional | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (data.session) fetchProfissional(data.session.user.id)
      else setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess)
      if (sess) fetchProfissional(sess.user.id)
      else { setProfissional(null); setLoading(false) }
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  async function fetchProfissional(authId: string) {
    const { data } = await supabase
      .from('profissional')
      .select('*')
      .eq('auth_id', authId)
      .single()
    setProfissional(data)
    setLoading(false)
  }

  return (
    <AuthContext.Provider value={{ session, profissional, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
