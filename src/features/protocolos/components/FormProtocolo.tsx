import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { RichTextEditor } from '@/components/ui/RichTextEditor'
import { criarProtocolo } from '../api'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { useAuth } from '@/lib/AuthContext'
import {
  FaseEditorProtocolo,
  flattenFases,
  novaFase,
  novoObjetivo,
  type FaseForm,
} from './FaseEditorProtocolo'

async function listarCatalogo() {
  const { data, error } = await supabaseAdmin
    .from('exercicio')
    .select('id, nome, grupo_muscular')
    .eq('ativo', true)
    .order('nome')
  if (error) throw error
  return data ?? []
}

export function FormProtocolo() {
  const { profissional } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const { data: exerciciosCatalogo, isLoading: loadingCatalogo } = useQuery({
    queryKey: ['exercicios-catalogo-admin'],
    queryFn: listarCatalogo,
  })

  const [form, setForm] = useState({ nome: '', lesao: '', descricao: '', referencia: '' })

  const [fases, setFases] = useState<FaseForm[]>([{
    nome: 'Fase 1 — Controle da dor e inflamação',
    semana_inicio: 1,
    semana_fim: 4,
    objetivos: [novoObjetivo()],
    expanded: true,
  }])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!profissional) return
    setErro(null)
    setLoading(true)
    try {
      const id = await criarProtocolo({
        protocolo: {
          nome: form.nome,
          lesao: form.lesao,
          descricao: form.descricao,
          referencia: form.referencia,
          autor_id: profissional.id,
        },
        fases: flattenFases(fases),
      })
      navigate(`/protocolos/${id}`)
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao salvar protocolo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      <div className="space-y-4">
        <Input label="Nome do protocolo *" required value={form.nome}
          onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
          placeholder="Ex: Protocolo pós-LCA" />
        <Input label="Lesão / Condição *" required value={form.lesao}
          onChange={e => setForm(f => ({ ...f, lesao: e.target.value }))}
          placeholder="Ex: Ruptura do LCA, Lesão do manguito…" />
      </div>

      <RichTextEditor
        label="Descrição clínica"
        placeholder="Contexto, indicações, contraindicações…"
        value={form.descricao}
        onChange={v => setForm(f => ({ ...f, descricao: v }))}
        minHeight={100}
      />

      <Input label="Referência bibliográfica" value={form.referencia}
        onChange={e => setForm(f => ({ ...f, referencia: e.target.value }))}
        placeholder="Ex: Manske RC et al., JOSPT 2012…" />

      <FaseEditorProtocolo
        fases={fases}
        onChange={setFases}
        exerciciosCatalogo={exerciciosCatalogo ?? []}
        loadingCatalogo={loadingCatalogo}
      />

      {erro && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">{erro}</p>}

      <div className="flex gap-3 pt-2">
        <Button type="submit" loading={loading}>Salvar protocolo</Button>
        <Button type="button" variant="secondary" onClick={() => navigate('/protocolos')}>Cancelar</Button>
      </div>
    </form>
  )
}
