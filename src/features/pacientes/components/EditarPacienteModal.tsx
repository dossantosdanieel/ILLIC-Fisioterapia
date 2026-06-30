import { useState, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useQuery } from '@tanstack/react-query'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { atualizarPaciente } from '../api'
import { listarProfissionais } from '@/features/coordenacao/api'
import type { PacienteDetalhe } from '@/types/queries'

const PRIORIDADES = [
  { value: 'alta', label: 'Alta' },
  { value: 'moderada', label: 'Moderada' },
  { value: 'baixa', label: 'Baixa' },
]

interface Props {
  open: boolean
  onClose: () => void
  paciente: PacienteDetalhe
}

export function EditarPacienteModal({ open, onClose, paciente }: Props) {
  const qc = useQueryClient()
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const [form, setForm] = useState({
    nome: paciente.nome,
    data_nascimento: paciente.data_nascimento ?? '',
    diagnostico: paciente.diagnostico ?? '',
    prioridade: paciente.prioridade,
    convenio_plano: paciente.convenio_plano ?? '',
    fisio_responsavel_id: (paciente.profissional as any)?.id ?? '',
  })

  useEffect(() => {
    if (open) {
      setForm({
        nome: paciente.nome,
        data_nascimento: paciente.data_nascimento ?? '',
        diagnostico: paciente.diagnostico ?? '',
        prioridade: paciente.prioridade,
        convenio_plano: paciente.convenio_plano ?? '',
        fisio_responsavel_id: (paciente.profissional as any)?.id ?? '',
      })
      setErro(null)
    }
  }, [open, paciente])

  const { data: profissionais } = useQuery({
    queryKey: ['profissionais'],
    queryFn: listarProfissionais,
  })
  const fisios = (profissionais ?? []).filter(p => p.papeis?.includes('fisioterapeuta'))
  const fisiosOpts = fisios.map(f => ({ value: f.id, label: f.nome }))

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nome.trim()) { setErro('Nome é obrigatório.'); return }
    setErro(null)
    setLoading(true)
    try {
      await atualizarPaciente(paciente.id, {
        nome: form.nome.trim(),
        data_nascimento: form.data_nascimento || null,
        diagnostico: form.diagnostico || null,
        prioridade: form.prioridade as 'alta' | 'moderada' | 'baixa',
        convenio_plano: form.convenio_plano || null,
        fisio_responsavel_id: form.fisio_responsavel_id || null,
      })
      qc.invalidateQueries({ queryKey: ['paciente', paciente.id] })
      qc.invalidateQueries({ queryKey: ['pacientes'] })
      onClose()
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Editar paciente">
      <form onSubmit={handleSubmit} className="space-y-4 mt-2">
        <Input
          label="Nome completo *"
          required
          value={form.nome}
          onChange={e => set('nome', e.target.value)}
        />

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Data de nascimento"
            type="date"
            value={form.data_nascimento}
            onChange={e => set('data_nascimento', e.target.value)}
          />
          <Select
            label="Prioridade *"
            options={PRIORIDADES}
            value={form.prioridade}
            onChange={e => set('prioridade', e.target.value)}
          />
        </div>

        <Textarea
          label="Diagnóstico / Hipótese diagnóstica"
          value={form.diagnostico}
          onChange={e => set('diagnostico', e.target.value)}
          rows={2}
        />

        <Input
          label="Convênio / Plano"
          value={form.convenio_plano}
          onChange={e => set('convenio_plano', e.target.value)}
          placeholder="Ex: Unimed, Particular…"
        />

        {fisiosOpts.length > 0 && (
          <Select
            label="Fisioterapeuta responsável"
            options={fisiosOpts}
            value={form.fisio_responsavel_id}
            onChange={e => set('fisio_responsavel_id', e.target.value)}
          />
        )}

        {erro && <p className="text-sm text-red-600">{erro}</p>}

        <div className="flex gap-3 pt-1">
          <Button type="submit" loading={loading}>Salvar alterações</Button>
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
        </div>
      </form>
    </Modal>
  )
}
