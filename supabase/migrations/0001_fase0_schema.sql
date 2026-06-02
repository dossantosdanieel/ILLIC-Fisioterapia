-- ============================================================
-- ILLIC – Fase 0: Schema, Auth, Papéis, RLS, Log de Auditoria
-- ============================================================

-- ── Extensões ──────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Enums ──────────────────────────────────────────────────
CREATE TYPE papel AS ENUM ('fisioterapeuta', 'coordenador', 'admin');
CREATE TYPE prioridade AS ENUM ('alta', 'moderada', 'baixa');
CREATE TYPE status_plano AS ENUM ('ativo', 'concluido', 'vencido', 'suspenso');
CREATE TYPE tipo_avaliacao AS ENUM ('inicial', 'reavaliacao');
CREATE TYPE operador_criterio AS ENUM ('>=', '<=', '=');
CREATE TYPE direcao_melhora AS ENUM ('maior', 'menor');
CREATE TYPE unidade_medida AS ENUM ('eva', 'graus', 'kgf', 'seg', 'percent', 'passfail');
CREATE TYPE carga_tipo AS ENUM ('kg', 'kgf', 'percent_1rm', 'rm', 'banda_cor', 'peso_corporal', 'tempo');
CREATE TYPE tipo_notificacao AS ENUM (
  'criterio_nao_atingido', 'plano_vencido', 'checkin_pendente',
  'fase_transicao', 'sessao_alterada'
);
CREATE TYPE trajetoria_caso AS ENUM ('melhorando', 'estavel', 'piorando');
CREATE TYPE confianca_prognostico AS ENUM ('no_caminho', 'em_risco', 'preciso_rever');
CREATE TYPE aderencia_paciente AS ENUM ('boa', 'parcial', 'baixa');
CREATE TYPE motivo_nao_realizado AS ENUM ('dor', 'fadiga', 'equipamento', 'falta', 'progressao_antecipada', 'outro');

