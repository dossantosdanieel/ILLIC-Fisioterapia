-- ── Views de métricas para o ranking de efetividade ──────

-- Planos com semana de conclusão calculada
CREATE OR REPLACE VIEW vw_planos_metricas AS
SELECT
  pt.id,
  pt.paciente_id,
  pt.fisio_id,
  pt.status,
  pt.prognostico_semanas,
  pt.data_av_inicial,
  pt.frequencia_semanal,
  p.prioridade,
  -- Semana atual ou semana de conclusão (estimada pela última sessão)
  GREATEST(1, FLOOR(
    EXTRACT(EPOCH FROM (NOW() - pt.data_av_inicial::timestamptz)) / (7 * 86400)
  )::INT + 1) AS semana_atual,
  -- Última sessão realizada
  (SELECT MAX(sr.data) FROM sessao_realizada sr WHERE sr.paciente_id = pt.paciente_id) AS ultima_sessao,
  -- Total de sessões realizadas
  (SELECT COUNT(*) FROM sessao_realizada sr WHERE sr.paciente_id = pt.paciente_id) AS total_sessoes,
  -- Exercícios prescritos totais
  (SELECT COUNT(*) FROM execucao_exercicio ee
   JOIN sessao_realizada sr ON sr.id = ee.sessao_realizada_id
   WHERE sr.paciente_id = pt.paciente_id) AS total_exec,
  -- Exercícios realizados
  (SELECT COUNT(*) FROM execucao_exercicio ee
   JOIN sessao_realizada sr ON sr.id = ee.sessao_realizada_id
   WHERE sr.paciente_id = pt.paciente_id AND ee.realizado = TRUE) AS total_realizados,
  -- Check-ins registrados
  (SELECT COUNT(*) FROM check_in_semanal ci WHERE ci.paciente_id = pt.paciente_id) AS total_checkins
FROM plano_tratamento pt
JOIN paciente p ON p.id = pt.paciente_id;

-- Métricas agregadas por profissional
CREATE OR REPLACE VIEW vw_metricas_profissional AS
SELECT
  prof.id AS profissional_id,
  prof.nome AS profissional_nome,
  prof.crefito,
  -- Volume de casos por prioridade
  COUNT(DISTINCT pm.id) AS total_planos,
  COUNT(DISTINCT pm.id) FILTER (WHERE pm.prioridade = 'alta') AS planos_alta,
  COUNT(DISTINCT pm.id) FILTER (WHERE pm.prioridade = 'moderada') AS planos_moderada,
  COUNT(DISTINCT pm.id) FILTER (WHERE pm.prioridade = 'baixa') AS planos_baixa,
  -- Planos concluídos dentro do prognóstico
  COUNT(DISTINCT pm.id) FILTER (WHERE pm.status = 'concluido') AS total_concluidos,
  COUNT(DISTINCT pm.id) FILTER (
    WHERE pm.status = 'concluido' AND pm.semana_atual <= pm.prognostico_semanas
  ) AS concluidos_no_prazo,
  -- Planos vencidos ativos
  COUNT(DISTINCT pm.id) FILTER (
    WHERE pm.status = 'ativo' AND pm.semana_atual > pm.prognostico_semanas
  ) AS planos_vencidos,
  -- Fidelidade ao protocolo
  COALESCE(SUM(pm.total_realizados), 0) AS exec_realizados,
  COALESCE(SUM(pm.total_exec), 0) AS exec_total,
  -- Check-ins
  COALESCE(SUM(pm.total_checkins), 0) AS checkins_total,
  COALESCE(SUM(pm.total_sessoes), 0) AS sessoes_total
FROM profissional prof
LEFT JOIN vw_planos_metricas pm ON pm.fisio_id = prof.id
WHERE prof.papel = 'fisioterapeuta' AND prof.ativo = TRUE
GROUP BY prof.id, prof.nome, prof.crefito;
