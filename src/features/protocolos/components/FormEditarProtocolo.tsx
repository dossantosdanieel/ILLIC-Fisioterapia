import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { RichTextEditor } from '@/components/ui/RichTextEditor'
import { atualizarProtocoloCompleto, type Protocolo } from '../api'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import {
  FaseEditorProtocolo,
  flattenFases,
  novoObjetivo,
  type FaseForm,
  type ObjetivoComExercicios,
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

/** Converte dados da API no formato do editor agrupando exercícios por objetivo */
function protocoloParaFases(protocolo: Protocolo): FaseForm[] {
  return [...protocolo.protocolo_fase]
    .sort((a, b) => a.ordem - b.ordem)
    .map(f => {
      // Monta mapa de objetivos preservando a ordem
      const objetivoMap: Record<string, ObjetivoComExercicios> = {}
      for (const obj of f.objetivos) {
        objetivoMap[obj.texto] = {
          texto: obj.texto,
          semana_inicio: obj.semana_inicio,
          semana_fim: obj.semana_fim,
          exercicios: [],
        }
      }

      // Distribui exercícios sob seus objetivos
      const sorted = [...f.protocolo_fase_exercicio].sort((a, b) => a.ordem - b.ordem)
      for (const ex of sorted) {
        const key = ex.objetivo_texto?.trim() ?? ''
        if (key && objetivoMap[key]) {
          objetivoMap[key].exercicios.push({
            exercicio_id: ex.exercicio_id,
            nota: ex.nota ?? '',
            semana_inicio: ex.semana_inicio ?? null,
            semana_fim: ex.semana_fim ?? null,
          })
        } else if (key) {
          // objetivo citado no exercício mas não estava na lista de objetivos
          objetivoMap[key] = {
            texto: key,
            semana_inicio: null,
            semana_fim: null,
            exercicios: [{
              exercicio_id: ex.exercicio_id,
              nota: ex.nota ?? '',
              semana_inicio: ex.semana_inicio ?? null,
              semana_fim: ex.semana_fim ?? null,
            }],
          }
        }
      }

      const objetivos = Object.values(objetivoMap)
      return {
        nome: f.nome,
        semana_inicio: f.semana_inicio,
        semana_fim: f.semana_fim,
        objetivos: objetivos.length ? objetivos : [novoObjetivo()],
        expanded: false,
      }
    })
}

export function FormEditarProtocolo({ protocolo }: { protocolo: Protocolo }) {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const { data: exerciciosCatalogo, isLoading: loadingCatalogo } = useQuery({
    queryKey: ['exercicios-catalogo-admin'],
    queryFn: listarCatalogo,
  })

  const [form, setForm] = useState({
    nome: protocolo.nome,
    lesao: protocolo.lesao,
    descricao: protocolo.descricao ?? '',
    referencia: protocolo.referencia ?? '',
  })

  const [fases, setFases] = useState<FaseForm[]>(() => protocoloParaFases(protocolo))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    setLoading(true)
    try {
      await atualizarProtocoloCompleto(protocolo.id, {
        protocolo: {
          nome: form.nome,
          lesao: form.lesao,
          descricao: form.descricao,
          referencia: form.referencia,
          autor_id: protocolo.autor_id ?? '',
        },
        fases: flattenFases(fases),
      })
      qc.invalidateQueries({ queryKey: ['protocolo', protocolo.id] })
      qc.invalidateQueries({ queryKey: ['protocolos'] })
      navigate(`/protocolos/${protocolo.id}`)
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao salvar.')
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
        <Button type="submit" loading={loading}>Salvar alterações</Button>
        <Button type="button" variant="secondary" onClick={() => navigate(`/protocolos/${protocolo.id}`)}>Cancelar</Button>
      </div>
    </form>
  )
}
