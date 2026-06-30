-- Migration 0017: tempo real executado por exercício
-- Necessário para sugestão de progressão baseada na última execução

ALTER TABLE execucao_exercicio
  ADD COLUMN IF NOT EXISTS tempo_real integer DEFAULT NULL;
