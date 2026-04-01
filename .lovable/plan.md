

## Fix: Guest Portal Registration Error

### Root Cause
The `handle_guest_signup()` database trigger tries to insert `guest_type = 'foreign'` into the `guests` table, but the `guest_type` enum only has two valid values: `local` and `international`. This causes a database error on every guest registration attempt.

### Error
```
invalid input value for enum guest_type: "foreign"
```

### Fix
Update the `handle_guest_signup()` trigger function to use `'international'` instead of `'foreign'`:

```sql
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
      'international'  -- was 'foreign' which doesn't exist in the enum
    );
  END IF;
  RETURN NEW;
END;
$$;
```

### Single migration file
One SQL migration to replace the function definition.

### Verification
- Register a new guest account at `/guest/register`
- Confirm no "Database error saving new user" toast
- Confirm guest record created in `guests` table
- Confirm profile record created in `profiles` table
- Confirm guest can log in and reach `/guest/dashboard`

