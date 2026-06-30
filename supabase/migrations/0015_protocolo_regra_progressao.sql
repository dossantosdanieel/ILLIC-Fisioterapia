-- Adiciona regra de progressão de carga aos exercícios de protocolo
-- Ex: "+2 kg a cada microciclo", "faixa_leve → faixa_moderada na semana 3"
ALTER TABLE protocolo_fase_exercicio
  ADD COLUMN IF NOT EXISTS regra_progressao text;
