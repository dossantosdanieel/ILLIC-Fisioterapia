import { useQuery } from '@tanstack/react-query'
import { BarChart2, Info } from 'lucide-react'
import { buscarMetricasBrutas, calcularScores } from '@/features/performance/api'
import { ScoreCard } from '@/features/performance/components/ScoreCard'
import { Spinner } from '@/components/ui/spinner'
import { Empty } from '@/components/ui/empty'
import { useState } from 'react'

type Ordenacao = 'score' | 'cmi' | 'volume' | 'nome'

export default function PerformancePage() {
  const [ordenacao, setOrdenacao] = useState<Ordenacao>('score')

  const { data: brutos, isLoading, error } = useQuery({
    queryKey: ['metricas-performance'],
    queryFn: buscarMetricasBrutas,
    staleTime: 1000 * 60 * 5, // 5 min — dados pesados
  })

  const scores = brutos ? calcularScores(brutos) : []

  const ordenados = [...scores].sort((a, b) => {
    if (ordenacao === 'score') return b.score_geral - a.score_geral
    if (ordenacao === 'cmi') return b.case_mix_index - a.case_mix_index
    if (ordenacao === 'volume') return b.total_planos - a.total_planos
    return a.profissional_nome.localeCompare(b.profissional_nome)
  })

  const mediaClinica = scores.length > 0
    ? Math.round(scores.reduce((s, p) => s + p.score_geral, 0) / scores.length)
    : null

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Performance clínica</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Scorecard de efetividade ajustado por complexidade de casos (CMI)
          </p>
        </div>

        {mediaClinica !== null && (
          <div className="text-right">
            <div className="text-xs text-gray-500">Média da clínica</div>
            <div className={`text-2xl font-bold ${mediaClinica >= 75 ? 'text-green-600' : mediaClinica >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
              {mediaClinica}
            </div>
          </div>
        )}
      </div>

      {/* Aviso de contexto */}
      <div className="flex items-start gap-2.5 p-3 bg-blue-50 border border-blue-100 rounded-lg mb-5 text-xs text-blue-700">
        <Info size={14} className="shrink-0 mt-0.5" />
        <div>
          <strong>Ferramenta de desenvolvimento profissional, não ranking cru.</strong>{' '}
          As métricas são ajustadas pelo Índice de Case-Mix (CMI) — quem atende casos mais complexos
          (prioridade alta) recebe bônus nos scores. O objetivo é coaching e melhoria contínua,
          não comparação punitiva.
        </div>
      </div>

      {/* Ordenação */}
      <div className="flex items-center gap-2 mb-4 text-xs">
        <span className="text-gray-500">Ordenar por:</span>
        {(['score', 'cmi', 'volume', 'nome'] as Ordenacao[]).map(o => (
          <button
            key={o}
            onClick={() => setOrdenacao(o)}
            className={`px-3 py-1.5 rounded-md border transition-colors ${
              ordenacao === o
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
            }`}
          >
            {{ score: 'Score geral', cmi: 'Case-mix', volume: 'Volume', nome: 'Nome' }[o]}
          </button>
        ))}
      </div>

      {isLoading && <Spinner />}

      {error && (
        <div className="py-8 text-center text-red-500 text-sm">
          Erro ao carregar métricas. Verifique as permissões de coordenador/admin.
        </div>
      )}

      {!isLoading && !error && ordenados.length === 0 && (
        <Empty
          icon={BarChart2}
          title="Sem dados suficientes"
          description="Registre planos, sessões e check-ins para gerar o scorecard."
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {ordenados.map((prof, i) => (
          <ScoreCard
            key={prof.profissional_id}
            prof={prof}
            destaque={ordenacao === 'score' && i === 0}
          />
        ))}
      </div>

      {/* Legenda */}
      {ordenados.length > 0 && (
        <div className="mt-6 p-4 bg-gray-50 rounded-lg text-xs text-gray-500 space-y-1">
          <p className="font-medium text-gray-700 mb-2">Legenda das métricas</p>
          <p><strong>Altas no prazo:</strong> % de planos concluídos dentro do prognóstico (ajustado pelo CMI).</p>
          <p><strong>Planos vencidos:</strong> % de planos ativos que ultrapassaram o prognóstico sem alta (menor = melhor).</p>
          <p><strong>Fidelidade ao protocolo:</strong> % de exercícios realizados vs. prescritos em todas as sessões.</p>
          <p><strong>Pontualidade de check-ins:</strong> regularidade do preenchimento semanal da Percepção Clínica.</p>
          <p className="pt-1"><strong>CMI (Índice de Case-Mix):</strong> peso médio dos casos — alta=1.4, moderada=1.0, baixa=0.7. CMI acima de 1.0 indica carteira de pacientes mais complexa.</p>
        </div>
      )}
    </div>
  )
}
