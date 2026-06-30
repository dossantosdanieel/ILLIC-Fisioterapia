import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, UserCheck, UserX } from 'lucide-react'
import { listarUsuarios, atualizarUsuario, type UsuarioRow } from '../api'
import { FormUsuario } from './FormUsuario'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import type { Papel } from '@/types/database'

const PAPEL_LABEL: Record<Papel, string> = {
  fisioterapeuta: 'Fisioterapeuta',
  coordenador: 'Coordenador',
  admin: 'Administrador',
}

const PAPEL_COR: Record<Papel, string> = {
  fisioterapeuta: 'bg-blue-50 text-blue-700',
  coordenador: 'bg-purple-50 text-purple-700',
  admin: 'bg-orange-50 text-orange-700',
}

export function ListaUsuarios() {
  const qc = useQueryClient()
  const [modalAberto, setModalAberto] = useState(false)
  const [editando, setEditando] = useState<UsuarioRow | undefined>()
  const [filtroPapel, setFiltroPapel] = useState<Papel | 'todos'>('todos')
  const [filtroAtivo, setFiltroAtivo] = useState<'todos' | 'ativo' | 'inativo'>('todos')

  const { data: usuarios, isLoading } = useQuery({
    queryKey: ['usuarios'],
    queryFn: listarUsuarios,
  })

  async function toggleAtivo(u: UsuarioRow) {
    await atualizarUsuario(u.id, { ativo: !u.ativo })
    qc.invalidateQueries({ queryKey: ['usuarios'] })
  }

  function abrirNovo() { setEditando(undefined); setModalAberto(true) }
  function abrirEditar(u: UsuarioRow) { setEditando(u); setModalAberto(true) }
  function fecharModal() { setModalAberto(false); setEditando(undefined) }
  function onSalvo() { fecharModal(); qc.invalidateQueries({ queryKey: ['usuarios'] }) }

  const lista = (usuarios ?? []).filter(u => {
    if (filtroPapel !== 'todos' && !u.papeis?.includes(filtroPapel)) return false
    if (filtroAtivo === 'ativo' && !u.ativo) return false
    if (filtroAtivo === 'inativo' && u.ativo) return false
    return true
  })

  if (isLoading) return <Spinner />

  return (
    <div className="space-y-4">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Usuários</h1>
          <p className="text-sm text-gray-500">{usuarios?.length ?? 0} usuário{(usuarios?.length ?? 0) !== 1 ? 's' : ''} cadastrado{(usuarios?.length ?? 0) !== 1 ? 's' : ''}</p>
        </div>
        <Button onClick={abrirNovo}>
          <Plus size={15} /> Novo usuário
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        {(['todos', 'fisioterapeuta', 'coordenador', 'admin'] as const).map(p => (
          <button
            key={p}
            onClick={() => setFiltroPapel(p)}
            className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
              filtroPapel === p
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
            }`}
          >
            {p === 'todos' ? 'Todos' : PAPEL_LABEL[p]}
          </button>
        ))}
        <div className="w-px bg-gray-200 mx-1" />
        {(['todos', 'ativo', 'inativo'] as const).map(s => (
          <button
            key={s}
            onClick={() => setFiltroAtivo(s)}
            className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
              filtroAtivo === s
                ? 'bg-gray-800 text-white border-gray-800'
                : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
            }`}
          >
            {s === 'todos' ? 'Todos os status' : s === 'ativo' ? 'Ativos' : 'Inativos'}
          </button>
        ))}
      </div>

      {/* Tabela */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {lista.length === 0 ? (
          <p className="text-sm text-gray-400 italic text-center py-10">Nenhum usuário encontrado.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Nome</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">E-mail</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Papel</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">CREFITO</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {lista.map(u => (
                <tr key={u.id} className={`hover:bg-gray-50 transition-colors ${!u.ativo ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3 font-medium text-gray-900">{u.nome}</td>
                  <td className="px-4 py-3 text-gray-600">{u.email}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(u.papeis ?? []).map(p => (
                        <span key={p} className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${PAPEL_COR[p]}`}>
                          {PAPEL_LABEL[p]}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{u.crefito ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${u.ativo ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {u.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <button
                        onClick={() => abrirEditar(u)}
                        title="Editar"
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => toggleAtivo(u)}
                        title={u.ativo ? 'Desativar' : 'Reativar'}
                        className={`p-1.5 rounded transition-colors ${u.ativo ? 'text-gray-400 hover:text-red-600 hover:bg-red-50' : 'text-gray-400 hover:text-green-600 hover:bg-green-50'}`}
                      >
                        {u.ativo ? <UserX size={14} /> : <UserCheck size={14} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modalAberto && (
        <FormUsuario usuario={editando} onClose={fecharModal} onSalvo={onSalvo} />
      )}
    </div>
  )
}
