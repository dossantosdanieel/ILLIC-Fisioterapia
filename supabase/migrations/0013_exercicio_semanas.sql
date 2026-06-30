-- Faixa de semanas do exercício dentro da fase (opcional)
ALTER TABLE protocolo_fase_exercicio
  ADD COLUMN semana_inicio integer,
  ADD COLUMN semana_fim    integer;
