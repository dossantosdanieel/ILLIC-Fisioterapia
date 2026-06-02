/**
 * Tipos para resultados de queries com joins (Supabase não infere automaticamente).
 */
import type {
  PacienteRow, PlanoRow, FaseRow, MedidaRow,
  AvaliacaoRow, SessaoRealizadaRow, CheckInRow, NotificacaoRow,
  ProfissionalRow,
} from './database'
import type { OperadorCriterio, DirecaoMelhora } from './database'

// ── Paciente com joins ─────────────────────────────────────
export interface PacienteComPlano extends PacienteRow {
  profissional: Pick<ProfissionalRow, 'id' | 'nome'> | null
  plano_tratamento: Pick<PlanoRow, 'id' | 'status' | 'prognostico_semanas' | 'data_av_inicial' | 'frequencia_semanal'>[]
}

export interface PacienteDetalhe extends PacienteRow {
  profissional: Pick<ProfissionalRow, 'id' | 'nome' | 'crefito'> | null
}

// ── Critério com medida ────────────────────────────────────
export interface CriterioComMedida {
  id: string
  fase_id: string
  medida_id: string
  operador: OperadorCriterio
  valor_alvo: number
  medida: Pick<MedidaRow, 'id' | 'nome' | 'unidade' | 'direcao_melhora'>
}

// ── Microciclo com template ────────────────────────────────
export interface MicrocicloComTemplate {
  id: string
  fase_id: string
  ordem: number
  semana_inicio: number
  semana_fim: number
  sessao_template: { id: string; nome: string | null }[]
}

// ── Fase com tudo ──────────────────────────────────────────
export interface FaseCompleta extends FaseRow {
  criterio_fase: CriterioComMedida[]
  microciclo: MicrocicloComTemplate[]
}

// ── Plano completo ─────────────────────────────────────────
export interface PlanoCompleto extends PlanoRow {
  paciente: Pick<PacienteRow, 'id' | 'nome' | 'prioridade'> | null
  fase: FaseCompleta[]
}

// ── Valor de medida com join ───────────────────────────────
export interface ValorMedidaComMedida {
  id: string
  avaliacao_id: string
  medida_id: string
  valor: number
  medida: Pick<MedidaRow, 'id' | 'nome' | 'unidade' | 'direcao_melhora'>
}

// ── Avaliação com joins ────────────────────────────────────
export interface AvaliacaoCompleta extends AvaliacaoRow {
  profissional: Pick<ProfissionalRow, 'nome'> | null
  valor_medida: ValorMedidaComMedida[]
}

// ── Fase simples para motor de critérios ──────────────────
export interface FaseCriterios {
  id: string
  nome: string
  criterio_fase: {
    id: string
    operador: OperadorCriterio
    valor_alvo: number
    medida: Pick<MedidaRow, 'id' | 'nome' | 'unidade' | 'direcao_melhora'>
  }[]
}

// ── Exports de conveniência ────────────────────────────────
export type { PacienteRow, PlanoRow, FaseRow, MedidaRow, AvaliacaoRow, SessaoRealizadaRow, CheckInRow, NotificacaoRow, ProfissionalRow }
export type { DirecaoMelhora }