-- ── Tabela: profissional ────────────────────────────────────
CREATE TABLE IF NOT EXISTS profissional (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id     UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  nome        TEXT NOT NULL,
  crefito     TEXT,
  email       TEXT NOT NULL UNIQUE,
  papel       papel NOT NULL DEFAULT 'fisioterapeuta',
  ativo       BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Tabela: paciente ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS paciente (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome                  TEXT NOT NULL,
  data_nascimento       DATE,
  diagnostico           TEXT,
  hipotese_diagnostica  TEXT,
  prioridade            prioridade NOT NULL DEFAULT 'moderada',
  convenio_plano        TEXT,
  fisio_responsavel_id  UUID NOT NULL REFERENCES profissional(id),
  consentimento_lgpd    BOOLEAN NOT NULL DEFAULT FALSE,
  data_consentimento    TIMESTAMPTZ,
  ativo                 BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Tabela: plano_tratamento ────────────────────────────────
CREATE TABLE IF NOT EXISTS plano_tratamento (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id         UUID NOT NULL REFERENCES paciente(id),
  fisio_id            UUID NOT NULL REFERENCES profissional(id),
  prognostico_semanas INTEGER NOT NULL CHECK (prognostico_semanas > 0),
  frequencia_semanal  INTEGER NOT NULL CHECK (frequencia_semanal BETWEEN 1 AND 7),
  data_av_inicial     DATE NOT NULL,
  status              status_plano NOT NULL DEFAULT 'ativo',
  objetivos           TEXT[] NOT NULL DEFAULT '{}',
  criado_em           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Tabela: fase ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fase (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plano_id      UUID NOT NULL REFERENCES plano_tratamento(id) ON DELETE CASCADE,
  ordem         INTEGER NOT NULL,
  nome          TEXT NOT NULL,
  semana_inicio INTEGER NOT NULL,
  semana_fim    INTEGER NOT NULL,
  objetivos     TEXT[] NOT NULL DEFAULT '{}',
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fase_semanas_check CHECK (semana_fim >= semana_inicio),
  UNIQUE (plano_id, ordem)
);

-- ── Tabela: criterio_fase ───────────────────────────────────
CREATE TABLE IF NOT EXISTS criterio_fase (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fase_id     UUID NOT NULL REFERENCES fase(id) ON DELETE CASCADE,
  medida_id   UUID NOT NULL, -- FK adicionada após criar medida
  operador    operador_criterio NOT NULL,
  valor_alvo  NUMERIC NOT NULL
);

-- ── Tabela: microciclo ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS microciclo (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fase_id       UUID NOT NULL REFERENCES fase(id) ON DELETE CASCADE,
  ordem         INTEGER NOT NULL,
  semana_inicio INTEGER NOT NULL,
  semana_fim    INTEGER NOT NULL,
  CONSTRAINT microciclo_semanas_check CHECK (semana_fim >= semana_inicio),
  UNIQUE (fase_id, ordem)
);

-- ── Tabela: sessao_template ────────────────────────────────
CREATE TABLE IF NOT EXISTS sessao_template (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  microciclo_id   UUID NOT NULL REFERENCES microciclo(id) ON DELETE CASCADE,
  nome            TEXT
);

-- ── Tabela: bloco ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bloco (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sessao_template_id  UUID NOT NULL REFERENCES sessao_template(id) ON DELETE CASCADE,
  nome                TEXT NOT NULL,
  ordem               INTEGER NOT NULL
);

-- ── Tabela: exercicio (catálogo) ───────────────────────────
CREATE TABLE IF NOT EXISTS exercicio (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome            TEXT NOT NULL,
  descricao       TEXT,
  video_url       TEXT,
  grupo_muscular  TEXT,
  ativo           BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Tabela: exercicio_prescrito ────────────────────────────
CREATE TABLE IF NOT EXISTS exercicio_prescrito (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bloco_id          UUID NOT NULL REFERENCES bloco(id) ON DELETE CASCADE,
  exercicio_id      UUID NOT NULL REFERENCES exercicio(id),
  series            INTEGER NOT NULL CHECK (series > 0),
  reps              INTEGER,
  tempo_seg         INTEGER,
  carga_tipo        carga_tipo NOT NULL,
  carga_valor       TEXT NOT NULL,
  nota              TEXT,
  condicional       BOOLEAN NOT NULL DEFAULT FALSE,
  ordem             INTEGER NOT NULL,
  regra_progressao  TEXT,
  CONSTRAINT reps_ou_tempo CHECK (reps IS NOT NULL OR tempo_seg IS NOT NULL)
);

-- ── Tabela: sessao_realizada ───────────────────────────────
CREATE TABLE IF NOT EXISTS sessao_realizada (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sessao_template_id  UUID NOT NULL REFERENCES sessao_template(id),
  paciente_id         UUID NOT NULL REFERENCES paciente(id),
  profissional_id     UUID NOT NULL REFERENCES profissional(id),
  data                DATE NOT NULL,
  observacao          TEXT,
  criado_em           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Tabela: execucao_exercicio ─────────────────────────────
CREATE TABLE IF NOT EXISTS execucao_exercicio (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sessao_realizada_id     UUID NOT NULL REFERENCES sessao_realizada(id),
  exercicio_prescrito_id  UUID NOT NULL REFERENCES exercicio_prescrito(id),
  realizado               BOOLEAN NOT NULL DEFAULT FALSE,
  carga_real              TEXT,
  reps_real               INTEGER,
  motivo_nao_realizado    motivo_nao_realizado,
  motivo_texto            TEXT,
  alterado_em_tempo_real  BOOLEAN NOT NULL DEFAULT FALSE,
  criado_em               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (sessao_realizada_id, exercicio_prescrito_id)
);

-- ── Tabela: medida (catálogo de desfechos) ─────────────────
CREATE TABLE IF NOT EXISTS medida (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome            TEXT NOT NULL,
  unidade         unidade_medida NOT NULL,
  direcao_melhora direcao_melhora NOT NULL,
  ativo           BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- FK de criterio_fase para medida (adicionada agora)
ALTER TABLE criterio_fase
  ADD CONSTRAINT criterio_fase_medida_fk
  FOREIGN KEY (medida_id) REFERENCES medida(id);

-- ── Tabela: avaliacao ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS avaliacao (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id     UUID NOT NULL REFERENCES paciente(id),
  profissional_id UUID NOT NULL REFERENCES profissional(id),
  plano_id        UUID REFERENCES plano_tratamento(id),
  tipo            tipo_avaliacao NOT NULL,
  data            DATE NOT NULL,
  numero_reav     INTEGER,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Tabela: valor_medida ───────────────────────────────────
CREATE TABLE IF NOT EXISTS valor_medida (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  avaliacao_id  UUID NOT NULL REFERENCES avaliacao(id),
  medida_id     UUID NOT NULL REFERENCES medida(id),
  valor         NUMERIC NOT NULL,
  UNIQUE (avaliacao_id, medida_id)
);

-- ── Tabela: check_in_semanal ───────────────────────────────
CREATE TABLE IF NOT EXISTS check_in_semanal (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id       UUID NOT NULL REFERENCES paciente(id),
  profissional_id   UUID NOT NULL REFERENCES profissional(id),
  semana            INTEGER NOT NULL CHECK (semana BETWEEN 1 AND 53),
  ano               INTEGER NOT NULL,
  data              DATE NOT NULL,
  trajetoria        trajetoria_caso NOT NULL,
  confianca         confianca_prognostico NOT NULL,
  aderencia         aderencia_paciente NOT NULL,
  sinal_alerta      TEXT,
  precisa_discutir  BOOLEAN NOT NULL DEFAULT FALSE,
  criado_em         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (paciente_id, semana, ano)
);

-- ── Tabela: nota_reuniao ───────────────────────────────────
CREATE TABLE IF NOT EXISTS nota_reuniao (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id     UUID NOT NULL REFERENCES paciente(id),
  autor_id        UUID NOT NULL REFERENCES profissional(id),
  data            DATE NOT NULL,
  texto           TEXT NOT NULL,
  acao_definida   TEXT,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Tabela: notificacao ────────────────────────────────────
CREATE TABLE IF NOT EXISTS notificacao (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  destinatario_id UUID NOT NULL REFERENCES profissional(id),
  tipo            tipo_notificacao NOT NULL,
  payload         JSONB NOT NULL DEFAULT '{}',
  lida            BOOLEAN NOT NULL DEFAULT FALSE,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Tabela: transicao_fase ─────────────────────────────────
CREATE TABLE IF NOT EXISTS transicao_fase (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fase_origem_id        UUID NOT NULL REFERENCES fase(id),
  fase_destino_id       UUID NOT NULL REFERENCES fase(id),
  decidido_por_id       UUID NOT NULL REFERENCES profissional(id),
  data_decisao          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  criterios_atingidos   BOOLEAN NOT NULL,
  justificativa         TEXT,
  criado_em             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Tabela: log_auditoria (imutável) ───────────────────────
CREATE TABLE IF NOT EXISTS log_auditoria (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ator_id     UUID REFERENCES profissional(id) ON DELETE SET NULL,
  acao        TEXT NOT NULL,
  entidade    TEXT NOT NULL,
  entidade_id UUID,
  payload     JSONB,
  ip          TEXT,
  timestamp   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Log imutável: sem UPDATE, sem DELETE
CREATE RULE log_no_update AS ON UPDATE TO log_auditoria DO INSTEAD NOTHING;
CREATE RULE log_no_delete AS ON DELETE TO log_auditoria DO INSTEAD NOTHING;

-- ── Índices ────────────────────────────────────────────────
CREATE INDEX idx_paciente_fisio ON paciente(fisio_responsavel_id);
CREATE INDEX idx_plano_paciente ON plano_tratamento(paciente_id);
CREATE INDEX idx_plano_status ON plano_tratamento(status);
CREATE INDEX idx_sessao_realizada_data ON sessao_realizada(data);
CREATE INDEX idx_sessao_realizada_paciente ON sessao_realizada(paciente_id);
CREATE INDEX idx_check_in_paciente_semana ON check_in_semanal(paciente_id, ano, semana);
CREATE INDEX idx_notificacao_dest ON notificacao(destinatario_id, lida);
CREATE INDEX idx_log_timestamp ON log_auditoria(timestamp DESC);
CREATE INDEX idx_log_ator ON log_auditoria(ator_id);

-- ── Trigger: atualiza plano_tratamento.atualizado_em ───────
CREATE OR REPLACE FUNCTION set_atualizado_em()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.atualizado_em = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER plano_atualizado_em
  BEFORE UPDATE ON plano_tratamento
  FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();

-- ── Trigger: auto-cria profissional ao registrar usuário ───
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO profissional (auth_id, nome, email, papel)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', NEW.email),
    NEW.email,
    COALESCE((NEW.raw_user_meta_data->>'papel')::papel, 'fisioterapeuta')
  )
  ON CONFLICT (email) DO UPDATE SET auth_id = NEW.id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ── Função auxiliar: papel do usuário autenticado ──────────
CREATE OR REPLACE FUNCTION meu_papel()
RETURNS papel LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT papel FROM profissional WHERE auth_id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION meu_profissional_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT id FROM profissional WHERE auth_id = auth.uid()
$$;

-- ── RLS: habilitar em todas as tabelas ─────────────────────
ALTER TABLE profissional       ENABLE ROW LEVEL SECURITY;
ALTER TABLE paciente           ENABLE ROW LEVEL SECURITY;
ALTER TABLE plano_tratamento   ENABLE ROW LEVEL SECURITY;
ALTER TABLE fase               ENABLE ROW LEVEL SECURITY;
ALTER TABLE criterio_fase      ENABLE ROW LEVEL SECURITY;
ALTER TABLE microciclo         ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessao_template    ENABLE ROW LEVEL SECURITY;
ALTER TABLE bloco              ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercicio          ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercicio_prescrito ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessao_realizada   ENABLE ROW LEVEL SECURITY;
ALTER TABLE execucao_exercicio ENABLE ROW LEVEL SECURITY;
ALTER TABLE medida             ENABLE ROW LEVEL SECURITY;
ALTER TABLE avaliacao          ENABLE ROW LEVEL SECURITY;
ALTER TABLE valor_medida       ENABLE ROW LEVEL SECURITY;
ALTER TABLE check_in_semanal   ENABLE ROW LEVEL SECURITY;
ALTER TABLE nota_reuniao       ENABLE ROW LEVEL SECURITY;
ALTER TABLE notificacao        ENABLE ROW LEVEL SECURITY;
ALTER TABLE transicao_fase     ENABLE ROW LEVEL SECURITY;
ALTER TABLE log_auditoria      ENABLE ROW LEVEL SECURITY;

-- ── RLS: profissional ──────────────────────────────────────
CREATE POLICY "profissional: lê o próprio perfil"
  ON profissional FOR SELECT
  USING (auth_id = auth.uid() OR meu_papel() IN ('coordenador','admin'));

CREATE POLICY "profissional: admin gerencia"
  ON profissional FOR ALL
  USING (meu_papel() = 'admin');

-- ── RLS: paciente ──────────────────────────────────────────
CREATE POLICY "paciente: fisio vê os seus"
  ON paciente FOR SELECT
  USING (
    fisio_responsavel_id = meu_profissional_id()
    OR meu_papel() IN ('coordenador','admin')
  );

CREATE POLICY "paciente: fisio cria/edita os seus"
  ON paciente FOR INSERT
  WITH CHECK (fisio_responsavel_id = meu_profissional_id() OR meu_papel() IN ('coordenador','admin'));

CREATE POLICY "paciente: fisio atualiza os seus"
  ON paciente FOR UPDATE
  USING (fisio_responsavel_id = meu_profissional_id() OR meu_papel() IN ('coordenador','admin'));

-- ── RLS: plano_tratamento ──────────────────────────────────
CREATE POLICY "plano: fisio vê os seus"
  ON plano_tratamento FOR SELECT
  USING (
    fisio_id = meu_profissional_id()
    OR meu_papel() IN ('coordenador','admin')
  );

CREATE POLICY "plano: fisio cria"
  ON plano_tratamento FOR INSERT
  WITH CHECK (fisio_id = meu_profissional_id() OR meu_papel() IN ('coordenador','admin'));

CREATE POLICY "plano: fisio/coord atualiza"
  ON plano_tratamento FOR UPDATE
  USING (fisio_id = meu_profissional_id() OR meu_papel() IN ('coordenador','admin'));

-- ── RLS: fase (herda do plano) ─────────────────────────────
CREATE POLICY "fase: visível via plano"
  ON fase FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM plano_tratamento p
      WHERE p.id = fase.plano_id
        AND (p.fisio_id = meu_profissional_id() OR meu_papel() IN ('coordenador','admin'))
    )
  );

CREATE POLICY "fase: gerencia via plano"
  ON fase FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM plano_tratamento p
      WHERE p.id = fase.plano_id
        AND (p.fisio_id = meu_profissional_id() OR meu_papel() IN ('coordenador','admin'))
    )
  );

-- ── RLS: criterio_fase ─────────────────────────────────────
CREATE POLICY "criterio: visível via fase"
  ON criterio_fase FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM fase f
      JOIN plano_tratamento p ON p.id = f.plano_id
      WHERE f.id = criterio_fase.fase_id
        AND (p.fisio_id = meu_profissional_id() OR meu_papel() IN ('coordenador','admin'))
    )
  );

CREATE POLICY "criterio: gerencia via fase"
  ON criterio_fase FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM fase f
      JOIN plano_tratamento p ON p.id = f.plano_id
      WHERE f.id = criterio_fase.fase_id
        AND (p.fisio_id = meu_profissional_id() OR meu_papel() IN ('coordenador','admin'))
    )
  );

-- ── RLS: microciclo ────────────────────────────────────────
CREATE POLICY "microciclo: visível via fase"
  ON microciclo FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM fase f
      JOIN plano_tratamento p ON p.id = f.plano_id
      WHERE f.id = microciclo.fase_id
        AND (p.fisio_id = meu_profissional_id() OR meu_papel() IN ('coordenador','admin'))
    )
  );

