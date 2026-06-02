import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/AuthContext'
import { criarPaciente } from '../api'

const PRIORIDADES = [
  { value: 'alta', label: 'Alta' },
  { value: 'moderada', label: 'Moderada' },
  { value: 'baixa', label: 'Baixa' },
]

export function FormPaciente() {
  const { profissional } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const [form, setForm] = useState({
    nome: '',
    data_nascimento: '',
    diagnostico: '',
    hipotese_diagnostica: '',
    prioridade: 'moderada',
    convenio_plano: '',
    consentimento_lgpd: false,
  })

  function set(field: string, value: string | boolean) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!profissional) return
    if (!form.consentimento_lgpd) {
      setErro('É necessário registrar o consentimento LGPD antes de cadastrar.')
      return
    }
    setErro(null)
    setLoading(true)
    try {
      const paciente = await criarPaciente({
        nome: form.nome,
        data_nascimento: form.data_nascimento || null,
        diagnostico: form.diagnostico || null,
        hipotese_diagnostica: form.hipotese_diagnostica || null,
        prioridade: form.prioridade as 'alta' | 'moderada' | 'baixa',
        convenio_plano: form.convenio_plano || null,
        fisio_responsavel_id: profissional.id,
        consentimento_lgpd: true,
        data_consentimento: new Date().toISOString(),
        ativo: true,
      })
      navigate(`/pacientes/${paciente.id}`)
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao cadastrar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-xl">
      <Input
        label="Nome completo *"
        required
        value={form.nome}
        onChange={e => set('nome', e.target.value)}
        placeholder="Nome do paciente"
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
        placeholder="CID ou descrição clínica"
        rows={2}
      />

      <Input
        label="Convênio / Plano"
        value={form.convenio_plano}
        onChange={e => set('convenio_plano', e.target.value)}
        placeholder="Ex: Unimed, Particular…"
      />

      <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-md">
        <input
          type="checkbox"
          id="lgpd"
          checked={form.consentimento_lgpd}
          onChange={e => set('consentimento_lgpd', e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600"
        />
        <label htmlFor="lgpd" className="text-xs text-amber-800 cursor-pointer">
          <strong>Consentimento LGPD:</strong> O paciente foi informado sobre a coleta e uso dos seus dados
          de saúde para fins de monitoramento clínico interno, conforme a Lei Geral de Proteção de Dados
          (Lei 13.709/2018), e autorizou o armazenamento.
        </label>
      </div>

      {erro && <p className="text-sm text-red-600">{erro}</p>}

      <div className="flex gap-3 pt-2">
        <Button type="submit" loading={loading}>Cadastrar paciente</Button>
        <Button type="button" variant="secondary" onClick={() => navigate('/pacientes')}>
          Cancelar
        </Button>
      </div>
    </form>
  )
}
