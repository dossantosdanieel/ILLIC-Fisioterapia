-- Adiciona tipos de faixa elástica ao enum carga_tipo
-- Decathlon: leve (~3 kg), moderada (~6 kg), forte (~12 kg)
-- Rinoforce superbands: leve (~10 kg), média (~20 kg), forte (~40 kg)

ALTER TYPE carga_tipo ADD VALUE IF NOT EXISTS 'faixa_leve';
ALTER TYPE carga_tipo ADD VALUE IF NOT EXISTS 'faixa_moderada';
ALTER TYPE carga_tipo ADD VALUE IF NOT EXISTS 'faixa_forte';
ALTER TYPE carga_tipo ADD VALUE IF NOT EXISTS 'superband_leve';
ALTER TYPE carga_tipo ADD VALUE IF NOT EXISTS 'superband_media';
ALTER TYPE carga_tipo ADD VALUE IF NOT EXISTS 'superband_forte';