CREATE POLICY "microciclo: gerencia via fase"
  ON microciclo FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM fase f
      JOIN plano_tratamento p ON p.id = f.plano_id
      WHERE f.id = microciclo.fase_id
        AND (p.fisio_id = meu_profissional_id() OR meu_papel() IN ('coordenador','admin'))
    )
  );

-- ── RLS: sessao_template, bloco, exercicio_prescrito ───────
CREATE POLICY "sessao_template: visível via microciclo"
  ON sessao_template FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM microciclo m
      JOIN fase f ON f.id = m.fase_id
      JOIN plano_tratamento p ON p.id = f.plano_id
      WHERE m.id = sessao_template.microciclo_id
        AND (p.fisio_id = meu_profissional_id() OR meu_papel() IN ('coordenador','admin'))
    )
  );

CREATE POLICY "sessao_template: gerencia"
  ON sessao_template FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM microciclo m
      JOIN fase f ON f.id = m.fase_id
      JOIN plano_tratamento p ON p.id = f.plano_id
      WHERE m.id = sessao_template.microciclo_id
        AND (p.fisio_id = meu_profissional_id() OR meu_papel() IN ('coordenador','admin'))
    )
  );

CREATE POLICY "bloco: visível e gerenciável via template"
  ON bloco FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM sessao_template st
      JOIN microciclo m ON m.id = st.microciclo_id
      JOIN fase f ON f.id = m.fase_id
      JOIN plano_tratamento p ON p.id = f.plano_id
      WHERE st.id = bloco.sessao_template_id
        AND (p.fisio_id = meu_profissional_id() OR meu_papel() IN ('coordenador','admin'))
    )
  );

