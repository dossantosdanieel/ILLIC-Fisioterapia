import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Clock, MessageCircle, TrendingDown, Users } from 'lucide-react'
import { listarPacientesParaCoordenador } from '../api'
import type { PacienteComAtencao, NivelAtencao } from '../api'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { prioridadeBadge, prioridadeLabel } from '@/features/pacientes/api'

const COR_NIVEL: Record<NivelAtencao, string> = {
  vencido: 'border-l-4 border-l-red-500',
  reav_semana: 'border-l-4 border-l-amber-400',
  alerta: 'border-l-4 border-l-orange-400',
  checkin_pendente: 'border-l-4 border-l-gray-300',
  ok: '',
}

const ICONE_NIVEL: Record<NivelAtencao, React.ReactNode> = {
  vencido: <AlertTriangle size={15} className="text-red-500" />,
  reav_semana: <Clock size={15} className="text-amber-500" />,
  alerta: <TrendingDown size={15} className="text-orange-500" />,
  checkin_pendente: <MessageCircle size={15} className="text-gray-400" />,
  ok: null,
}

const ORDEM_NIVEL: Record<NivelAtencao, number> = {
  vencido: 0, alerta: 1, reav_semana: 2, checkin_pendente: 3, ok: 4,
}

const PRIORIDADE_ORDEM: Record<string, number> = { alta: 0, moderada: 1, baixa: 2 }

interface Props {
  fisioFiltro?: string
}

export function PainelCoordenador({ fisioFiltro = '' }: Props) {
  const [nivelFiltro, setNivelFiltro] = useState<NivelAtencao | ''>('')

  const { data: pacientes, isLoading } = useQuery({
    queryKey: ['pacientes-coord', fisioFiltro],
    queryFn: () => listarPacientesParaCoordenador(fisioFiltro || undefined),
  })

  // Totais para os cartões de resumo
  const totalVencidos = (pacientes ?? []).filter(p => p.nivel_atencao === 'vencido').length
  const totalAlertas = (pacientes ?? []).filter(p => p.nivel_atencao === 'alerta').length
  const totalPendentes = (pacientes ?? []).filter(p => p.nivel_atencao === 'checkin_pendente').length
  const totalOk = (pacientes ?? []).filter(p => p.nivel_atencao === 'ok').length

  // Ordenar e filtrar
  const ordenados = [...(pacientes ?? [])]
    .filter(p => !nivelFiltro || p.nivel_atencao === nivelFiltro)
    .sort((a, b) => {
      const nivelDiff = ORDEM_NIVEL[a.nivel_atencao] - ORDEM_NIVEL[b.nivel_atencao]
      if (nivelDiff !== 0) return nivelDiff
      return (PRIORIDADE_ORDEM[a.prioridade] ?? 1) - (PRIORIDADE_ORDEM[b.prioridade] ?? 1)
    })

  return (
    <div className="space-y-5">
      {/* Cartões de resumo */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Vencidos', valor: totalVencidos, cor: 'text-red-600', bg: 'bg-red-50', nivel: 'vencido' as NivelAtencao },
          { label: 'Alertas', valor: totalAlertas, cor: 'text-orange-600', bg: 'bg-orange-50', nivel: 'alerta' as NivelAtencao },
          { label: 'Check-in pendente', valor: totalPendentes, cor: 'text-gray-600', bg: 'bg-gray-50', nivel: 'checkin_pendente' as NivelAtencao },
          { label: 'No prazo', valor: totalOk, cor: 'text-green-600', bg: 'bg-green-50', nivel: 'ok' as NivelAtencao },
        ].map(c => (
          <button
            key={c.label}
            onClick={() => setNivelFiltro(nivelFiltro === c.nivel ? '' : c.nivel)}
            className={`${c.bg} rounded-lg p-4 text-left transition-all ${nivelFiltro === c.nivel ? 'ring-2 ring-offset-1 ring-blue-400' : 'hover:shadow-sm'}`}
          >
            <div className={`text-2xl font-bold ${c.cor}`}>{c.valor}</div>
            <div className="text-xs text-gray-600 mt-0.5">{c.label}</div>
          </button>
        ))}
      </div>

      {/* Contador e filtro de nível */}
      <div className="flex items-center gap-3">
        {nivelFiltro && (
          <button onClick={() => setNivelFiltro('')}
            className="text-xs text-blue-600 hover:underline">
            Limpar filtro de atenção
          </button>
        )}
        <span className="text-xs text-gray-400 ml-auto">
          {ordenados.length} paciente{ordenados.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Lista de pacientes */}
      {isLoading ? <Spinner /> : (
        <Card className="overflow-hidden">
          <div className="divide-y divide-gray-100">
            {ordenados.length === 0 && (
              <div className="flex flex-col items-center py-12">
                <Users size={28} className="text-gray-300 mb-2" />
                <p className="text-sm text-gray-500">Nenhum paciente encontrado</p>
              </div>
            )}
            {ordenados.map(p => (
              <PacienteRow key={p.id} p={p} />
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}

function PacienteRow({ p }: { p: PacienteComAtencao }) {
  const checkinLabel = {
    melhorando: '↑ Melhorando',
    estavel: '→ Estável',
    piorando: '↓ Piorando',
  }
  const confiancaLabel = {
    no_caminho: 'No caminho',
    em_risco: 'Em risco',
    preciso_rever: 'Rever prognóstico',
  }

  return (
    <Link
      to={`/coordenacao/paciente/${p.id}`}
      className={`flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors ${COR_NIVEL[p.nivel_atencao]}`}
    >
      <div className="shrink-0">{ICONE_NIVEL[p.nivel_atencao]}</div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-gray-900">{p.nome}</span>
          <Badge variant={prioridadeBadge(p.prioridade)}>{prioridadeLabel(p.prioridade)}</Badge>
          {p.motivo_atencao.map((m, i) => (
            <span key={i} className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">{m}</span>
          ))}
        </div>
        <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
          <span>{p.fisio_nome}</span>
          {p.semana_atual !== null && p.prognostico_semanas && (
            <span>Sem. {p.semana_atual}/{p.prognostico_semanas}</span>
          )}
          {p.ultimo_checkin_trajetoria && (
            <span className={p.ultimo_checkin_trajetoria === 'piorando' ? 'text-red-600 font-medium' : ''}>
              {checkinLabel[p.ultimo_checkin_trajetoria as keyof typeof checkinLabel]}
            </span>
          )}
          {p.ultimo_checkin_confianca && p.ultimo_checkin_confianca !== 'no_caminho' && (
            <span className="text-amber-600">
              {confiancaLabel[p.ultimo_checkin_confianca as keyof typeof confiancaLabel]}
            </span>
          )}
          {p.ultimo_checkin_discutir && (
            <span className="text-orange-600 font-medium">Discutir</span>
          )}
        </div>
      </div>
    </Link>
  )
}
