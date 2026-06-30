import { useState } from 'react'
import { X, KeyRound, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { criarUsuario, atualizarUsuario, alterarSenha, type UsuarioRow } from '../api'
import type { Papel } from '@/types/database'

const PAPEIS: { value: Papel; label: string; descricao: string }[] = [
  { value: 'fisioterapeuta', label: 'Fisioterapeuta', descricao: 'Acessa seus próprios pacientes' },
  { value: 'coordenador', label: 'Coordenador', descricao: 'Vê todos os pacientes, reuniões e ranking' },
  { value: 'admin', label: 'Administrador', descricao: 'Gestão de usuários e catálogos' },
]

interface Props {
  usuario?: UsuarioRow
  onClose: () => void
  onSalvo: () => void
}

export function FormUsuario({ usuario, onClose, onSalvo }: Props) {
  const editando = !!usuario

  const [form, setForm] = useState({
    nome: usuario?.nome ?? '',
    email: usuario?.email ?? '',
    senha: '',
    papeis: (usuario?.papeis ?? ['fisioterapeuta']) as Papel[],
    crefito: usuario?.crefito ?? '',
  })
  const [alterandoSenha, setAlterandoSenha] = useState(false)
  const [novaSenha, setNovaSenha] = useState('')
  const [confirmaSenha, setConfirmaSenha] = useState('')
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  function togglePapel(papel: Papel) {
    setForm(f => {
      const jatem = f.papeis.includes(papel)
      if (jatem && f.papeis.length === 1) return f // pelo menos um papel sempre
      return {
        ...f,
        papeis: jatem ? f.papeis.filter(p => p !== papel) : [...f.papeis, papel],
      }
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)

    // Validação da nova senha (se o campo estiver ativo)
    if (editando && alterandoSenha) {
      if (novaSenha.length < 6) { setErro('A nova senha deve ter pelo menos 6 caracteres.'); return }
      if (novaSenha !== confirmaSenha) { setErro('As senhas não coincidem.'); return }
      if (!usuario.auth_id) { setErro('Este usuário não possui conta de autenticação.'); return }
    }

    setLoading(true)
    try {
      if (editando) {
        await atualizarUsuario(usuario.id, {
          nome: form.nome,
          papeis: form.papeis,
          crefito: form.crefito || null,
        })
        // Altera senha apenas se o campo foi preenchido
        if (alterandoSenha && novaSenha && usuario.auth_id) {
          await alterarSenha(usuario.auth_id, novaSenha)
        }
      } else {
        if (form.senha.length < 6) { setErro('A senha deve ter pelo menos 6 caracteres.'); return }
        await criarUsuario({
          nome: form.nome,
          email: form.email,
          senha: form.senha,
          papeis: form.papeis,
          crefito: form.crefito || undefined,
        })
      }
      onSalvo()
    } catch (err) {
      const msg = err instanceof Error ? err.message : JSON.stringify(err)
      setErro(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">
            {editando ? 'Editar usuário' : 'Novo usuário'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-5 space-y-4">
          <Input
            label="Nome completo *"
            required
            value={form.nome}
            onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
            placeholder="Ex: Ana Paula Souza"
          />

          <Input
            label="E-mail *"
            type="email"
            required
            disabled={editando}
            value={form.email}
            onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            placeholder="usuario@illic.com.br"
          />

          {!editando && (
            <Input
              label="Senha provisória *"
              type="password"
              required
              value={form.senha}
              onChange={e => setForm(f => ({ ...f, senha: e.target.value }))}
              placeholder="Mínimo 6 caracteres"
            />
          )}

          {/* Seção de alteração de senha — apenas no modo edição */}
          {editando && (
            <div className="rounded-lg border border-gray-200 overflow-hidden">
              <button
                type="button"
                onClick={() => {
                  setAlterandoSenha(!alterandoSenha)
                  setNovaSenha('')
                  setConfirmaSenha('')
                  setErro(null)
                }}
                className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <KeyRound size={15} className="text-gray-400" />
                  Alterar senha
                </span>
                <span className={`text-xs font-normal ${alterandoSenha ? 'text-blue-600' : 'text-gray-400'}`}>
                  {alterandoSenha ? 'Cancelar' : 'Clique para expandir'}
                </span>
              </button>

              {alterandoSenha && (
                <div className="px-4 pb-4 pt-1 space-y-3 border-t border-gray-100 bg-gray-50">
                  <p className="text-xs text-gray-500">
                    A nova senha será aplicada imediatamente. O usuário precisará usá-la no próximo login.
                  </p>
                  <div className="relative">
                    <label className="text-sm font-medium text-gray-700 block mb-1">Nova senha *</label>
                    <input
                      type={mostrarSenha ? 'text' : 'password'}
                      value={novaSenha}
                      onChange={e => setNovaSenha(e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                      className="w-full pr-10 px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => setMostrarSenha(!mostrarSenha)}
                      className="absolute right-2.5 top-[30px] text-gray-400 hover:text-gray-600"
                    >
                      {mostrarSenha ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">Confirmar nova senha *</label>
                    <input
                      type={mostrarSenha ? 'text' : 'password'}
                      value={confirmaSenha}
                      onChange={e => setConfirmaSenha(e.target.value)}
                      placeholder="Repita a nova senha"
                      className={`w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        confirmaSenha && confirmaSenha !== novaSenha
                          ? 'border-red-300 bg-red-50'
                          : confirmaSenha && confirmaSenha === novaSenha
                            ? 'border-green-300 bg-green-50'
                            : 'border-gray-300'
                      }`}
                    />
                    {confirmaSenha && confirmaSenha !== novaSenha && (
                      <p className="text-xs text-red-500 mt-1">As senhas não coincidem.</p>
                    )}
                    {confirmaSenha && confirmaSenha === novaSenha && novaSenha.length >= 6 && (
                      <p className="text-xs text-green-600 mt-1">Senhas conferem.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Papéis — checkboxes múltiplos */}
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">Papéis *</label>
            <div className="space-y-2">
              {PAPEIS.map(p => {
                const ativo = form.papeis.includes(p.value)
                return (
                  <label key={p.value}
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      ativo ? 'border-blue-300 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
                    }`}>
                    <input
                      type="checkbox"
                      checked={ativo}
                      onChange={() => togglePapel(p.value)}
                      className="mt-0.5 accent-blue-600"
                    />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{p.label}</p>
                      <p className="text-xs text-gray-500">{p.descricao}</p>
                    </div>
                  </label>
                )
              })}
            </div>
          </div>

          <Input
            label="CREFITO (opcional)"
            value={form.crefito}
            onChange={e => setForm(f => ({ ...f, crefito: e.target.value }))}
            placeholder="Ex: 3-12345-F"
          />

          {erro && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">{erro}</p>
          )}

          <div className="flex gap-2 pt-1">
            <Button type="submit" loading={loading}>
              {editando ? 'Salvar alterações' : 'Criar usuário'}
            </Button>
            <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          </div>
        </form>
      </div>
    </div>
  )
}
