import type { BadgeProps } from '@/types/ui'

/** Semana corrente do plano (1-based) a partir da data da avaliação inicial */
export function calcularSemanaAtual(dataAvInicial: string): number {
  const inicio = new Date(dataAvInicial)
  const hoje = new Date()
  const diffMs = hoje.getTime() - inicio.getTime()
  const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  return Math.max(1, Math.floor(diffDias / 7) + 1)
}

/** Microciclo atual (grupos de 2 semanas) */
export function calcularMicrocicloAtual(semanaAtual: number): number {
  return Math.ceil(semanaAtual / 2)
}

/** Data estimada de reavaliação baseada na janela da fase */
export function dataReavaliacao(dataAvInicial: string, semanaFim: number): Date {
  const inicio = new Date(dataAvInicial)
  inicio.setDate(inicio.getDate() + semanaFim * 7)
  return inicio
}

export function formatarData(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR')
}

export function formatarDataCurta(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

interface StatusInfo { label: string; variant: BadgeProps['variant'] }

export function statusPlano(
  plano: { status: string; prognostico_semanas: number; data_av_inicial: string },
  semanaAtual: number,
): StatusInfo {
  if (plano.status === 'suspenso') return { label: 'Suspenso', variant: 'muted' }
  if (plano.status === 'concluido') return { label: 'Concluído', variant: 'success' }
  if (semanaAtual > plano.prognostico_semanas) return { label: 'Vencido', variant: 'danger' }
  const semRestantes = plano.prognostico_semanas - semanaAtual
  if (semRestantes <= 2) return { label: `${semRestantes}sem restantes`, variant: 'warning' }
  return { label: 'No prazo', variant: 'success' }
}
