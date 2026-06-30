-- ============================================================
-- ILLIC – Objetivos estruturados nas fases de protocolo
-- ============================================================

CREATE OR REPLACE FUNCTION _conv_objetivos(arr text[])
RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT COALESCE(
    (SELECT jsonb_agg(jsonb_build_object('texto', elem, 'semana_inicio', null, 'semana_fim', null))
     FROM unnest(arr) AS elem),
    '[]'::jsonb
  )
$$;

-- Remove default antigo antes de mudar o tipo
ALTER TABLE protocolo_fase ALTER COLUMN objetivos DROP DEFAULT;

ALTER TABLE protocolo_fase
  ALTER COLUMN objetivos TYPE jsonb
  USING _conv_objetivos(objetivos);

ALTER TABLE protocolo_fase
  ALTER COLUMN objetivos SET DEFAULT '[]'::jsonb;

DROP FUNCTION _conv_objetivos(text[]);
