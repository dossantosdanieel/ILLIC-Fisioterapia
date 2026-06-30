-- Liga exercício/terapia ao objetivo da fase ao qual está alinhado
ALTER TABLE protocolo_fase_exercicio
  ADD COLUMN objetivo_texto text;
