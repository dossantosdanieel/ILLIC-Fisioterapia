-- Campos livres para a avaliação (eventualidades não cobertas pelo catálogo)
ALTER TABLE avaliacao
  ADD COLUMN IF NOT EXISTS observacoes TEXT,
  ADD COLUMN IF NOT EXISTS campos_adicionais JSONB NOT NULL DEFAULT '[]';

-- Comentário de contexto
COMMENT ON COLUMN avaliacao.campos_adicionais IS
  'Array de {nome, valor, unidade} para campos avulsos registrados na hora da avaliação';
