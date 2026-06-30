-- ============================================================
-- ILLIC – Papéis múltiplos por profissional
-- ============================================================

-- 1. Remove dependentes da coluna papel antes de dropar
DROP VIEW IF EXISTS vw_metricas_profissional;

DROP POLICY IF EXISTS "protocolo_insert"                ON protocolo;
DROP POLICY IF EXISTS "protocolo_update"                ON protocolo;
DROP POLICY IF EXISTS "protocolo_delete"                ON protocolo;
DROP POLICY IF EXISTS "protocolo_fase_insert"           ON protocolo_fase;
DROP POLICY IF EXISTS "protocolo_fase_update"           ON protocolo_fase;
DROP POLICY IF EXISTS "protocolo_fase_delete"           ON protocolo_fase;
DROP POLICY IF EXISTS "protocolo_fase_exercicio_insert" ON protocolo_fase_exercicio;
DROP POLICY IF EXISTS "protocolo_fase_exercicio_delete" ON protocolo_fase_exercicio;

-- 2. Adiciona coluna papeis[], migra dados, remove papel
ALTER TABLE profissional
  ADD COLUMN papeis papel[] NOT NULL DEFAULT '{fisioterapeuta}';

UPDATE profissional SET papeis = ARRAY[papel];

ALTER TABLE profissional DROP COLUMN papel;

-- 3. Recria meu_papel() retornando o papel mais alto do array
--    (todas as políticas RLS existentes continuam funcionando)
CREATE OR REPLACE FUNCTION meu_papel()
RETURNS papel LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT CASE
    WHEN 'admin'       = ANY(papeis) THEN 'admin'::papel
    WHEN 'coordenador' = ANY(papeis) THEN 'coordenador'::papel
    ELSE 'fisioterapeuta'::papel
  END
  FROM profissional WHERE auth_id = auth.uid()
$$;

-- 4. Novo helper: verifica se o usuário tem um papel específico
CREATE OR REPLACE FUNCTION tem_papel(p papel)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT p = ANY(papeis) FROM profissional WHERE auth_id = auth.uid()
$$;

-- 5. Recria a view usando papeis (ANY para fisioterapeuta)
CREATE OR REPLACE VIEW vw_metricas_profissional AS
SELECT
  prof.id AS profissional_id,
  prof.nome AS profissional_nome,
  prof.crefito,
  COUNT(DISTINCT pm.id) AS total_planos,
  COUNT(DISTINCT pm.id) FILTER (WHERE pm.prioridade = 'alta') AS planos_alta,
  COUNT(DISTINCT pm.id) FILTER (WHERE pm.prioridade = 'moderada') AS planos_moderada,
  COUNT(DISTINCT pm.id) FILTER (WHERE pm.prioridade = 'baixa') AS planos_baixa,
  COUNT(DISTINCT pm.id) FILTER (WHERE pm.status = 'concluido') AS total_concluidos,
  COUNT(DISTINCT pm.id) FILTER (
    WHERE pm.status = 'concluido' AND pm.semana_atual <= pm.prognostico_semanas
  ) AS concluidos_no_prazo,
  COUNT(DISTINCT pm.id) FILTER (
    WHERE pm.status = 'ativo' AND pm.semana_atual > pm.prognostico_semanas
  ) AS planos_vencidos,
  COALESCE(SUM(pm.total_realizados), 0) AS exec_realizados,
  COALESCE(SUM(pm.total_exec), 0) AS exec_total,
  COALESCE(SUM(pm.total_checkins), 0) AS checkins_total,
  COALESCE(SUM(pm.total_sessoes), 0) AS sessoes_total
FROM profissional prof
LEFT JOIN vw_planos_metricas pm ON pm.fisio_id = prof.id
WHERE 'fisioterapeuta' = ANY(prof.papeis) AND prof.ativo = TRUE
GROUP BY prof.id, prof.nome, prof.crefito;

-- 6. Recria políticas de protocolo usando tem_papel()
CREATE POLICY "protocolo_insert" ON protocolo FOR INSERT TO authenticated
  WITH CHECK (tem_papel('coordenador') OR tem_papel('admin'));

CREATE POLICY "protocolo_update" ON protocolo FOR UPDATE TO authenticated
  USING (tem_papel('coordenador') OR tem_papel('admin'));

CREATE POLICY "protocolo_delete" ON protocolo FOR DELETE TO authenticated
  USING (tem_papel('admin'));

CREATE POLICY "protocolo_fase_insert" ON protocolo_fase FOR INSERT TO authenticated
  WITH CHECK (tem_papel('coordenador') OR tem_papel('admin'));

CREATE POLICY "protocolo_fase_update" ON protocolo_fase FOR UPDATE TO authenticated
  USING (tem_papel('coordenador') OR tem_papel('admin'));

CREATE POLICY "protocolo_fase_delete" ON protocolo_fase FOR DELETE TO authenticated
  USING (tem_papel('coordenador') OR tem_papel('admin'));

CREATE POLICY "protocolo_fase_exercicio_insert" ON protocolo_fase_exercicio FOR INSERT TO authenticated
  WITH CHECK (tem_papel('coordenador') OR tem_papel('admin'));

CREATE POLICY "protocolo_fase_exercicio_delete" ON protocolo_fase_exercicio FOR DELETE TO authenticated
  USING (tem_papel('coordenador') OR tem_papel('admin'));
