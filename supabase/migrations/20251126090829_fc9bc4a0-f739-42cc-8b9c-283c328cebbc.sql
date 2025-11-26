-- Add fine tracking columns to transactions table
ALTER TABLE public.transactions 
ADD COLUMN fine_amount numeric(10,2) DEFAULT 0,
ADD COLUMN fine_paid boolean DEFAULT false;

-- Function to calculate fine for a transaction
CREATE OR REPLACE FUNCTION public.calculate_fine(p_transaction_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_due_date timestamp with time zone;
  v_return_date timestamp with time zone;
  v_status transaction_status;
  v_overdue_days integer;
  v_fine_amount numeric(10,2);
BEGIN
  -- Get transaction details
  SELECT due_date, return_date, status
  INTO v_due_date, v_return_date, v_status
  FROM transactions
  WHERE id = p_transaction_id;

  IF v_due_date IS NULL THEN
    RETURN 0;
  END IF;

  -- Calculate overdue days
  IF v_return_date IS NOT NULL THEN
    -- Book was returned, calculate based on return date
    v_overdue_days := GREATEST(0, EXTRACT(DAY FROM (v_return_date - v_due_date))::integer);
  ELSIF v_status = 'borrowed' OR v_status = 'overdue' THEN
    -- Book still out, calculate based on current date
    v_overdue_days := GREATEST(0, EXTRACT(DAY FROM (NOW() - v_due_date))::integer);
  ELSE
    v_overdue_days := 0;
  END IF;

  -- Calculate fine: ₦200 per day
  v_fine_amount := v_overdue_days * 200;

  -- Update the transaction with calculated fine
  UPDATE transactions
  SET fine_amount = v_fine_amount
  WHERE id = p_transaction_id;

  RETURN v_fine_amount;
END;
$$;

-- Function to mark fine as paid
CREATE OR REPLACE FUNCTION public.mark_fine_paid(p_transaction_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  UPDATE transactions
  SET fine_paid = true
  WHERE id = p_transaction_id;
END;
$$;

-- Trigger to auto-calculate fines when returning books
CREATE OR REPLACE FUNCTION public.auto_calculate_fine()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
BEGIN
  IF NEW.return_date IS NOT NULL AND OLD.return_date IS NULL THEN
    PERFORM calculate_fine(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_auto_calculate_fine
AFTER UPDATE ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.auto_calculate_fine();