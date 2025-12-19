-- Add 'staff' role to the app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'staff';

-- Update the trigger function to also handle staff role assignment
CREATE OR REPLACE FUNCTION public.handle_new_member_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if this is the admin email
  IF NEW.email = 'admin@librarian-pro.test' THEN
    -- Insert admin role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin');
    
    -- Insert admin profile
    INSERT INTO public.member_profiles (user_id, full_name, email, phone)
    VALUES (
      NEW.id,
      'System Admin',
      NEW.email,
      NULL
    );
  ELSE
    -- Insert member role for regular users
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'member');
    
    -- Insert member profile with data from signup metadata
    INSERT INTO public.member_profiles (user_id, full_name, email, phone)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data ->> 'full_name', 'Member'),
      NEW.email,
      NEW.raw_user_meta_data ->> 'phone'
    );
  END IF;
  
  RETURN NEW;
END;
$$;