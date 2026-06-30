import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/AuthContext'
import { criarPaciente, buscarPacientesPorNome } from '../api'
import { listarProfissionais } from '@/features/coordenacao/api'
import { AlertTriangle, ExternalLink } from 'lucide-react'

const PRIORIDADES = [
  { value: 'alta', label: 'Alta' },
  { value: 'moderada', label: 'Moderada' },
  { value: 'baixa', label: 'Baixa' },
]

type Duplicata = { id: string; nome: string; diagnostico: string | null; profissional: { nome: string } | null }

export function FormPaciente() {
  const { profissional } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [duplicatas, setDuplicatas] = useState<Duplicata[]>([])
  const [forcarCadastro, setForcarCadastro] = useState(false)
  const [checandoDuplicata, setChecandoDuplicata] = useState(false)

  const isAdminOuCoord = profissional?.papeis?.some(p => p === 'coordenador' || p === 'admin') ?? false

  const { data: profissionais } = useQuery({
    queryKey: ['profissionais'],
    queryFn: listarProfissionais,
  })
  const fisios = (profissionais ?? []).filter(p => p.papeis?.includes('fisioterapeuta'))
  const fisiosOpts = fisios.map(f => ({ value: f.id, label: f.nome }))

  const [form, setForm] = useState({
    nome: '',
    data_nascimento: '',
    diagnostico: '',
    prioridade: 'moderada',
    convenio_plano: '',
    fisio_responsavel_id: fisios[0]?.id ?? '',
    consentimento_lgpd: false,
  })

  const fisioId = form.fisio_responsavel_id || fisios[0]?.id || ''

  function set(field: string, value: string | boolean) {
    setForm(f => ({ ...f, [field]: value }))
    if (field === 'nome') {
      setDuplicatas([])
      setForcarCadastro(false)
    }
  }

  async function handleNomeBlur() {
    const nome = form.nome.trim()
    if (nome.length < 3) return
    setChecandoDuplicata(true)
    try {
      const encontrados = await buscarPacientesPorNome(nome)
      setDuplicatas(encontrados)
      if (encontrados.length > 0) setForcarCadastro(false)
    } finally {
      setChecandoDuplicata(false)
    }
  }

  const bloqueadoPorDuplicata = duplicatas.length > 0 && !forcarCadastro

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!profissional) return
    if (bloqueadoPorDuplicata) return
    if (!fisioId) {
      setErro('Selecione o fisioterapeuta responsável.')
      return
    }
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
        hipotese_diagnostica: null,
        prioridade: form.prioridade as 'alta' | 'moderada' | 'baixa',
        convenio_plano: form.convenio_plano || null,
        fisio_responsavel_id: fisioId,
        consentimento_lgpd: true,
        data_consentimento: new Date().toISOString(),
        ativo: true,
      })
      qc.invalidateQueries({ queryKey: ['pacientes'] })
      navigate(`/pacientes/${paciente.id}`)
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao cadastrar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-xl">

      <div>
        <Input
          label="Nome completo *"
          required
          value={form.nome}
          onChange={e => set('nome', e.target.value)}
          onBlur={handleNomeBlur}
          placeholder="Nome do paciente"
        />
        {checandoDuplicata && (
          <p className="text-xs text-gray-400 mt-1">Verificando cadastros existentes…</p>
        )}
      </div>

      {/* Aviso de duplicata */}
      {duplicatas.length > 0 && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-4 space-y-3">
          <div className="flex items-start gap-2">
            <AlertTriangle size={16} className="text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-800">
                {duplicatas.length === 1
                  ? 'Já existe um paciente cadastrado com este nome:'
                  : `Já existem ${duplicatas.length} pacientes cadastrados com este nome:`}
              </p>
              <ul className="mt-2 space-y-1.5">
                {duplicatas.map(d => (
                  <li key={d.id} className="flex items-center gap-2">
                    <Link
                      to={`/pacientes/${d.id}`}
                      target="_blank"
                      className="text-sm text-amber-700 font-medium underline underline-offset-2 hover:text-amber-900 flex items-center gap-1"
                    >
                      {d.nome} <ExternalLink size={12} />
                    </Link>
                    {d.diagnostico && (
                      <span className="text-xs text-amber-600">— {d.diagnostico}</span>
                    )}
                    {d.profissional && (
                      <span className="text-xs text-amber-500">({d.profissional.nome})</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {isAdminOuCoord ? (
            <div className="flex items-center gap-3 pt-1 border-t border-amber-200">
              <p className="text-xs text-amber-700 flex-1">
                Como coordenador/admin, você pode prosseguir com o cadastro mesmo assim.
              </p>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => setForcarCadastro(true)}
              >
                Cadastrar mesmo assim
              </Button>
            </div>
          ) : (
            <p className="text-xs text-amber-700 border-t border-amber-200 pt-2">
              Para cadastrar um paciente com o mesmo nome, fale com a coordenação.
            </p>
          )}
        </div>
      )}

      {forcarCadastro && (
        <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 flex items-center justify-between">
          <p className="text-xs text-blue-700">Cadastro duplicado autorizado pela coordenação.</p>
          <button
            type="button"
            className="text-xs text-blue-500 underline"
            onClick={() => setForcarCadastro(false)}
          >
            Cancelar
          </button>
        </div>
      )}

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
        placeholder="Ex: Norden, Particular…"
      />

      <div>
        <Select
          label="Fisioterapeuta responsável *"
          options={fisiosOpts}
          value={fisioId}
          onChange={e => set('fisio_responsavel_id', e.target.value)}
          placeholder={fisios.length === 0 ? 'Nenhum fisioterapeuta cadastrado' : 'Selecione…'}
        />
        {fisios.length === 0 && (
          <p className="text-xs text-amber-600 mt-1">
            Nenhum fisioterapeuta ativo encontrado. Cadastre profissionais antes de adicionar pacientes.
          </p>
        )}
      </div>

      {/* Consentimento LGPD */}
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

      {erro && (
        <div className="px-3 py-2.5 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-700">{erro}</p>
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <Button
          type="submit"
          loading={loading}
          disabled={fisios.length === 0 || bloqueadoPorDuplicata}
        >
          Cadastrar paciente
        </Button>
        <Button type="button" variant="secondary" onClick={() => navigate('/pacientes')}>
          Cancelar
        </Button>
      </div>
    </form>
  )
}
