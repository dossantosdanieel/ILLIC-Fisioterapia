-- Fisioterapeutas não podem criar pacientes — só coordenador e admin.
-- Pacientes são designados pelo admin/coord ao criar.

DROP POLICY IF EXISTS "paciente: fisio cria/edita os seus" ON paciente;

CREATE POLICY "paciente: coord/admin cria"
  ON paciente FOR INSERT
  WITH CHECK (meu_papel() IN ('coordenador', 'admin'));

-- Atualização: fisio pode editar apenas campos clínicos dos seus pacientes
-- (não pode mudar fisio_responsavel_id nem desativar)
DROP POLICY IF EXISTS "paciente: fisio atualiza os seus" ON paciente;

CREATE POLICY "paciente: fisio atualiza campos clínicos"
  ON paciente FOR UPDATE
  USING (
    fisio_responsavel_id = meu_profissional_id()
    OR meu_papel() IN ('coordenador', 'admin')
  );
