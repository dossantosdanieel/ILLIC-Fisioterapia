-- Catálogo inicial de exercícios para a clínica ILLIC
INSERT INTO exercicio (nome, grupo_muscular, descricao) VALUES
  -- Ombro
  ('Rotação Externa com Haltere', 'Rotadores de ombro', 'Decúbito lateral, cotovelo a 90°'),
  ('Rotação Interna com Haltere', 'Rotadores de ombro', 'Decúbito lateral, cotovelo a 90°'),
  ('Rotação Externa com Faixa Elástica', 'Rotadores de ombro', 'Em pé, cotovelo a 90°, faixa fixada lateralmente'),
  ('Rotação Interna com Faixa Elástica', 'Rotadores de ombro', 'Em pé, cotovelo a 90°, faixa fixada lateralmente'),
  ('Abdução de Ombro', 'Deltóide', 'Em pé ou sentado, elevação no plano frontal'),
  ('Elevação no Plano da Escápula', 'Deltóide / Manguito', 'Elevação a 30° da linha sagital'),
  ('Press Overhead', 'Deltóide anterior', 'Em pé ou sentado, empurrar para cima'),
  ('Remada Baixa', 'Retratores de escápula', 'Polia baixa ou faixa, cotovelos junto ao corpo'),
  ('Remada Alta', 'Trapézio médio', 'Polia alta, cotovelos abertos'),
  ('Cruzes em Pé', 'Peitoral / Deltóide', 'Com faixas ou cabos, fase concêntrica controlada'),
  ('Pull-down', 'Grande dorsal', 'Polia alta, puxar até o queixo'),
  ('Encurvamento Escapular', 'Serrátil anterior', 'Em decúbito dorsal, empurrar escápulas para fora'),
  ('Fortalecimento de Trapézio Inferior', 'Trapézio inferior', 'Decúbito ventral, elevação em Y'),
  ('Fortalecimento em W', 'Rotadores externos / Trapézio', 'Decúbito ventral, posição de W com os braços'),

  -- Joelho / Quadril
  ('Agachamento', 'Quadríceps / Glúteo', 'Bilateral, controle de joelhos alinhados'),
  ('Agachamento Unilateral', 'Quadríceps / Glúteo', 'Fase excêntrica de 3-4s'),
  ('Extensão de Joelho na Cadeira', 'Quadríceps', 'Arco terminal ou arco completo conforme indicação'),
  ('Flexão de Joelho em Decúbito', 'Isquiotibiais', 'Bilateral ou unilateral'),
  ('Leg Press', 'Quadríceps / Glúteo', 'Footplate a 45°, atenção ao joelho'),
  ('Stiff', 'Isquiotibiais / Glúteo', 'Barra ou halteres, coluna neutra'),
  ('Hip Thrust', 'Glúteo máximo', 'Apoio em banco, pé plano no chão'),
  ('Abdução de Quadril', 'Glúteo médio', 'Em pé com faixa ou deitado'),
  ('Adução de Quadril', 'Adutores', 'Em pé com faixa ou na máquina'),
  ('Panturrilha (elevação de calcâneo)', 'Gastrocnêmio / Sóleo', 'Bilateral ou unilateral, com ou sem carga'),

  -- Controle neuromuscular / propriocepção
  ('Apoio Unipodal Estático', 'Estabilizadores de tornozelo/joelho', 'Solo firme → espuma → olhos fechados'),
  ('Apoio Unipodal com Perturbação', 'Estabilizadores dinâmicos', 'Fisio aplica perturbações externas'),
  ('Salto Unipodal (Single Hop)', 'Quadríceps / Estabilizadores', 'Para frente, medir distância'),
  ('Triple Hop', 'Quadríceps / Estabilizadores', '3 saltos consecutivos unipodais, medir distância'),
  ('Star Excursion Balance Test', 'Estabilizadores globais', 'Alcance máximo nas 8 direções'),
  ('Agachamento no Bosu', 'Estabilizadores de tornozelo/joelho', 'Base instável'),

  -- Terapia manual / mobilização
  ('Mobilização GU Ombro Grau III', 'Articulação glenoumeral', 'Deslizamento inferior para ganho de ADM'),
  ('Mobilização Acromioclavicular', 'AC joint', 'Pressão ântero-posterior'),
  ('Mobilização Patelofemoral', 'Patela', 'Deslizamento medial/lateral/inferior'),
  ('Mobilização Talocrural', 'Tornozelo', 'Deslizamento anterior/posterior do tálus'),
  ('Dry Needling', 'Trigger points', 'Pontos-gatilho musculares'),
  ('TENS / Corrente analgésica', 'Analgesia', 'Parâmetros conforme protocolo da clínica'),
  ('Ultrassom Terapêutico', 'Tecidos moles', 'Modo pulsado ou contínuo conforme fase'),
  ('Crioterapia', 'Anti-inflamatório local', 'Gelo por 15–20 min'),
  ('Termoterapia', 'Relaxamento muscular', 'Calor úmido por 15–20 min')
ON CONFLICT DO NOTHING;
