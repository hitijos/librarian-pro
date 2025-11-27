-- Create function to renew borrowed books
CREATE OR REPLACE FUNCTION public.renew_book(
  p_transaction_id UUID,
  p_extend_days INTEGER DEFAULT 14
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT,
  new_due_date TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status transaction_status;
  v_member_id UUID;
  v_current_due_date TIMESTAMP WITH TIME ZONE;
  v_unpaid_fines_count INTEGER;
BEGIN
  -- Get transaction details
  SELECT status, member_id, due_date
  INTO v_status, v_member_id, v_current_due_date
  FROM transactions
  WHERE id = p_transaction_id;

  -- Check if transaction exists
  IF v_status IS NULL THEN
    RETURN QUERY SELECT false, 'Transaction not found'::TEXT, NULL::TIMESTAMP WITH TIME ZONE;
    RETURN;
  END IF;

  -- Check if book is currently borrowed
  IF v_status != 'borrowed' AND v_status != 'overdue' THEN
    RETURN QUERY SELECT false, 'Book must be currently borrowed to renew'::TEXT, NULL::TIMESTAMP WITH TIME ZONE;
    RETURN;
  END IF;

  -- Check for unpaid fines for this member
  SELECT COUNT(*)
  INTO v_unpaid_fines_count
  FROM transactions
  WHERE member_id = v_member_id
    AND fine_amount > 0
    AND fine_paid = false;

  IF v_unpaid_fines_count > 0 THEN
    RETURN QUERY SELECT false, 'Member has unpaid fines. Please clear fines before renewing.'::TEXT, NULL::TIMESTAMP WITH TIME ZONE;
    RETURN;
  END IF;

  -- Extend the due date
  UPDATE transactions
  SET due_date = due_date + (p_extend_days || ' days')::INTERVAL,
      status = 'borrowed'::transaction_status
  WHERE id = p_transaction_id
  RETURNING due_date INTO v_current_due_date;

  RETURN QUERY SELECT true, 'Book renewed successfully'::TEXT, v_current_due_date;
END;
$$;