CREATE POLICY "exercicio_prescrito: gerencia via bloco"
  ON exercicio_prescrito FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM bloco b
      JOIN sessao_template st ON st.id = b.sessao_template_id
      JOIN microciclo m ON m.id = st.microciclo_id
      JOIN fase f ON f.id = m.fase_id
      JOIN plano_tratamento p ON p.id = f.plano_id
      WHERE b.id = exercicio_prescrito.bloco_id
        AND (p.fisio_id = meu_profissional_id() OR meu_papel() IN ('coordenador','admin'))
    )
  );

-- ── RLS: exercicio (catálogo — todos leem, admin gerencia) ──
CREATE POLICY "exercicio: todos autenticados leem"
  ON exercicio FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "exercicio: admin gerencia"
  ON exercicio FOR ALL
  USING (meu_papel() = 'admin');

-- ── RLS: medida ────────────────────────────────────────────
CREATE POLICY "medida: todos autenticados leem"
  ON medida FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "medida: admin gerencia"
  ON medida FOR ALL
  USING (meu_papel() = 'admin');

-- ── RLS: sessao_realizada ──────────────────────────────────
CREATE POLICY "sessao_realizada: fisio vê as suas"
  ON sessao_realizada FOR SELECT
  USING (
    profissional_id = meu_profissional_id()
    OR meu_papel() IN ('coordenador','admin')
  );

