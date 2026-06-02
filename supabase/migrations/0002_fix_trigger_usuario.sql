-- Corrige o trigger de criação de profissional ao registrar usuário Auth.
-- Problema: cast implícito de text → papel enum em COALESCE causava erro.

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_papel papel;
  v_nome  text;
BEGIN
  -- Determinar papel (default fisioterapeuta)
  BEGIN
    v_papel := (NEW.raw_user_meta_data->>'papel')::papel;
  EXCEPTION WHEN OTHERS THEN
    v_papel := 'fisioterapeuta'::papel;
  END;

  IF v_papel IS NULL THEN
    v_papel := 'fisioterapeuta'::papel;
  END IF;

  -- Determinar nome
  v_nome := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'nome'), ''),
    SPLIT_PART(NEW.email, '@', 1)
  );

  INSERT INTO public.profissional (auth_id, nome, email, papel)
  VALUES (NEW.id, v_nome, NEW.email, v_papel)
  ON CONFLICT (email) DO UPDATE
    SET auth_id = EXCLUDED.auth_id,
        nome    = CASE WHEN profissional.nome = profissional.email
                       THEN EXCLUDED.nome
                       ELSE profissional.nome END;

  RETURN NEW;
END;
$$;
