-- Tabela para os objetivos da linha do tempo (Gantt por paciente)
-- Cada registro é um "segmento" numa linha da tabela
-- Linhas são agrupadas por categoria (mesmo texto = mesma linha)

CREATE TABLE IF NOT EXISTS objetivo_timeline (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plano_id      UUID NOT NULL REFERENCES plano_tratamento(id) ON DELETE CASCADE,
  categoria     TEXT NOT NULL,        -- nome da linha (ex: "HSR de glúteo médio")
  nome          TEXT NOT NULL,        -- conteúdo da célula (ex: "15 RM")
  semana_inicio INTEGER NOT NULL CHECK (semana_inicio >= 1),
  semana_fim    INTEGER NOT NULL,
  cor           TEXT NOT NULL DEFAULT 'blue', -- paleta: blue, green, purple, amber, rose, cyan
  linha_ordem   INTEGER NOT NULL DEFAULT 0,   -- ordenação da linha (categoria)
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT semanas_validas CHECK (semana_fim >= semana_inicio)
);

CREATE INDEX idx_objetivo_timeline_plano ON objetivo_timeline(plano_id, linha_ordem);

-- RLS: herda visibilidade do plano
ALTER TABLE objetivo_timeline ENABLE ROW LEVEL SECURITY;

CREATE POLICY "objetivo_timeline: visível via plano"
  ON objetivo_timeline FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM plano_tratamento p
      WHERE p.id = objetivo_timeline.plano_id
        AND (p.fisio_id = meu_profissional_id() OR meu_papel() IN ('coordenador','admin'))
    )
  );

CREATE POLICY "objetivo_timeline: gerencia via plano"
  ON objetivo_timeline FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM plano_tratamento p
      WHERE p.id = objetivo_timeline.plano_id
        AND (p.fisio_id = meu_profissional_id() OR meu_papel() IN ('coordenador','admin'))
    )
  );