CREATE POLICY "sessao_realizada: fisio registra"
  ON sessao_realizada FOR INSERT
  WITH CHECK (profissional_id = meu_profissional_id() OR meu_papel() IN ('coordenador','admin'));

-- sessão registrada não se edita (apenas aditamento)
CREATE POLICY "sessao_realizada: sem update direto"
  ON sessao_realizada FOR UPDATE
  USING (meu_papel() = 'admin');

-- ── RLS: execucao_exercicio ────────────────────────────────
CREATE POLICY "execucao: fisio gerencia as suas"
  ON execucao_exercicio FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM sessao_realizada sr
      WHERE sr.id = execucao_exercicio.sessao_realizada_id
        AND (sr.profissional_id = meu_profissional_id() OR meu_papel() IN ('coordenador','admin'))
    )
  );

-- ── RLS: avaliacao ─────────────────────────────────────────
CREATE POLICY "avaliacao: fisio vê e cria as suas"
  ON avaliacao FOR ALL
  USING (
    profissional_id = meu_profissional_id()
    OR meu_papel() IN ('coordenador','admin')
  );

-- ── RLS: valor_medida ──────────────────────────────────────
CREATE POLICY "valor_medida: acesso via avaliacao"
  ON valor_medida FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM avaliacao av
      WHERE av.id = valor_medida.avaliacao_id
        AND (av.profissional_id = meu_profissional_id() OR meu_papel() IN ('coordenador','admin'))
    )
  );

