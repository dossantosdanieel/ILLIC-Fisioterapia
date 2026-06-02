import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { MessageSquare, Plus } from 'lucide-react'
import { listarNotasDoPaciente, criarNota } from '../api'
import { useAuth } from '@/lib/AuthContext'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Spinner } from '@/components/ui/spinner'
import { formatarData } from '@/features/planos/utils'

interface Props { pacienteId: string }

export function NotasReuniao({ pacienteId }: Props) {
  const { profissional } = useAuth()
  const qc = useQueryClient()
  const [texto, setTexto] = useState('')
  const [acao, setAcao] = useState('')
  const [saving, setSaving] = useState(false)
  const [aberto, setAberto] = useState(false)

  const { data: notas, isLoading } = useQuery({
    queryKey: ['notas', pacienteId],
    queryFn: () => listarNotasDoPaciente(pacienteId),
  })

  async function handleSalvar() {
    if (!texto.trim() || !profissional) return
    setSaving(true)
    try {
      await criarNota({
        paciente_id: pacienteId,
        autor_id: profissional.id,
        data: new Date().toISOString().split('T')[0],
        texto: texto.trim(),
        acao_definida: acao.trim() || null,
      })
      setTexto('')
      setAcao('')
      setAberto(false)
      qc.invalidateQueries({ queryKey: ['notas', pacienteId] })
    } finally { setSaving(false) }
  }

  if (isLoading) return <Spinner />

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Notas de reunião</h3>
        <button onClick={() => setAberto(!aberto)}
          className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium">
          <Plus size={13} /> Nova nota
        </button>
      </div>

      {aberto && (
        <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg space-y-3">
          <Textarea
            label="Nota de reunião"
            placeholder="Discussão, contexto clínico, decisão tomada…"
            value={texto}
            onChange={e => setTexto(e.target.value)}
            rows={3}
          />
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Ação definida (opcional)</label>
            <input
              type="text"
              placeholder="Ex: Solicitar reavaliação imagiológica, ajustar protocolo…"
              value={acao}
              onChange={e => setAcao(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSalvar} loading={saving} disabled={!texto.trim()}>
              Salvar nota
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setAberto(false)}>Cancelar</Button>
          </div>
        </div>
      )}

      {notas?.length === 0 && !aberto && (
        <p className="text-xs text-gray-400 italic">Nenhuma nota de reunião registrada.</p>
      )}

      <div className="space-y-2">
        {((notas ?? []) as unknown as { id: string; data: string; texto: string; acao_definida: string | null; autor: { nome: string } | null }[]).map(nota => (
          <div key={nota.id} className="p-3 border border-gray-100 rounded-lg bg-white">
            <div className="flex items-center gap-2 mb-1">
              <MessageSquare size={12} className="text-gray-400" />
              <span className="text-xs text-gray-500">
                {formatarData(nota.data)} · {nota.autor?.nome}
              </span>
            </div>
            <p className="text-sm text-gray-800 whitespace-pre-wrap">{nota.texto}</p>
            {nota.acao_definida && (
              <div className="mt-2 pt-2 border-t border-gray-100">
                <span className="text-xs font-medium text-blue-700">→ Ação: </span>
                <span className="text-xs text-blue-600">{nota.acao_definida}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
