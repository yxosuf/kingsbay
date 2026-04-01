CREATE OR REPLACE FUNCTION public.handle_guest_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.raw_user_meta_data->>'user_type' = 'guest' THEN
    INSERT INTO public.guests (
      name, email, phone, auth_user_id, guest_type
    ) VALUES (
      COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
      NEW.email,
      NEW.raw_user_meta_data->>'phone',
      NEW.id,
      'international'
    );
  END IF;
  RETURN NEW;
END;
$$;