import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, Plus, Calendar, User } from 'lucide-react'
import { buscarPaciente, prioridadeBadge, prioridadeLabel } from '@/features/pacientes/api'
import { listarPlanosDoPaciente } from '@/features/planos/api'
import { PainelPlano } from '@/features/planos/components/PainelPlano'
import { LinhaDoTempoGantt } from '@/features/planos/components/LinhaDoTempoGantt'
import { HistoricoAvaliacoes } from '@/features/avaliacoes/components/HistoricoAvaliacoes'
import { HistoricoSessoes } from '@/features/sessoes/components/HistoricoSessoes'
import { BotaoGerarPDF } from '@/features/performance/components/GerarPDF'
import { Badge } from '@/components/ui/badge'
import { Card, CardBody } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { Button } from '@/components/ui/button'
import { formatarData } from '@/features/planos/utils'
import { useState } from 'react'
import { useAuth } from '@/lib/AuthContext'
import type { PacienteDetalhe } from '@/types/queries'

type Tab = 'plano' | 'sessoes' | 'avaliacoes'

export default function PacienteDetalhePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { profissional } = useAuth()
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
  const podeGerenciarPlano =
    profissional?.papeis?.some(p => p === 'coordenador' || p === 'admin')

  const TABS: { key: Tab; label: string }[] = [
    { key: 'plano', label: 'Plano de tratamento' },
    { key: 'sessoes', label: 'Sessões' },
    { key: 'avaliacoes', label: 'Avaliações' },
  ]

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Link to="/pacientes" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 mb-5">
        <ChevronLeft size={16} /> Pacientes
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-lg font-semibold text-gray-900">{p.nome}</h1>
            <Badge variant={prioridadeBadge(p.prioridade)}>{prioridadeLabel(p.prioridade)}</Badge>
          </div>
          <div className="flex items-center gap-4 mt-1.5 text-xs text-gray-500">
            {p.data_nascimento && (
              <span className="flex items-center gap-1"><Calendar size={12} /> {formatarData(p.data_nascimento)}</span>
            )}
            {p.convenio_plano && <span>{p.convenio_plano}</span>}
            {p.profissional && (
              <span className="flex items-center gap-1"><User size={12} /> {p.profissional.nome}</span>
            )}
          </div>
          {p.diagnostico && <p className="text-sm text-gray-600 mt-1.5">{p.diagnostico}</p>}
        </div>

        <div className="flex gap-2">
          <Button variant="secondary" size="sm"
            onClick={() => navigate(`/pacientes/${id}/checkin`)}>
            Check-in
          </Button>
          <Button variant="secondary" size="sm"
            onClick={() => navigate(`/pacientes/${id}/avaliacoes/nova${planoAtivo ? `?plano=${planoAtivo.id}` : ''}`)}>
            <Plus size={14} /> Avaliação
          </Button>
          {!planoAtivo && podeGerenciarPlano && (
            <Button size="sm" onClick={() => navigate(`/pacientes/${id}/plano/novo`)}>
              <Plus size={14} /> Criar plano
            </Button>
          )}
        </div>
      </div>

      {/* Linha do tempo — sempre visível quando há plano */}
      {planoAtivo && (
        <div className="mb-6 p-5 bg-white border border-gray-200 rounded-xl shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Linha do tempo</h2>
              <p className="text-xs text-gray-400 mt-0.5">Clique em uma fase para ver e editar os objetivos</p>
            </div>
          </div>
          <LinhaDoTempoGantt planoId={planoAtivo.id} />
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center border-b border-gray-200 mb-5">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}>
            {t.label}
          </button>
        ))}
        <div className="ml-auto pr-0.5">
          <BotaoGerarPDF pacienteId={id!} pacienteNome={p.nome} />
        </div>
      </div>

      {tab === 'plano' && (
        planoAtivo
          ? <PainelPlano planoId={planoAtivo.id} pacienteId={id!} />
          : (
            <Card><CardBody>
              <div className="flex flex-col items-center py-10 text-center">
                <p className="text-sm text-gray-500 mb-3">Nenhum plano de tratamento ativo</p>
                {podeGerenciarPlano && (
                  <Button onClick={() => navigate(`/pacientes/${id}/plano/novo`)}>
                    <Plus size={14} /> Criar plano de tratamento
                  </Button>
                )}
                {!podeGerenciarPlano && (
                  <p className="text-xs text-gray-400">
                    Aguardando o coordenador ou admin criar o plano.
                  </p>
                )}
              </div>
            </CardBody></Card>
          )
      )}

      {tab === 'sessoes' && (
        <Card className="overflow-hidden">
          <HistoricoSessoes pacienteId={id!} planoId={planoAtivo?.id} />
        </Card>
      )}

      {tab === 'avaliacoes' && (
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-900">Histórico de avaliações</h3>
            <Button size="sm" variant="secondary"
              onClick={() => navigate(`/pacientes/${id}/avaliacoes/nova${planoAtivo ? `?plano=${planoAtivo.id}` : ''}`)}>
              <Plus size={14} /> Nova avaliação
            </Button>
          </div>
          <HistoricoAvaliacoes pacienteId={id!} planoId={planoAtivo?.id} />
        </Card>
      )}
    </div>
  )
}
