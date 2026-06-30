import { supabase } from '@/lib/supabase'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import type { Papel } from '@/types/database'

export type UsuarioRow = {
  id: string
  auth_id: string | null
  nome: string
  email: string
  crefito: string | null
  papeis: Papel[]
  ativo: boolean
  criado_em: string
}

export async function listarUsuarios(): Promise<UsuarioRow[]> {
  const { data, error } = await supabase
    .from('profissional')
    .select('*')
    .order('nome')
  if (error) throw error
  return data as UsuarioRow[]
}

export async function criarUsuario(payload: {
  nome: string
  email: string
  senha: string
  papeis: Papel[]
  crefito?: string
}): Promise<void> {
  // Usa Admin API para criar o usuário sem enviar e-mail de confirmação
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: payload.email,
    password: payload.senha,
    email_confirm: true,
  })
  if (authError) throw authError

  const authId = authData.user?.id
  if (!authId) throw new Error('Falha ao obter ID do usuário criado.')

  // O trigger handle_new_user já inseriu a linha — apenas atualiza com os dados corretos do formulário
  const { error: dbError } = await supabaseAdmin
    .from('profissional')
    .update({
      nome: payload.nome,
      papeis: payload.papeis,
      crefito: payload.crefito || null,
    })
    .eq('auth_id', authId)
  if (dbError) throw dbError
}

export async function atualizarUsuario(id: string, patch: {
  nome?: string
  papeis?: Papel[]
  crefito?: string | null
  ativo?: boolean
}): Promise<void> {
  const { error } = await supabaseAdmin.from('profissional').update(patch).eq('id', id)
  if (error) throw error
}

export async function alterarSenha(authId: string, novaSenha: string): Promise<void> {
  const { error } = await supabaseAdmin.auth.admin.updateUserById(authId, { password: novaSenha })
  if (error) throw error
}
