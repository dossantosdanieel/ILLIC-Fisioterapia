import { supabase } from './supabase'
import { getProfissionalAtual } from './auth'

export async function registrarAuditoria(
  acao: string,
  entidade: string,
  entidadeId?: string,
  payload?: Record<string, unknown>,
) {
  const prof = await getProfissionalAtual()
  await supabase.from('log_auditoria').insert({
    ator_id: prof?.id ?? null,
    acao,
    entidade,
    entidade_id: entidadeId ?? null,
    payload: payload ?? null,
  })
}
