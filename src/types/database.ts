export type Papel = 'fisioterapeuta' | 'coordenador' | 'admin'
export type Prioridade = 'alta' | 'moderada' | 'baixa'
export type StatusPlano = 'ativo' | 'concluido' | 'vencido' | 'suspenso'
export type TipoAvaliacao = 'inicial' | 'reavaliacao'
export type OperadorCriterio = '>=' | '<=' | '='
export type DirecaoMelhora = 'maior' | 'menor'
export type UnidadeMedida = 'eva' | 'graus' | 'kgf' | 'seg' | 'percent' | 'passfail'
export type CargaTipo =
  | 'kg' | 'kgf' | 'percent_1rm' | 'rm' | 'banda_cor' | 'peso_corporal' | 'tempo'
  | 'faixa_leve' | 'faixa_moderada' | 'faixa_forte'
  | 'superband_leve' | 'superband_media' | 'superband_forte'
export type TipoNotificacao =
  | 'criterio_nao_atingido'
  | 'plano_vencido'
  | 'checkin_pendente'
  | 'fase_transicao'
  | 'sessao_alterada'
export type TrajetoriaCaso = 'melhorando' | 'estavel' | 'piorando'
export type ConfiancaPrognostico = 'no_caminho' | 'em_risco' | 'preciso_rever'
export type AderenciaPaciente = 'boa' | 'parcial' | 'baixa'
export type MotivoNaoRealizado =
  | 'dor'
  | 'fadiga'
  | 'equipamento'
  | 'falta'
  | 'progressao_antecipada'
  | 'outro'

type R = { foreignKeyName: string; columns: string[]; referencedRelation: string; referencedColumns: string[] }

type T<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row
  Insert: Insert
  Update: Update
  Relationships: R[]
}