-- ── RLS: check_in_semanal ──────────────────────────────────
CREATE POLICY "checkin: fisio gerencia os seus"
  ON check_in_semanal FOR ALL
  USING (
    profissional_id = meu_profissional_id()
    OR meu_papel() IN ('coordenador','admin')
  );

-- ── RLS: nota_reuniao ──────────────────────────────────────
CREATE POLICY "nota: coordenador/admin gerencia"
  ON nota_reuniao FOR ALL
  USING (meu_papel() IN ('coordenador','admin'));

CREATE POLICY "nota: fisio lê notas dos seus pacientes"
  ON nota_reuniao FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM paciente p
      WHERE p.id = nota_reuniao.paciente_id
        AND p.fisio_responsavel_id = meu_profissional_id()
    )
  );

-- ── RLS: notificacao ───────────────────────────────────────
CREATE POLICY "notificacao: vê as próprias"
  ON notificacao FOR SELECT
  USING (destinatario_id = meu_profissional_id());

CREATE POLICY "notificacao: marca como lida"
  ON notificacao FOR UPDATE
  USING (destinatario_id = meu_profissional_id());

CREATE POLICY "notificacao: sistema insere (service role)"
  ON notificacao FOR INSERT
  WITH CHECK (TRUE); -- service role bypassa RLS; anon key nunca chega aqui

-- ── RLS: transicao_fase ────────────────────────────────────
CREATE POLICY "transicao: coordenador/admin gerencia"
  ON transicao_fase FOR ALL
  USING (meu_papel() IN ('coordenador','admin'));

CREATE POLICY "transicao: fisio lê via plano"
  ON transicao_fase FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM fase f
      JOIN plano_tratamento p ON p.id = f.plano_id
      WHERE f.id = transicao_fase.fase_origem_id
        AND p.fisio_id = meu_profissional_id()
    )
  );

-- ── RLS: log_auditoria ─────────────────────────────────────
CREATE POLICY "log: admin lê tudo"
  ON log_auditoria FOR SELECT
  USING (meu_papel() = 'admin');

CREATE POLICY "log: sistema insere (service role)"
  ON log_auditoria FOR INSERT
  WITH CHECK (TRUE);

-- ── Dados iniciais: medidas padrão ─────────────────────────
INSERT INTO medida (nome, unidade, direcao_melhora) VALUES
  ('Dor (EVA)', 'eva', 'menor'),
  ('ADM Flexão Ombro', 'graus', 'maior'),
  ('ADM Abdução Ombro', 'graus', 'maior'),
  ('ADM Rotação Interna Ombro', 'graus', 'maior'),
  ('ADM Rotação Externa Ombro', 'graus', 'maior'),
  ('CIVM Rotadores Laterais Ombro', 'kgf', 'maior'),
  ('CIVM Rotadores Mediais Ombro', 'kgf', 'maior'),
  ('CIVM Abdutores Ombro', 'kgf', 'maior'),
  ('CIVM Flexores Joelho', 'kgf', 'maior'),
  ('CIVM Extensores Joelho', 'kgf', 'maior'),
  ('Single Hop Test', 'percent', 'maior'),
  ('Triple Hop Test', 'percent', 'maior'),
  ('Y-Balance Test Anterior', 'percent', 'maior'),
  ('IKDC Subjetivo', 'percent', 'maior'),
  ('DASH Score', 'percent', 'menor'),
  ('VISA-A Score', 'percent', 'maior'),
  ('Teste de Neer', 'passfail', 'menor'),
  ('Teste de Hawkins-Kennedy', 'passfail', 'menor'),
  ('Apley Compression', 'passfail', 'menor'),
  ('Lachman Test', 'passfail', 'menor')
ON CONFLICT DO NOTHING;
