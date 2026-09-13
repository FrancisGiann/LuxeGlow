-- Add welcome and password_changed to the notification_outbox kind check
ALTER TABLE public.notification_outbox DROP CONSTRAINT IF EXISTS notification_outbox_kind_check;
ALTER TABLE public.notification_outbox ADD CONSTRAINT notification_outbox_kind_check 
  CHECK (kind in ('pending', 'confirmed', 'reminder', 'cancelled', 'completed', 'welcome', 'password_changed'));

ALTER TABLE public.appointment_notification_log DROP CONSTRAINT IF EXISTS appointment_notification_log_kind_check;
ALTER TABLE public.appointment_notification_log ADD CONSTRAINT appointment_notification_log_kind_check 
  CHECK (kind in ('pending', 'confirmed', 'reminder', 'cancelled', 'completed', 'welcome', 'password_changed'));

-- Function to handle welcome email
CREATE OR REPLACE FUNCTION public.handle_user_email_confirmed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.email_confirmed_at IS NOT NULL AND OLD.email_confirmed_at IS NULL THEN
    INSERT INTO public.notification_outbox (recipient_id, kind, payload)
    VALUES (
      NEW.id,
      'welcome',
      jsonb_build_object(
        'title', 'Welcome to Astrid Nails & Beauty Bar!',
        'message', 'Your email has been successfully verified! Welcome to Astrid Nails & Beauty Bar. You can now book your favorite services directly from our website.'
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger for welcome email
DROP TRIGGER IF EXISTS on_auth_user_email_confirmed ON auth.users;
CREATE TRIGGER on_auth_user_email_confirmed
  AFTER UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_user_email_confirmed();

-- Function to handle password changed email
CREATE OR REPLACE FUNCTION public.handle_user_password_changed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.encrypted_password IS DISTINCT FROM OLD.encrypted_password THEN
    -- Only trigger if this is an update to an already confirmed user, to avoid spam on initial sign up
    IF OLD.email_confirmed_at IS NOT NULL THEN
      INSERT INTO public.notification_outbox (recipient_id, kind, payload)
      VALUES (
        NEW.id,
        'password_changed',
        jsonb_build_object(
          'title', 'Your Password Has Been Changed',
          'message', 'This is a confirmation that the password for your Astrid Nails & Beauty Bar account has been successfully changed. If you did not make this change, please contact us immediately to secure your account.'
        )
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger for password changed email
DROP TRIGGER IF EXISTS on_auth_user_password_changed ON auth.users;
CREATE TRIGGER on_auth_user_password_changed
  AFTER UPDATE OF encrypted_password ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_user_password_changed();

