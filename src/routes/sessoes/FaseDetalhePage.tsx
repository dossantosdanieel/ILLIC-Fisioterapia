import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, Play, Pencil, X, Plus } from 'lucide-react'
import { buscarPlanoCompleto } from '@/features/planos/api'
import { BuilderSessao } from '@/features/sessoes/components/BuilderSessao'
import { buscarResumosMicrociclo } from '@/features/sessoes/api'
import type { SessaoResumo } from '@/features/sessoes/api'
import { Card, CardHeader, CardBody, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { Button } from '@/components/ui/button'
import { calcularSemanaAtual } from '@/features/planos/utils'
import { CARGA_TIPO_LABELS } from '@/lib/carga'
import type { FaseCompleta } from '@/types/queries'

export default function FaseDetalhePage() {
  const { id, planoId, faseId } = useParams<{ id: string; planoId: string; faseId: string }>()
  const navigate = useNavigate()

  const { data: plano, isLoading } = useQuery({
    queryKey: ['plano', planoId],
    queryFn: () => buscarPlanoCompleto(planoId!),
    enabled: !!planoId,
  })

  if (isLoading) return <Spinner />
  if (!plano) return null

  const fase = (plano.fase as FaseCompleta[]).find(f => f.id === faseId)
  if (!fase) return <p className="p-8 text-gray-500">Fase não encontrada.</p>

  const semanaAtual = calcularSemanaAtual(plano.data_av_inicial)
  const microciclos = [...(fase.microciclo ?? [])].sort((a, b) => a.ordem - b.ordem)

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Link
        to={`/pacientes/${id}/plano/${planoId}`}
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 mb-5"
      >
        <ChevronLeft size={16} /> Plano
      </Link>

      <div className="mb-5">
        <h1 className="text-lg font-semibold text-gray-900">{fase.nome}</h1>
        <p className="text-sm text-gray-500">
          Semanas {fase.semana_inicio}–{fase.semana_fim} · {microciclos.length} microciclo{microciclos.length !== 1 ? 's' : ''}
        </p>
        {fase.objetivos && fase.objetivos.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {fase.objetivos.map((obj, i) => (
              <span key={i} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-100">
                {obj}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-4">
        {microciclos.map(mc => {
          const isAtual = semanaAtual >= mc.semana_inicio && semanaAtual <= mc.semana_fim
          const concluido = semanaAtual > mc.semana_fim
          const templates = mc.sessao_template ?? []

          return (
            <Card key={mc.id} className={isAtual ? 'ring-2 ring-blue-200' : ''}>
              <CardHeader className="py-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-sm">
                      Microciclo {mc.ordem} · Semanas {mc.semana_inicio}–{mc.semana_fim}
                    </CardTitle>
                    {isAtual  && <Badge variant="info">Atual</Badge>}
                    {concluido && <Badge variant="success">Concluído</Badge>}
                    {!isAtual && !concluido && <Badge variant="muted">Futuro</Badge>}
                  </div>
                  {templates.length > 0 && (
                    <div className="flex items-center gap-2">
                      {templates.map(t => (
                        <Button
                          key={t.id}
                          size="sm"
                          onClick={() => navigate(
                            `/pacientes/${id}/sessoes/executar/${t.id}?plano=${planoId}&fase=${faseId}`,
                          )}
                        >
                          <Play size={13} /> {t.nome ?? 'Executar sessão'}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardBody className="pt-0">
                <SessaoCard
                  microcicloId={mc.id}
                  semanas={`${mc.semana_inicio}–${mc.semana_fim}`}
                  objetivos={fase.objetivos ?? []}
                />
              </CardBody>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

// ── SessaoCard: mostra resumo inline OU editor ────────────

function SessaoCard({ microcicloId, semanas, objetivos }: { microcicloId: string; semanas: string; objetivos: string[] }) {
  const [editando, setEditando] = useState(false)
  const qc = useQueryClient()

  const { data: sessoes, isLoading } = useQuery({
    queryKey: ['sessao-resumo', microcicloId],
    queryFn: () => buscarResumosMicrociclo(microcicloId),
  })

  function fecharEditor() {
    setEditando(false)
    qc.invalidateQueries({ queryKey: ['sessao-resumo', microcicloId] })
    qc.invalidateQueries({ queryKey: ['sessao-template', microcicloId] })
  }

  if (isLoading) return <div className="py-2 flex justify-center"><Spinner /></div>

  if (editando) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Editando sessão proposta
          </span>
          <button
            onClick={fecharEditor}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 transition-colors"
          >
            <X size={12} /> Fechar
          </button>
        </div>
        <BuilderSessao microcicloId={microcicloId} semanas={semanas} objetivos={objetivos} />
      </div>
    )
  }

  // Sem sessões — botão para montar
  if (!sessoes?.length) {
    return (
      <button
        onClick={() => setEditando(true)}
        className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors py-1"
      >
        <Plus size={14} /> Montar sessão proposta
      </button>
    )
  }

  // Resumo inline das sessões
  return (
    <div className="space-y-4">
      {sessoes.map(sessao => (
        <SessaoResumoInline key={sessao.id} sessao={sessao} totalSessoes={sessoes.length} />
      ))}
      <button
        onClick={() => setEditando(true)}
        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-blue-600 font-medium transition-colors mt-1"
      >
        <Pencil size={12} /> Editar sessão proposta
      </button>
    </div>
  )
}

// ── Resumo de uma sessão (sem BuilderSessao) ──────────────

function SessaoResumoInline({ sessao, totalSessoes }: { sessao: SessaoResumo; totalSessoes: number }) {
  const blocos = [...(sessao.bloco ?? [])].sort((a, b) => a.ordem - b.ordem)
  const totalExs = blocos.reduce((s, b) => s + (b.exercicio_prescrito?.length ?? 0), 0)

  return (
    <div>
      {totalSessoes > 1 && (
        <p className="text-xs font-semibold text-gray-600 mb-1.5">
          {sessao.nome ?? 'Sessão'} · {totalExs} exercício{totalExs !== 1 ? 's' : ''}
        </p>
      )}
      <div className="space-y-2">
        {blocos.map(bloco => {
          const exs = [...(bloco.exercicio_prescrito ?? [])].sort((a, b) => a.ordem - b.ordem)
          if (!exs.length) return null
          return (
            <div key={bloco.id}>
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-1">
                {bloco.nome}
              </p>
              <div className="space-y-1">
                {exs.map(ep => {
                  const modo = ep.reps && ep.tempo_seg ? 'reps_e_tempo' : ep.reps ? 'reps' : 'tempo'
                  const params = modo === 'reps_e_tempo'
                    ? `${ep.series}×${ep.reps}rep×${ep.tempo_seg}s`
                    : modo === 'reps'
                      ? `${ep.series}×${ep.reps} rep`
                      : `${ep.series}×${ep.tempo_seg}s`
                  const carga = ep.carga_valor && ep.carga_valor !== '0' && ep.carga_tipo !== 'peso_corporal'
                    ? ` · ${ep.carga_valor} ${CARGA_TIPO_LABELS[ep.carga_tipo] ?? ep.carga_tipo}`
                    : ep.carga_tipo === 'peso_corporal' ? ' · peso corporal' : ''

                  return (
                    <div key={ep.id} className="flex items-baseline gap-2 text-xs flex-wrap">
                      <span className="font-medium text-gray-800 shrink-0">{ep.exercicio.nome}</span>
                      {ep.exercicio.grupo_muscular && (
                        <span className="text-gray-400 bg-gray-100 px-1 rounded shrink-0">
                          {ep.exercicio.grupo_muscular}
                        </span>
                      )}
                      <span className="text-gray-500 font-mono shrink-0">{params}{carga}</span>
                      {ep.regra_progressao && (
                        <span className="text-green-600 shrink-0">↗ {ep.regra_progressao}</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
