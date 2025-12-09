-- Create user roles enum
CREATE TYPE public.app_role AS ENUM ('admin', 'member');

-- Create user_roles table for role-based access control
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'member',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create function to get user role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1
$$;

-- RLS policies for user_roles table
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles"
ON public.user_roles
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Create member_profiles table to link auth users to member data
CREATE TABLE public.member_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on member_profiles
ALTER TABLE public.member_profiles ENABLE ROW LEVEL SECURITY;

-- RLS policies for member_profiles
CREATE POLICY "Members can view their own profile"
ON public.member_profiles
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Members can update their own profile"
ON public.member_profiles
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all profiles"
ON public.member_profiles
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage all profiles"
ON public.member_profiles
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Create member_transactions table to link member auth users to transactions
CREATE TABLE public.member_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  book_id UUID REFERENCES public.books(id) ON DELETE CASCADE NOT NULL,
  checkout_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  due_date TIMESTAMP WITH TIME ZONE NOT NULL,
  return_date TIMESTAMP WITH TIME ZONE,
  status public.transaction_status NOT NULL DEFAULT 'borrowed',
  fine_amount NUMERIC(10,2) DEFAULT 0,
  fine_paid BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on member_transactions
ALTER TABLE public.member_transactions ENABLE ROW LEVEL SECURITY;

-- RLS policies for member_transactions
CREATE POLICY "Members can view their own transactions"
ON public.member_transactions
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all member transactions"
ON public.member_transactions
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage all member transactions"
ON public.member_transactions
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Trigger for updating member_profiles updated_at
CREATE TRIGGER update_member_profiles_updated_at
BEFORE UPDATE ON public.member_profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger for updating member_transactions updated_at
CREATE TRIGGER update_member_transactions_updated_at
BEFORE UPDATE ON public.member_transactions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Function to auto-create member profile and role on signup
CREATE OR REPLACE FUNCTION public.handle_new_member_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert member role
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
  
  RETURN NEW;
END;
$$;

-- Trigger to auto-create member profile on signup
CREATE TRIGGER on_auth_user_created_member
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_member_signup();

-- Function for member to checkout book
CREATE OR REPLACE FUNCTION public.member_checkout_book(p_book_id UUID, p_due_days INTEGER DEFAULT 14)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_transaction_id UUID;
  v_available_copies INTEGER;
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  -- Check if book has available copies
  SELECT available_copies INTO v_available_copies
  FROM books
  WHERE id = p_book_id;

  IF v_available_copies IS NULL THEN
    RAISE EXCEPTION 'Book not found';
  END IF;

  IF v_available_copies <= 0 THEN
    RAISE EXCEPTION 'No available copies of this book';
  END IF;

  -- Create transaction record
  INSERT INTO member_transactions (
    user_id,
    book_id,
    checkout_date,
    due_date,
    status
  ) VALUES (
    v_user_id,
    p_book_id,
    NOW(),
    NOW() + (p_due_days || ' days')::INTERVAL,
    'borrowed'
  )
  RETURNING id INTO v_transaction_id;

  -- Decrement available copies
  UPDATE books
  SET available_copies = available_copies - 1,
      status = CASE 
        WHEN available_copies - 1 = 0 THEN 'borrowed'::book_status
        ELSE status
      END
  WHERE id = p_book_id;

  RETURN v_transaction_id;
END;
$$;

-- Function to calculate fine for member transactions
CREATE OR REPLACE FUNCTION public.calculate_member_fine(p_transaction_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_due_date TIMESTAMP WITH TIME ZONE;
  v_return_date TIMESTAMP WITH TIME ZONE;
  v_status transaction_status;
  v_overdue_days INTEGER;
  v_fine_amount NUMERIC(10,2);
BEGIN
  SELECT due_date, return_date, status
  INTO v_due_date, v_return_date, v_status
  FROM member_transactions
  WHERE id = p_transaction_id;

  IF v_due_date IS NULL THEN
    RETURN 0;
  END IF;

  IF v_return_date IS NOT NULL THEN
    v_overdue_days := GREATEST(0, EXTRACT(DAY FROM (v_return_date - v_due_date))::INTEGER);
  ELSIF v_status = 'borrowed' OR v_status = 'overdue' THEN
    v_overdue_days := GREATEST(0, EXTRACT(DAY FROM (NOW() - v_due_date))::INTEGER);
  ELSE
    v_overdue_days := 0;
  END IF;

  -- ₦200 per day
  v_fine_amount := v_overdue_days * 200;

  UPDATE member_transactions
  SET fine_amount = v_fine_amount
  WHERE id = p_transaction_id;

  RETURN v_fine_amount;
END;
$$;