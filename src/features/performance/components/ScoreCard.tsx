import { TrendingUp, TrendingDown, Minus, Info } from 'lucide-react'
import type { ScoreProfissional, ScoreMetrica } from '../api'
import { Card, CardHeader, CardBody, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface Props {
  prof: ScoreProfissional
  destaque?: boolean
}

function corScore(score: number) {
  if (score >= 75) return 'text-green-600'
  if (score >= 50) return 'text-amber-600'
  return 'text-red-600'
}

function bgScore(score: number) {
  if (score >= 75) return 'bg-green-500'
  if (score >= 50) return 'bg-amber-400'
  return 'bg-red-400'
}

function IconeTrend({ score }: { direcao: 'maior' | 'menor'; score: number }) {
  if (score >= 60) return <TrendingUp size={14} className="text-green-500" />
  if (score <= 40) return <TrendingDown size={14} className="text-red-400" />
  return <Minus size={14} className="text-gray-400" />
}

function BarraMetrica({ metrica }: { metrica: ScoreMetrica }) {
  const valorExibido = metrica.valorAjustado ?? metrica.valor

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5">
          <IconeTrend direcao={metrica.direcao} score={metrica.score} />
          <span className="text-gray-700 font-medium">{metrica.label}</span>
          <div className="group relative">
            <Info size={11} className="text-gray-300 cursor-help" />
            <div className="absolute left-0 bottom-5 w-56 bg-gray-900 text-white text-xs rounded p-2 hidden group-hover:block z-10 leading-snug">
              {metrica.descricao}
              {metrica.valorAjustado !== metrica.valor && metrica.valorAjustado !== null && (
                <p className="mt-1 text-gray-300">Ajustado pelo case-mix do profissional.</p>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {valorExibido !== null ? (
            <span className={`font-bold ${corScore(metrica.score)}`}>
              {valorExibido}{metrica.unidade}
            </span>
          ) : (
            <span className="text-gray-400 italic text-xs">sem dados</span>
          )}
        </div>
      </div>

      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${bgScore(metrica.score)}`}
          style={{ width: `${metrica.score}%` }}
        />
      </div>
    </div>
  )
}

export function ScoreCard({ prof, destaque }: Props) {
  const nivel = prof.score_geral >= 75 ? 'success' : prof.score_geral >= 50 ? 'warning' : 'danger'
  const label = prof.score_geral >= 75 ? 'Acima da média' : prof.score_geral >= 50 ? 'Na média' : 'Abaixo da média'

  return (
    <Card className={destaque ? 'ring-2 ring-blue-200' : ''}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{prof.profissional_nome}</CardTitle>
            {prof.crefito && <p className="text-xs text-gray-400 mt-0.5">CREFITO: {prof.crefito}</p>}
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={nivel}>{label}</Badge>
            <div className={`text-2xl font-bold ${corScore(prof.score_geral)}`}>
              {prof.score_geral}
            </div>
          </div>
        </div>

        {/* Case-mix e volume */}
        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
          <span>{prof.total_planos} plano{prof.total_planos !== 1 ? 's' : ''}</span>
          <span className="flex items-center gap-1">
            <span>CMI:</span>
            <span className={`font-semibold ${prof.case_mix_index >= 1.1 ? 'text-orange-600' : prof.case_mix_index <= 0.9 ? 'text-blue-500' : 'text-gray-700'}`}>
              {prof.case_mix_index.toFixed(2)}
            </span>
            <div className="group relative">
              <Info size={10} className="text-gray-300 cursor-help" />
              <div className="absolute left-0 bottom-4 w-48 bg-gray-900 text-white text-xs rounded p-2 hidden group-hover:block z-10 leading-snug">
                Índice de Case-Mix: mede a complexidade média dos pacientes atendidos.
                {'>'}1.0 = casos mais complexos (alta prioridade), ajusta as métricas positivamente.
              </div>
            </div>
          </span>
        </div>
      </CardHeader>

      <CardBody className="space-y-4">
        {prof.metricas.map(m => (
          <BarraMetrica key={m.label} metrica={m} />
        ))}
      </CardBody>
    </Card>
  )
}