export interface Database {
  public: {
    Tables: {
      profissional: T<{
        id: string
        auth_id: string | null
        nome: string
        crefito: string | null
        email: string
        papeis: Papel[]
        ativo: boolean
        criado_em: string
      }>
      paciente: T<{
        id: string
        nome: string
        data_nascimento: string | null
        diagnostico: string | null
        hipotese_diagnostica: string | null
        prioridade: Prioridade
        convenio_plano: string | null
        fisio_responsavel_id: string
        consentimento_lgpd: boolean
        data_consentimento: string | null
        ativo: boolean
        criado_em: string
      }>
      plano_tratamento: T<{
        id: string
        paciente_id: string
        fisio_id: string
        prognostico_semanas: number
        frequencia_semanal: number
        data_av_inicial: string
        status: StatusPlano
        objetivos: string[]
        criado_em: string
        atualizado_em: string
      }>
      fase: T<{
        id: string
        plano_id: string
        ordem: number
        nome: string
        semana_inicio: number
        semana_fim: number
        objetivos: string[]
        criado_em: string
      }>
      criterio_fase: T<{
        id: string
        fase_id: string
        medida_id: string
        operador: OperadorCriterio
        valor_alvo: number
      }>
      microciclo: T<{
        id: string
        fase_id: string
        ordem: number
        semana_inicio: number
        semana_fim: number
      }>
      sessao_template: T<{
        id: string
        microciclo_id: string
        nome: string | null
      }>
      bloco: T<{
        id: string
        sessao_template_id: string
        nome: string
        ordem: number
      }>
      exercicio: T<{
        id: string
        nome: string
        descricao: string | null
        video_url: string | null
        grupo_muscular: string | null
        ativo: boolean
        criado_em: string
      }>
      exercicio_prescrito: T<{
        id: string
        bloco_id: string
        exercicio_id: string
        series: number
        reps: number | null
        tempo_seg: number | null
        carga_tipo: CargaTipo
        carga_valor: string
        nota: string | null
        condicional: boolean
        ordem: number
        regra_progressao: string | null
      }>
      sessao_realizada: T<{
        id: string
        sessao_template_id: string
        paciente_id: string
        profissional_id: string
        data: string
        observacao: string | null
        criado_em: string
      }>
      execucao_exercicio: T<{
        id: string
        sessao_realizada_id: string
        exercicio_prescrito_id: string
        realizado: boolean
        carga_real: string | null
        reps_real: number | null
        tempo_real: number | null
        motivo_nao_realizado: MotivoNaoRealizado | null
        motivo_texto: string | null
        alterado_em_tempo_real: boolean
        criado_em: string
      }>
      medida: T<{
        id: string
        nome: string
        unidade: UnidadeMedida
        direcao_melhora: DirecaoMelhora
        ativo: boolean
        criado_em: string
      }>
      avaliacao: T<{
        id: string
        paciente_id: string
        profissional_id: string
        plano_id: string | null
        tipo: TipoAvaliacao
        data: string
        numero_reav: number | null
        observacoes: string | null
        campos_adicionais: { nome: string; valor: string; unidade: string }[]
        criado_em: string
      }>
      valor_medida: T<{
        id: string
        avaliacao_id: string
        medida_id: string
        valor: number
      }>
      check_in_semanal: T<{
        id: string
        paciente_id: string
        profissional_id: string
        semana: number
        ano: number
        data: string
        trajetoria: TrajetoriaCaso
        confianca: ConfiancaPrognostico
        aderencia: AderenciaPaciente
        sinal_alerta: string | null
        precisa_discutir: boolean
        criado_em: string
      }>
      nota_reuniao: T<{
        id: string
        paciente_id: string
        autor_id: string
        data: string
        texto: string
        acao_definida: string | null
        criado_em: string
      }>
      notificacao: T<{
        id: string
        destinatario_id: string
        tipo: TipoNotificacao
        payload: Record<string, unknown>
        lida: boolean
        criado_em: string
      }>
      transicao_fase: T<{
        id: string
        fase_origem_id: string
        fase_destino_id: string
        decidido_por_id: string
        data_decisao: string
        criterios_atingidos: boolean
        justificativa: string | null
        criado_em: string
      }>
      log_auditoria: T<
        {
          id: string
          ator_id: string | null
          acao: string
          entidade: string
          entidade_id: string | null
          payload: Record<string, unknown> | null
          ip: string | null
          timestamp: string
        },
        {
          ator_id?: string | null
          acao: string
          entidade: string
          entidade_id?: string | null
          payload?: Record<string, unknown> | null
          ip?: string | null
        },
        never
      >
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: {
      papel: Papel
      prioridade: Prioridade
      status_plano: StatusPlano
      tipo_avaliacao: TipoAvaliacao
      operador_criterio: OperadorCriterio
      direcao_melhora: DirecaoMelhora
      unidade_medida: UnidadeMedida
      carga_tipo: CargaTipo
      tipo_notificacao: TipoNotificacao
      trajetoria_caso: TrajetoriaCaso
      confianca_prognostico: ConfiancaPrognostico
      aderencia_paciente: AderenciaPaciente
      motivo_nao_realizado: MotivoNaoRealizado
    }
  }
}

// Helpers de tipo para uso nos componentes
export type ProfissionalRow = Database['public']['Tables']['profissional']['Row']
export type PacienteRow = Database['public']['Tables']['paciente']['Row']
export type PlanoRow = Database['public']['Tables']['plano_tratamento']['Row']
export type FaseRow = Database['public']['Tables']['fase']['Row']
export type MedidaRow = Database['public']['Tables']['medida']['Row']
export type AvaliacaoRow = Database['public']['Tables']['avaliacao']['Row']
export type SessaoRealizadaRow = Database['public']['Tables']['sessao_realizada']['Row']
export type CheckInRow = Database['public']['Tables']['check_in_semanal']['Row']
export type NotificacaoRow = Database['public']['Tables']['notificacao']['Row']
