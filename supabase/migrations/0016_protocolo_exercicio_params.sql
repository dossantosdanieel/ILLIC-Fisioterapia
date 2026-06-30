-- Adiciona parâmetros de prescrição aos exercícios de protocolo
-- Permite aplicar protocolo e já ter sessão pronta para executar sem BuilderSessao manual
ALTER TABLE protocolo_fase_exercicio
  ADD COLUMN IF NOT EXISTS series   integer  NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS reps     integer  DEFAULT 10,
  ADD COLUMN IF NOT EXISTS tempo_seg integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS carga_tipo text   NOT NULL DEFAULT 'kg',
  ADD COLUMN IF NOT EXISTS carga_valor text  NOT NULL DEFAULT '0';
