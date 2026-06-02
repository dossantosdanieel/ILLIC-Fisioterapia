import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, Plus } from 'lucide-react'
import { buscarPaciente, prioridadeBadge, prioridadeLabel } from '@/features/pacientes/api'
import { listarPlanosDoPaciente } from '@/features/planos/api'
import { PainelPlano } from '@/features/planos/components/PainelPlano'
import { HistoricoAvaliacoes } from '@/features/avaliacoes/components/HistoricoAvaliacoes'
import { NotasReuniao } from '@/features/coordenacao/components/NotasReuniao'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { Button } from '@/components/ui/button'
import { formatarData } from '@/features/planos/utils'
import { useState } from 'react'
import type { PacienteDetalhe } from '@/types/queries'

type Tab = 'plano' | 'avaliacoes' | 'notas'

export default function PacienteCoordenacaoPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('plano')

  const { data: pacienteRaw, isLoading } = useQuery({
    queryKey: ['paciente', id],
    queryFn: () => buscarPaciente(id!),
    enabled: !!id,
  })
  const { data: planos } = useQuery({
    queryKey: ['planos', id],
    queryFn: () => listarPlanosDoPaciente(id!),
    enabled: !!id,
  })

  if (isLoading) return <Spinner />
  if (!pacienteRaw) return null

  const p = pacienteRaw as PacienteDetalhe
  const planoAtivo = planos?.find(pl => pl.status === 'ativo') ?? planos?.[0]

  const TABS: { key: Tab; label: string }[] = [
    { key: 'plano', label: 'Plano' },
    { key: 'avaliacoes', label: 'Avaliações' },
    { key: 'notas', label: 'Notas de reunião' },
  ]

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Link to="/coordenacao" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 mb-5">
        <ChevronLeft size={16} /> Coordenação
      </Link>

      <div className="flex items-start justify-between mb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-lg font-semibold text-gray-900">{p.nome}</h1>
            <Badge variant={prioridadeBadge(p.prioridade)}>{prioridadeLabel(p.prioridade)}</Badge>
          </div>
          <div className="flex items-center gap-4 mt-1.5 text-xs text-gray-500">
            {p.data_nascimento && <span>{formatarData(p.data_nascimento)}</span>}
            {p.convenio_plano && <span>{p.convenio_plano}</span>}
            {p.profissional && <span>Fisio: {p.profissional.nome}</span>}
          </div>
          {p.diagnostico && <p className="text-sm text-gray-600 mt-1.5">{p.diagnostico}</p>}
        </div>
        <Button variant="secondary" size="sm"
          onClick={() => navigate(`/pacientes/${id}/avaliacoes/nova${planoAtivo ? `?plano=${planoAtivo.id}` : ''}`)}>
          <Plus size={14} /> Avaliação
        </Button>
      </div>

      <div className="flex border-b border-gray-200 mb-5">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'plano' && planoAtivo && (
        <PainelPlano planoId={planoAtivo.id} pacienteId={id!} />
      )}
      {tab === 'avaliacoes' && (
        <Card className="overflow-hidden">
          <HistoricoAvaliacoes pacienteId={id!} planoId={planoAtivo?.id} />
        </Card>
      )}
      {tab === 'notas' && (
        <Card className="p-5">
          <NotasReuniao pacienteId={id!} />
        </Card>
      )}
    </div>
  )
}
