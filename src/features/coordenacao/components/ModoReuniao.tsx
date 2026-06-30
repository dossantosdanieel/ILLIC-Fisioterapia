import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ChevronRight, MessageSquare, AlertTriangle, TrendingDown, Clock } from 'lucide-react'
import { listarPacientesParaCoordenador } from '../api'
import { listarCheckinsDoPaciente, listarNotasDoPaciente, criarNota } from '../api'
import type { PacienteComAtencao } from '../api'
import { useAuth } from '@/lib/AuthContext'
import { useQueryClient } from '@tanstack/react-query'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { formatarData } from '@/features/planos/utils'
import { prioridadeBadge, prioridadeLabel } from '@/features/pacientes/api'

interface Props {
  fisioFiltro?: string
}

export function ModoReuniao({ fisioFiltro = '' }: Props) {
  const { profissional } = useAuth()
  const [pacienteAberto, setPacienteAberto] = useState<string | null>(null)

  const { data: pacientes, isLoading } = useQuery({
    queryKey: ['pacientes-coord', fisioFiltro],
    queryFn: () => listarPacientesParaCoordenador(fisioFiltro || undefined),
  })

  // Filtrar apenas os que precisam atenção
  const aCases = (pacientes ?? [])
    .filter(p => p.nivel_atencao !== 'ok')
    .sort((a, b) => {
      const ordem: Record<string, number> = { vencido: 0, alerta: 1, reav_semana: 2, checkin_pendente: 3 }
      return (ordem[a.nivel_atencao] ?? 4) - (ordem[b.nivel_atencao] ?? 4)
    })

  if (isLoading) return <Spinner />

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-base font-semibold text-gray-900">Reunião semanal</h2>
        <span className="text-sm text-gray-500">— {aCases.length} caso{aCases.length !== 1 ? 's' : ''} a discutir</span>
      </div>

      {aCases.length === 0 && (
        <div className="py-12 text-center text-gray-400 text-sm">
          Nenhum caso requer atenção esta semana 🎉
        </div>
      )}

      {aCases.map(p => (
        <div key={p.id} className="border border-gray-200 rounded-lg overflow-hidden">
          {/* Cabeçalho do caso */}
          <button
            onClick={() => setPacienteAberto(pacienteAberto === p.id ? null : p.id)}
            className="w-full flex items-center gap-3 px-4 py-3 bg-white hover:bg-gray-50 transition-colors text-left"
          >
            <IconeNivel nivel={p.nivel_atencao} />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-900">{p.nome}</span>
                <Badge variant={prioridadeBadge(p.prioridade)}>{prioridadeLabel(p.prioridade)}</Badge>
                {p.motivo_atencao.map((m, i) => (
                  <span key={i} className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{m}</span>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                {p.fisio_nome}
                {p.semana_atual !== null && p.prognostico_semanas && ` · Sem. ${p.semana_atual}/${p.prognostico_semanas}`}
              </p>
            </div>
            <ChevronRight size={16} className={`text-gray-400 transition-transform ${pacienteAberto === p.id ? 'rotate-90' : ''}`} />
          </button>

          {/* Painel expandido */}
          {pacienteAberto === p.id && profissional && (
            <PainelCasoPaciente paciente={p} autorId={profissional.id} />
          )}
        </div>
      ))}
    </div>
  )
}

function IconeNivel({ nivel }: { nivel: string }) {
  if (nivel === 'vencido') return <AlertTriangle size={16} className="text-red-500 shrink-0" />
  if (nivel === 'alerta') return <TrendingDown size={16} className="text-orange-500 shrink-0" />
  if (nivel === 'reav_semana') return <Clock size={16} className="text-amber-500 shrink-0" />
  return <MessageSquare size={16} className="text-gray-400 shrink-0" />
}

function PainelCasoPaciente({ paciente, autorId }: { paciente: PacienteComAtencao; autorId: string }) {
  const qc = useQueryClient()
  const [nota, setNota] = useState('')
  const [acao, setAcao] = useState('')
  const [saving, setSaving] = useState(false)

  const { data: checkins } = useQuery({
    queryKey: ['checkins', paciente.id],
    queryFn: () => listarCheckinsDoPaciente(paciente.id),
  })

  const { data: notas } = useQuery({
    queryKey: ['notas', paciente.id],
    queryFn: () => listarNotasDoPaciente(paciente.id),
  })

  interface CheckinRow { trajetoria: string; confianca: string; aderencia: string; sinal_alerta: string | null; precisa_discutir: boolean }
  interface NotaRow { id: string; data: string; texto: string; acao_definida: string | null; autor: { nome: string } | null }
  const ultimoCheckin = checkins?.[0] as CheckinRow | undefined

  async function handleSalvarNota() {
    if (!nota.trim()) return
    setSaving(true)
    try {
      await criarNota({
        paciente_id: paciente.id,
        autor_id: autorId,
        data: new Date().toISOString().split('T')[0],
        texto: nota.trim(),
        acao_definida: acao.trim() || null,
      })
      setNota('')
      setAcao('')
      qc.invalidateQueries({ queryKey: ['notas', paciente.id] })
    } finally { setSaving(false) }
  }

  const labelTrajetoria: Record<string, string> = {
    melhorando: '↑ Melhorando', estavel: '→ Estável', piorando: '↓ Piorando',
  }
  const labelConfianca: Record<string, string> = {
    no_caminho: 'No caminho', em_risco: 'Em risco', preciso_rever: 'Rever prognóstico',
  }
  const labelAderencia: Record<string, string> = {
    boa: 'Boa', parcial: 'Parcial', baixa: 'Baixa',
  }

  return (
    <div className="border-t border-gray-100 bg-gray-50 px-4 py-4 space-y-4">
      {/* Último check-in */}
      {ultimoCheckin ? (
        <div className="grid grid-cols-3 gap-3 text-xs">
          <div className="bg-white rounded p-2 border border-gray-100">
            <p className="text-gray-500 mb-0.5">Trajetória</p>
            <p className={`font-semibold ${ultimoCheckin.trajetoria === 'piorando' ? 'text-red-600' : ultimoCheckin.trajetoria === 'melhorando' ? 'text-green-600' : 'text-blue-600'}`}>
              {labelTrajetoria[ultimoCheckin.trajetoria] ?? ultimoCheckin.trajetoria}
            </p>
          </div>
          <div className="bg-white rounded p-2 border border-gray-100">
            <p className="text-gray-500 mb-0.5">Confiança</p>
            <p className={`font-semibold ${ultimoCheckin.confianca === 'no_caminho' ? 'text-green-600' : 'text-amber-600'}`}>
              {labelConfianca[ultimoCheckin.confianca] ?? ultimoCheckin.confianca}
            </p>
          </div>
          <div className="bg-white rounded p-2 border border-gray-100">
            <p className="text-gray-500 mb-0.5">Aderência</p>
            <p className={`font-semibold ${ultimoCheckin.aderencia === 'boa' ? 'text-green-600' : ultimoCheckin.aderencia === 'parcial' ? 'text-amber-600' : 'text-red-600'}`}>
              {labelAderencia[ultimoCheckin.aderencia] ?? ultimoCheckin.aderencia}
            </p>
          </div>
          {ultimoCheckin.sinal_alerta && (
            <div className="col-span-3 bg-red-50 border border-red-100 rounded p-2">
              <p className="text-red-700">⚠ {ultimoCheckin.sinal_alerta}</p>
            </div>
          )}
        </div>
      ) : (
        <p className="text-xs text-gray-400 italic">Sem check-in registrado.</p>
      )}

      {/* Notas anteriores */}
      {(notas ?? []).length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-gray-500">Notas anteriores</p>
          {(notas as unknown as NotaRow[]).slice(0, 2).map(n => (
            <div key={n.id} className="bg-white border border-gray-100 rounded p-2">
              <p className="text-xs text-gray-400 mb-0.5">{formatarData(n.data)} · {n.autor?.nome}</p>
              <p className="text-xs text-gray-700">{n.texto}</p>
              {n.acao_definida && <p className="text-xs text-blue-600 mt-1">→ {n.acao_definida}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Nova nota */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-gray-600">Nova nota de reunião</p>
        <textarea
          value={nota}
          onChange={e => setNota(e.target.value)}
          placeholder="Discussão, decisão, orientação ao fisio…"
          rows={2}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
        <input
          type="text"
          value={acao}
          onChange={e => setAcao(e.target.value)}
          placeholder="Ação definida (opcional)"
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div className="flex gap-2">
          <Button size="sm" onClick={handleSalvarNota} loading={saving} disabled={!nota.trim()}>
            Salvar nota
          </Button>
          <Link
            to={`/coordenacao/paciente/${paciente.id}`}
            className="text-xs text-blue-600 hover:underline self-center"
          >
            Ver perfil completo →
          </Link>
        </div>
      </div>
    </div>
  )
}
