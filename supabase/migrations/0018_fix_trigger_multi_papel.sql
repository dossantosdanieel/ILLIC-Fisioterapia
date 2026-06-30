-- Migration 0018: corrige trigger handle_new_user para usar papeis[] (multi-papel)
-- A migration 0010 dropou a coluna "papel" e criou "papeis papel[]",
-- mas o trigger ainda tentava inserir na coluna "papel" inexistente.

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_papel papel;
  v_nome  text;
BEGIN
  -- Determinar papel inicial (default fisioterapeuta)
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

  -- Usa papeis[] (array), não papel (coluna removida em 0010)
  INSERT INTO public.profissional (auth_id, nome, email, papeis)
  VALUES (NEW.id, v_nome, NEW.email, ARRAY[v_papel])
  ON CONFLICT (email) DO UPDATE
    SET auth_id = EXCLUDED.auth_id,
        nome    = CASE WHEN profissional.nome = profissional.email
                       THEN EXCLUDED.nome
                       ELSE profissional.nome END;

  RETURN NEW;
END;
$$;
