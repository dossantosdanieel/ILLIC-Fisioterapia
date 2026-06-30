import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronRight, MessageSquare, AlertTriangle, TrendingDown, Clock, ChevronDown, ChevronUp, CalendarClock } from 'lucide-react'
import { listarPacientesParaCoordenador, listarCheckinsDoPaciente, listarNotasDoPaciente, criarNota, registrarCheckin, semanaISO } from '../api'
import type { PacienteComAtencao } from '../api'
import { useAuth } from '@/lib/AuthContext'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { formatarData } from '@/features/planos/utils'
import { prioridadeBadge, prioridadeLabel, atualizarPaciente } from '@/features/pacientes/api'

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

  const NIVEL_PESO: Record<string, number> = { vencido: 0, alerta: 1, reav_semana: 2, checkin_pendente: 3 }
  const PRIO_PESO: Record<string, number> = { alta: 0, moderada: 1, baixa: 2 }

  function diasSemNota(p: PacienteComAtencao): number {
    if (!p.ultima_nota_data) return 9999
    return Math.floor((Date.now() - new Date(p.ultima_nota_data).getTime()) / 86400000)
  }

  const aCases = (pacientes ?? [])
    .filter(p => p.nivel_atencao !== 'ok')
    .sort((a, b) => {
      // 1º critério: complexidade (nivel_atencao)
      const nivelDiff = (NIVEL_PESO[a.nivel_atencao] ?? 4) - (NIVEL_PESO[b.nivel_atencao] ?? 4)
      if (nivelDiff !== 0) return nivelDiff
      // 2º critério: prioridade do paciente
      const prioDiff = (PRIO_PESO[a.prioridade] ?? 1) - (PRIO_PESO[b.prioridade] ?? 1)
      if (prioDiff !== 0) return prioDiff
      // 3º critério: quem ficou mais tempo sem anotação vem primeiro
      return diasSemNota(b) - diasSemNota(a)
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
          <button
            onClick={() => setPacienteAberto(pacienteAberto === p.id ? null : p.id)}
            className="w-full flex items-center gap-3 px-4 py-3 bg-white hover:bg-gray-50 transition-colors text-left"
          >
            <IconeNivel nivel={p.nivel_atencao} />
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-gray-900">{p.nome}</span>
                <Badge variant={prioridadeBadge(p.prioridade)}>{prioridadeLabel(p.prioridade)}</Badge>
                {p.motivo_atencao.map((m, i) => (
                  <span key={i} className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{m}</span>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-2 flex-wrap">
                <span>{p.fisio_nome}</span>
                {p.semana_atual !== null && p.prognostico_semanas && (
                  <span>Sem. {p.semana_atual}/{p.prognostico_semanas}</span>
                )}
                <span className={`flex items-center gap-1 ${diasSemNota(p) >= 14 ? 'text-orange-500 font-medium' : 'text-gray-400'}`}>
                  <CalendarClock size={11} />
                  {p.ultima_nota_data
                    ? `última anotação há ${diasSemNota(p)}d`
                    : 'sem anotações'}
                </span>
              </p>
            </div>
            <ChevronRight size={16} className={`text-gray-400 transition-transform ${pacienteAberto === p.id ? 'rotate-90' : ''}`} />
          </button>

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

interface NotaRow { id: string; data: string; texto: string; acao_definida: string | null; autor: { nome: string } | null }
interface CheckinRow { trajetoria: string; confianca: string; aderencia: string; sinal_alerta: string | null; precisa_discutir: boolean }

const LABEL_TRAJETORIA: Record<string, string> = { melhorando: '↑ Melhorando', estavel: '→ Estável', piorando: '↓ Piorando' }
const LABEL_CONFIANCA: Record<string, string> = { no_caminho: 'No caminho', em_risco: 'Em risco', preciso_rever: 'Rever prognóstico' }
const LABEL_ADERENCIA: Record<string, string> = { boa: 'Boa', parcial: 'Parcial', baixa: 'Baixa' }

function PainelCasoPaciente({ paciente, autorId }: { paciente: PacienteComAtencao; autorId: string }) {
  const qc = useQueryClient()

  // Estados do formulário de nota + check-in
  const [nota, setNota] = useState('')
  const [acao, setAcao] = useState('')
  const [trajetoria, setTrajetoria] = useState<string>(paciente.ultimo_checkin_trajetoria ?? 'estavel')
  const [confianca, setConfianca] = useState<string>(paciente.ultimo_checkin_confianca ?? 'no_caminho')
  const [aderencia, setAderencia] = useState<string>('boa')
  const [precisaDiscutir, setPrecisaDiscutir] = useState(false)
  const [saving, setSaving] = useState(false)

  // Estado da alteração de prioridade
  const [prioridade, setPrioridade] = useState<string>(paciente.prioridade)
  const [savingPrioridade, setSavingPrioridade] = useState(false)

  // Controle de exibição das notas anteriores
  const [verTodasNotas, setVerTodasNotas] = useState(false)

  const { data: checkins } = useQuery({
    queryKey: ['checkins', paciente.id],
    queryFn: () => listarCheckinsDoPaciente(paciente.id),
  })

  const { data: notas } = useQuery({
    queryKey: ['notas', paciente.id],
    queryFn: () => listarNotasDoPaciente(paciente.id),
  })

  const ultimoCheckin = checkins?.[0] as CheckinRow | undefined
  const todasNotas = (notas ?? []) as unknown as NotaRow[]
  const notasVisiveis = verTodasNotas ? todasNotas : todasNotas.slice(0, 3)

  async function handleAlterarPrioridade(nova: string) {
    if (nova === prioridade) return
    setSavingPrioridade(true)
    try {
      await atualizarPaciente(paciente.id, { prioridade: nova as 'alta' | 'moderada' | 'baixa' })
      setPrioridade(nova)
      qc.invalidateQueries({ queryKey: ['pacientes-coord'] })
      qc.invalidateQueries({ queryKey: ['pacientes'] })
    } finally {
      setSavingPrioridade(false)
    }
  }

  async function handleSalvar() {
    if (!nota.trim()) return
    setSaving(true)
    try {
      const hoje = new Date()
      const { semana, ano } = semanaISO(hoje)

      // Registra check-in da semana
      await registrarCheckin({
        paciente_id: paciente.id,
        profissional_id: autorId,
        semana,
        ano,
        data: hoje.toISOString().split('T')[0],
        trajetoria: trajetoria as 'melhorando' | 'estavel' | 'piorando',
        confianca: confianca as 'no_caminho' | 'em_risco' | 'preciso_rever',
        aderencia: aderencia as 'boa' | 'parcial' | 'baixa',
        sinal_alerta: null,
        precisa_discutir: precisaDiscutir,
      })

      // Registra nota de reunião
      await criarNota({
        paciente_id: paciente.id,
        autor_id: autorId,
        data: hoje.toISOString().split('T')[0],
        texto: nota.trim(),
        acao_definida: acao.trim() || null,
      })

      setNota('')
      setAcao('')
      setPrecisaDiscutir(false)
      qc.invalidateQueries({ queryKey: ['notas', paciente.id] })
      qc.invalidateQueries({ queryKey: ['checkins', paciente.id] })
      qc.invalidateQueries({ queryKey: ['pacientes-coord'] })
    } finally {
      setSaving(false) }
  }

  return (
    <div className="border-t border-gray-100 bg-gray-50 px-4 py-4 space-y-5">

      {/* Prioridade */}
      <div className="flex items-center gap-3">
        <span className="text-xs font-medium text-gray-500">Prioridade:</span>
        <div className="flex gap-1.5">
          {(['alta', 'moderada', 'baixa'] as const).map(p => (
            <button
              key={p}
              disabled={savingPrioridade}
              onClick={() => handleAlterarPrioridade(p)}
              className={`px-2.5 py-1 text-xs rounded-full border transition-all ${
                prioridade === p
                  ? p === 'alta' ? 'bg-red-500 text-white border-red-500'
                    : p === 'moderada' ? 'bg-amber-400 text-white border-amber-400'
                    : 'bg-gray-400 text-white border-gray-400'
                  : 'bg-white text-gray-500 border-gray-300 hover:border-gray-400'
              }`}
            >
              {prioridadeLabel(p)}
            </button>
          ))}
        </div>
        {savingPrioridade && <span className="text-xs text-gray-400">Salvando…</span>}
      </div>

      {/* Último check-in */}
      {ultimoCheckin ? (
        <div className="grid grid-cols-3 gap-3 text-xs">
          <div className="bg-white rounded p-2 border border-gray-100">
            <p className="text-gray-500 mb-0.5">Trajetória</p>
            <p className={`font-semibold ${ultimoCheckin.trajetoria === 'piorando' ? 'text-red-600' : ultimoCheckin.trajetoria === 'melhorando' ? 'text-green-600' : 'text-blue-600'}`}>
              {LABEL_TRAJETORIA[ultimoCheckin.trajetoria] ?? ultimoCheckin.trajetoria}
            </p>
          </div>
          <div className="bg-white rounded p-2 border border-gray-100">
            <p className="text-gray-500 mb-0.5">Confiança</p>
            <p className={`font-semibold ${ultimoCheckin.confianca === 'no_caminho' ? 'text-green-600' : 'text-amber-600'}`}>
              {LABEL_CONFIANCA[ultimoCheckin.confianca] ?? ultimoCheckin.confianca}
            </p>
          </div>
          <div className="bg-white rounded p-2 border border-gray-100">
            <p className="text-gray-500 mb-0.5">Aderência</p>
            <p className={`font-semibold ${ultimoCheckin.aderencia === 'boa' ? 'text-green-600' : ultimoCheckin.aderencia === 'parcial' ? 'text-amber-600' : 'text-red-600'}`}>
              {LABEL_ADERENCIA[ultimoCheckin.aderencia] ?? ultimoCheckin.aderencia}
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

      {/* Histórico de notas */}
      {todasNotas.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-gray-500">
              Anotações anteriores ({todasNotas.length})
            </p>
            {todasNotas.length > 3 && (
              <button
                onClick={() => setVerTodasNotas(v => !v)}
                className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
              >
                {verTodasNotas ? <><ChevronUp size={12} /> Ver menos</> : <><ChevronDown size={12} /> Ver todas</>}
              </button>
            )}
          </div>
          {notasVisiveis.map(n => (
            <div key={n.id} className="bg-white border border-gray-100 rounded p-2.5">
              <p className="text-xs text-gray-400 mb-1">{formatarData(n.data)} · {n.autor?.nome}</p>
              <p className="text-xs text-gray-700">{n.texto}</p>
              {n.acao_definida && <p className="text-xs text-blue-600 mt-1">→ {n.acao_definida}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Nova nota + check-in integrado */}
      <div className="space-y-3 pt-1 border-t border-gray-200">
        <p className="text-xs font-semibold text-gray-600">Nova anotação + check-in desta semana</p>

        {/* Campos do check-in */}
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Trajetória</label>
            <select
              value={trajetoria}
              onChange={e => setTrajetoria(e.target.value)}
              className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="melhorando">↑ Melhorando</option>
              <option value="estavel">→ Estável</option>
              <option value="piorando">↓ Piorando</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Confiança</label>
            <select
              value={confianca}
              onChange={e => setConfianca(e.target.value)}
              className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="no_caminho">No caminho</option>
              <option value="em_risco">Em risco</option>
              <option value="preciso_rever">Rever prognóstico</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Aderência</label>
            <select
              value={aderencia}
              onChange={e => setAderencia(e.target.value)}
              className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="boa">Boa</option>
              <option value="parcial">Parcial</option>
              <option value="baixa">Baixa</option>
            </select>
          </div>
        </div>

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

        <div className="flex items-center gap-2">
          <input
            id={`discutir-${paciente.id}`}
            type="checkbox"
            checked={precisaDiscutir}
            onChange={e => setPrecisaDiscutir(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600"
          />
          <label htmlFor={`discutir-${paciente.id}`} className="text-xs text-gray-600 cursor-pointer">
            Marcar para discussão futura
          </label>
        </div>

        <div className="flex gap-2">
          <Button size="sm" onClick={handleSalvar} loading={saving} disabled={!nota.trim()}>
            Salvar nota e check-in
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
