import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Search } from 'lucide-react'
import { listarExercicios, criarExercicio, atualizarExercicio } from '@/features/sessoes/api'
import { useAuth } from '@/lib/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { Card } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { Empty } from '@/components/ui/empty'
import { ClipboardList } from 'lucide-react'

export default function SessoesPage() {
  const { profissional } = useAuth()
  const qc = useQueryClient()
  const isAdmin = profissional?.papeis?.includes('admin')

  const [busca, setBusca] = useState('')
  const [modal, setModal] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ nome: '', descricao: '', grupo_muscular: '', video_url: '' })
  const [saving, setSaving] = useState(false)

  const { data: exercicios, isLoading } = useQuery({
    queryKey: ['exercicios', busca],
    queryFn: () => listarExercicios(busca || undefined),
  })

  function abrirModal(ex?: { id: string; nome: string; descricao: string | null; grupo_muscular: string | null; video_url: string | null }) {
    if (ex) {
      setEditId(ex.id)
      setForm({ nome: ex.nome, descricao: ex.descricao ?? '', grupo_muscular: ex.grupo_muscular ?? '', video_url: ex.video_url ?? '' })
    } else {
      setEditId(null)
      setForm({ nome: '', descricao: '', grupo_muscular: '', video_url: '' })
    }
    setModal(true)
  }

  async function handleSalvar() {
    if (!form.nome.trim()) return
    setSaving(true)
    try {
      if (editId) {
        await atualizarExercicio(editId, { nome: form.nome, descricao: form.descricao || null, grupo_muscular: form.grupo_muscular || null, video_url: form.video_url || null })
      } else {
        await criarExercicio({ nome: form.nome, descricao: form.descricao || null, grupo_muscular: form.grupo_muscular || null, video_url: form.video_url || null })
      }
      qc.invalidateQueries({ queryKey: ['exercicios'] })
      setModal(false)
    } finally { setSaving(false) }
  }

  // Agrupar por grupo muscular
  const grupos: Record<string, typeof exercicios> = {}
  for (const ex of exercicios ?? []) {
    const g = ex.grupo_muscular ?? 'Outros'
    if (!grupos[g]) grupos[g] = []
    grupos[g]!.push(ex)
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Catálogo de exercícios</h1>
          <p className="text-sm text-gray-500 mt-0.5">Biblioteca de exercícios disponíveis para prescrição</p>
        </div>
        {isAdmin && (
          <Button size="sm" onClick={() => abrirModal()}>
            <Plus size={14} /> Novo exercício
          </Button>
        )}
      </div>

      <div className="mb-4 relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text" placeholder="Buscar exercício…"
          value={busca} onChange={e => setBusca(e.target.value)}
          className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {isLoading && <Spinner />}

      {!isLoading && !exercicios?.length && (
        <Empty icon={ClipboardList} title="Nenhum exercício cadastrado" description="Adicione exercícios ao catálogo." />
      )}

      {Object.entries(grupos).map(([grupo, exs]) => (
        <div key={grupo} className="mb-6">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{grupo}</h2>
          <Card className="overflow-hidden">
            <div className="divide-y divide-gray-100">
              {(exs ?? []).map(ex => (
                <div key={ex.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="flex-1">
                    <span className="text-sm font-medium text-gray-900">{ex.nome}</span>
                    {ex.descricao && (
                      <p className="text-xs text-gray-500 mt-0.5 truncate max-w-lg">{ex.descricao}</p>
                    )}
                  </div>
                  {ex.video_url && (
                    <a href={ex.video_url} target="_blank" rel="noreferrer"
                      className="text-xs text-blue-600 hover:underline">Vídeo</a>
                  )}
                  {isAdmin && (
                    <button onClick={() => abrirModal(ex)}
                      className="text-xs text-gray-400 hover:text-gray-700 transition-colors">
                      Editar
                    </button>
                  )}
                </div>
              ))}
            </div>
          </Card>
        </div>
      ))}

      <Modal open={modal} onClose={() => setModal(false)} title={editId ? 'Editar exercício' : 'Novo exercício'}>
        <div className="space-y-4">
          <Input label="Nome *" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} required />
          <Input label="Grupo muscular" value={form.grupo_muscular} onChange={e => setForm(f => ({ ...f, grupo_muscular: e.target.value }))} placeholder="Ex: Rotadores de ombro" />
          <Input label="Descrição" value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} placeholder="Breve descrição da execução" />
          <Input label="URL do vídeo" value={form.video_url} onChange={e => setForm(f => ({ ...f, video_url: e.target.value }))} placeholder="https://..." />
          <div className="flex gap-3 pt-2">
            <Button onClick={handleSalvar} loading={saving} disabled={!form.nome.trim()}>Salvar</Button>
            <Button variant="secondary" onClick={() => setModal(false)}>Cancelar</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
