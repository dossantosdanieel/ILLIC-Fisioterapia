import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Play, Copy, ClipboardPaste, ChevronDown, ChevronUp, CheckCircle2, Circle, Clock } from 'lucide-react'
import { buscarPlanoCompleto } from '@/features/planos/api'
import { copiarTemplate } from '../api'
import { BuilderSessao } from './BuilderSessao'
import { calcularSemanaAtual } from '@/features/planos/utils'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import type { FaseCompleta, MicrocicloComTemplate } from '@/types/queries'

interface Props {
  planoId: string
  pacienteId: string
}

export function SessoesDoPlanoPainel({ planoId, pacienteId }: Props) {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [copiadoDeId, setCopiadoDeId] = useState<string | null>(null) // template id copiado
  const [copiadoDeMc, setCopiadoDeMc] = useState<string | null>(null) // nome do mc copiado
  const [colandoEmId, setColandoEmId] = useState<string | null>(null)
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set())

  const { data: plano, isLoading } = useQuery({
    queryKey: ['plano', planoId],
    queryFn: () => buscarPlanoCompleto(planoId),
  })

  if (isLoading) return <Spinner />
  if (!plano) return null

  const semanaAtual = calcularSemanaAtual(plano.data_av_inicial)
  const freq = plano.frequencia_semanal

  // Montar lista plana de microciclos com número de sessões
  const fases = [...(plano.fase as FaseCompleta[])].sort((a, b) => a.ordem - b.ordem)
  type McInfo = {
    mc: MicrocicloComTemplate
    faseNome: string
    faseOrdem: number
    sessaoInicio: number
    sessaoFim: number
    isAtual: boolean
    concluido: boolean
  }
  const listaMcs: McInfo[] = []
  let sessaoAcumulada = 1

  for (const fase of fases) {
    const mcs = [...(fase.microciclo ?? [])].sort((a, b) => a.ordem - b.ordem)
    for (const mc of mcs) {
      const sessoesNeMc = (mc.semana_fim - mc.semana_inicio + 1) * freq
      const isAtual = semanaAtual >= mc.semana_inicio && semanaAtual <= mc.semana_fim
      const concluido = semanaAtual > mc.semana_fim
      listaMcs.push({
        mc,
        faseNome: fase.nome,
        faseOrdem: fase.ordem,
        sessaoInicio: sessaoAcumulada,
        sessaoFim: sessaoAcumulada + sessoesNeMc - 1,
        isAtual,
        concluido,
      })
      sessaoAcumulada += sessoesNeMc
    }
  }

  function toggleExpandido(mcId: string) {
    setExpandidos(prev => {
      const next = new Set(prev)
      if (next.has(mcId)) next.delete(mcId)
      else next.add(mcId)
      return next
    })
  }

  async function handleColar(mcId: string, mcNome: string) {
    if (!copiadoDeId) return
    setColandoEmId(mcId)
    try {
      await copiarTemplate(copiadoDeId, mcId)
      qc.invalidateQueries({ queryKey: ['sessao-template', mcId] })
      qc.invalidateQueries({ queryKey: ['sessao-template-check', mcId] })
      // Expande o destino automaticamente
      setExpandidos(prev => new Set(prev).add(mcId))
      alert(`Sessão colada em ${mcNome}!`)
    } catch {
      alert('Erro ao colar sessão.')
    } finally {
      setColandoEmId(null)
    }
  }

  return (
    <div className="space-y-2">
      {/* Legenda copy/paste */}
      {copiadoDeId && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-blue-50 border border-blue-200 rounded-lg text-sm">
          <Copy size={14} className="text-blue-500 shrink-0" />
          <span className="text-blue-700">
            <strong>{copiadoDeMc}</strong> copiada — clique em <strong>Colar</strong> em qualquer microciclo para aplicar.
          </span>
          <button onClick={() => { setCopiadoDeId(null); setCopiadoDeMc(null) }}
            className="ml-auto text-xs text-blue-500 hover:underline">
            Cancelar
          </button>
        </div>
      )}

      {listaMcs.map(({ mc, faseNome, faseOrdem, sessaoInicio, sessaoFim, isAtual, concluido }, idx) => {
        const expanded = expandidos.has(mc.id)
        const templateId = mc.sessao_template?.[0]?.id ?? null
        const prevFase = idx > 0 ? listaMcs[idx - 1].faseOrdem : -1
        const mostraCabecalhoFase = faseOrdem !== prevFase

        return (
          <div key={mc.id}>
            {/* Separador de fase */}
            {mostraCabecalhoFase && (
              <div className="flex items-center gap-2 mt-4 mb-2">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {faseNome}
                </span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>
            )}

            {/* Card do microciclo */}
            <div className={`border rounded-lg overflow-hidden transition-shadow ${
              isAtual ? 'border-blue-300 shadow-sm' : 'border-gray-200'
            }`}>
              {/* Header */}
              <div
                className={`flex items-center gap-3 px-4 py-3 cursor-pointer select-none transition-colors ${
                  isAtual ? 'bg-blue-50 hover:bg-blue-100' : 'bg-gray-50 hover:bg-gray-100'
                }`}
                onClick={() => toggleExpandido(mc.id)}
              >
                {/* Ícone status */}
                <div className="shrink-0">
                  {concluido
                    ? <CheckCircle2 size={16} className="text-green-500" />
                    : isAtual
                    ? <Clock size={16} className="text-blue-500" />
                    : <Circle size={16} className="text-gray-300" />
                  }
                </div>

                {/* Numeração de sessões */}
                <div className="shrink-0 text-center w-24">
                  <span className="text-sm font-bold text-gray-900">
                    {sessaoInicio === sessaoFim
                      ? `Sessão ${sessaoInicio}`
                      : `Sessões ${sessaoInicio}–${sessaoFim}`
                    }
                  </span>
                </div>

                {/* Semanas */}
                <div className="flex-1 min-w-0">
                  <span className="text-xs text-gray-500">
                    Semanas {mc.semana_inicio}–{mc.semana_fim}
                  </span>
                  {isAtual && (
                    <Badge variant="info" className="ml-2">MC atual</Badge>
                  )}
                  {concluido && (
                    <Badge variant="success" className="ml-2">Concluído</Badge>
                  )}
                  {!isAtual && !concluido && (
                    <Badge variant="muted" className="ml-2">Futuro</Badge>
                  )}
                  {templateId && (
                    <span className="ml-2 text-xs text-green-600">✓ Sessão montada</span>
                  )}
                </div>

                {/* Ações */}
                <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
                  {/* Copiar esta sessão */}
                  {templateId && (
                    <button
                      onClick={() => {
                        setCopiadoDeId(templateId)
                        setCopiadoDeMc(`Sessões ${sessaoInicio}–${sessaoFim}`)
                      }}
                      className={`flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors ${
                        copiadoDeId === templateId
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-500 hover:bg-gray-200'
                      }`}
                      title="Copiar sessão"
                    >
                      <Copy size={12} />
                      {copiadoDeId === templateId ? 'Copiado' : 'Copiar'}
                    </button>
                  )}

                  {/* Colar sessão */}
                  {copiadoDeId && copiadoDeId !== templateId && (
                    <button
                      onClick={() => handleColar(mc.id, `Sessões ${sessaoInicio}–${sessaoFim}`)}
                      disabled={colandoEmId === mc.id}
                      className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors disabled:opacity-50"
                      title="Colar sessão copiada aqui"
                    >
                      <ClipboardPaste size={12} />
                      {colandoEmId === mc.id ? 'Colando…' : 'Colar'}
                    </button>
                  )}

                  {/* Executar sessão */}
                  {templateId && (
                    <button
                      onClick={() => navigate(
                        `/pacientes/${pacienteId}/sessoes/executar/${templateId}?plano=${planoId}`,
                      )}
                      className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                      title="Executar sessão"
                    >
                      <Play size={12} /> Executar
                    </button>
                  )}

                  {expanded
                    ? <ChevronUp size={14} className="text-gray-400 ml-1" />
                    : <ChevronDown size={14} className="text-gray-400 ml-1" />
                  }
                </div>
              </div>

              {/* Body — builder */}
              {expanded && (
                <div className="px-4 py-4 border-t border-gray-100">
                  <BuilderSessao
                    microcicloId={mc.id}
                    semanas={`${mc.semana_inicio}–${mc.semana_fim}`}
                  />
                </div>
              )}
            </div>
          </div>
        )
      })}

      {listaMcs.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-8">
          Nenhuma fase/microciclo definido neste plano.
        </p>
      )}
    </div>
  )
}
