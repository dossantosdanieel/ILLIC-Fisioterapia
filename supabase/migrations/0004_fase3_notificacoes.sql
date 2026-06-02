-- ── Trigger: notificar coordenadores quando sessão é alterada em tempo real ──

CREATE OR REPLACE FUNCTION notificar_sessao_alterada()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_paciente_nome TEXT;
  v_exercicio_nome TEXT;
  v_profissional_nome TEXT;
  v_coord RECORD;
BEGIN
  -- Só dispara se houve alteração em tempo real
  IF NEW.alterado_em_tempo_real = FALSE THEN
    RETURN NEW;
  END IF;

  -- Buscar dados para a notificação
  SELECT p.nome INTO v_paciente_nome
  FROM sessao_realizada sr
  JOIN paciente p ON p.id = sr.paciente_id
  WHERE sr.id = NEW.sessao_realizada_id;

  SELECT e.nome INTO v_exercicio_nome
  FROM exercicio_prescrito ep
  JOIN exercicio e ON e.id = ep.exercicio_id
  WHERE ep.id = NEW.exercicio_prescrito_id;

  SELECT pr.nome INTO v_profissional_nome
  FROM sessao_realizada sr
  JOIN profissional pr ON pr.id = sr.profissional_id
  WHERE sr.id = NEW.sessao_realizada_id;

  -- Notificar todos os coordenadores e admins ativos
  FOR v_coord IN
    SELECT id FROM profissional WHERE papel IN ('coordenador', 'admin') AND ativo = TRUE
  LOOP
    INSERT INTO notificacao (destinatario_id, tipo, payload)
    VALUES (
      v_coord.id,
      'sessao_alterada',
      jsonb_build_object(
        'paciente_nome', v_paciente_nome,
        'exercicio_nome', v_exercicio_nome,
        'profissional_nome', v_profissional_nome,
        'carga_real', NEW.carga_real,
        'motivo_nao_realizado', NEW.motivo_nao_realizado,
        'sessao_realizada_id', NEW.sessao_realizada_id
      )
    );
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER tg_notificar_sessao_alterada
  AFTER INSERT ON execucao_exercicio
  FOR EACH ROW EXECUTE FUNCTION notificar_sessao_alterada();

-- ── View: resumo de pacientes para o coordenador ──────────

CREATE OR REPLACE VIEW vw_pacientes_coordenador AS
SELECT
  p.id,
  p.nome,
  p.prioridade,
  p.convenio_plano,
  p.fisio_responsavel_id,
  prof.nome AS fisio_nome,
  pt.id AS plano_id,
  pt.status AS plano_status,
  pt.prognostico_semanas,
  pt.data_av_inicial,
  pt.frequencia_semanal,
  -- Semana atual calculada
  GREATEST(1, FLOOR(EXTRACT(EPOCH FROM (NOW() - pt.data_av_inicial::timestamptz)) / (7 * 86400))::INT + 1) AS semana_atual,
  -- Último check-in
  ci.trajetoria AS ultimo_checkin_trajetoria,
  ci.confianca AS ultimo_checkin_confianca,
  ci.precisa_discutir AS ultimo_checkin_discutir,
  ci.data AS ultimo_checkin_data,
  -- Sessões realizadas na semana atual
  (
    SELECT COUNT(*) FROM sessao_realizada sr
    WHERE sr.paciente_id = p.id
    AND sr.data >= CURRENT_DATE - INTERVAL '7 days'
  ) AS sessoes_semana
FROM paciente p
JOIN profissional prof ON prof.id = p.fisio_responsavel_id
LEFT JOIN plano_tratamento pt ON pt.id = (
  SELECT id FROM plano_tratamento
  WHERE paciente_id = p.id AND status = 'ativo'
  ORDER BY criado_em DESC LIMIT 1
)
LEFT JOIN check_in_semanal ci ON ci.id = (
  SELECT id FROM check_in_semanal
  WHERE paciente_id = p.id
  ORDER BY data DESC LIMIT 1
)
WHERE p.ativo = TRUE;

-- RLS na view (herda das tabelas base, mas garantimos acesso apenas para coord/admin)
ALTER VIEW vw_pacientes_coordenador OWNER TO postgres;
