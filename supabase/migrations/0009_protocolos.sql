-- ============================================================
-- ILLIC – Protocolos pré-definidos de reabilitação
-- ============================================================

CREATE TABLE IF NOT EXISTS protocolo (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome        TEXT NOT NULL,
  lesao       TEXT NOT NULL,
  descricao   TEXT,
  referencia  TEXT,
  autor_id    UUID REFERENCES profissional(id) ON DELETE SET NULL,
  ativo       BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS protocolo_fase (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  protocolo_id   UUID NOT NULL REFERENCES protocolo(id) ON DELETE CASCADE,
  ordem          INTEGER NOT NULL,
  nome           TEXT NOT NULL,
  semana_inicio  INTEGER NOT NULL,
  semana_fim     INTEGER NOT NULL,
  objetivos      TEXT[] NOT NULL DEFAULT '{}',
  CONSTRAINT protocolo_fase_semanas_check CHECK (semana_fim >= semana_inicio),
  UNIQUE (protocolo_id, ordem)
);

CREATE TABLE IF NOT EXISTS protocolo_fase_exercicio (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fase_id         UUID NOT NULL REFERENCES protocolo_fase(id) ON DELETE CASCADE,
  exercicio_id    UUID NOT NULL REFERENCES exercicio(id),
  nota            TEXT,
  ordem           INTEGER NOT NULL DEFAULT 0
);

-- ── RLS ────────────────────────────────────────────────────

ALTER TABLE protocolo ENABLE ROW LEVEL SECURITY;
ALTER TABLE protocolo_fase ENABLE ROW LEVEL SECURITY;
ALTER TABLE protocolo_fase_exercicio ENABLE ROW LEVEL SECURITY;

-- Todos os autenticados podem ler
CREATE POLICY "protocolo_select" ON protocolo FOR SELECT TO authenticated USING (true);
CREATE POLICY "protocolo_fase_select" ON protocolo_fase FOR SELECT TO authenticated USING (true);
CREATE POLICY "protocolo_fase_exercicio_select" ON protocolo_fase_exercicio FOR SELECT TO authenticated USING (true);

-- Coordenador e admin podem inserir/atualizar
CREATE POLICY "protocolo_insert" ON protocolo FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profissional WHERE auth_id = auth.uid() AND papel IN ('coordenador','admin'))
  );

CREATE POLICY "protocolo_update" ON protocolo FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profissional WHERE auth_id = auth.uid() AND papel IN ('coordenador','admin'))
  );

CREATE POLICY "protocolo_fase_insert" ON protocolo_fase FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profissional WHERE auth_id = auth.uid() AND papel IN ('coordenador','admin'))
  );

CREATE POLICY "protocolo_fase_update" ON protocolo_fase FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profissional WHERE auth_id = auth.uid() AND papel IN ('coordenador','admin'))
  );

CREATE POLICY "protocolo_fase_delete" ON protocolo_fase FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profissional WHERE auth_id = auth.uid() AND papel IN ('coordenador','admin'))
  );

CREATE POLICY "protocolo_fase_exercicio_insert" ON protocolo_fase_exercicio FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profissional WHERE auth_id = auth.uid() AND papel IN ('coordenador','admin'))
  );

CREATE POLICY "protocolo_fase_exercicio_delete" ON protocolo_fase_exercicio FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profissional WHERE auth_id = auth.uid() AND papel IN ('coordenador','admin'))
  );

-- Admin pode deletar protocolos
CREATE POLICY "protocolo_delete" ON protocolo FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profissional WHERE auth_id = auth.uid() AND papel = 'admin')
  );
