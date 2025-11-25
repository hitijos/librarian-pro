-- Create enum for transaction status
CREATE TYPE public.transaction_status AS ENUM ('borrowed', 'returned', 'overdue');

-- Create transactions table for borrowing system
CREATE TABLE public.transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  checkout_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  due_date TIMESTAMP WITH TIME ZONE NOT NULL,
  return_date TIMESTAMP WITH TIME ZONE,
  status transaction_status NOT NULL DEFAULT 'borrowed',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users
CREATE POLICY "Authenticated users can view transactions"
  ON public.transactions
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert transactions"
  ON public.transactions
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update transactions"
  ON public.transactions
  FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete transactions"
  ON public.transactions
  FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_transactions_updated_at
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better query performance
CREATE INDEX idx_transactions_member_id ON public.transactions(member_id);
CREATE INDEX idx_transactions_book_id ON public.transactions(book_id);
CREATE INDEX idx_transactions_status ON public.transactions(status);
CREATE INDEX idx_transactions_due_date ON public.transactions(due_date);

-- Create function to checkout a book
CREATE OR REPLACE FUNCTION public.checkout_book(
  p_member_id UUID,
  p_book_id UUID,
  p_due_days INTEGER DEFAULT 14
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_transaction_id UUID;
  v_available_copies INTEGER;
BEGIN
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
  INSERT INTO transactions (
    member_id,
    book_id,
    checkout_date,
    due_date,
    status
  ) VALUES (
    p_member_id,
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

-- Create function to return a book
CREATE OR REPLACE FUNCTION public.return_book(
  p_transaction_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_book_id UUID;
  v_current_status transaction_status;
BEGIN
  -- Get transaction details
  SELECT book_id, status INTO v_book_id, v_current_status
  FROM transactions
  WHERE id = p_transaction_id;

  IF v_book_id IS NULL THEN
    RAISE EXCEPTION 'Transaction not found';
  END IF;

  IF v_current_status = 'returned' THEN
    RAISE EXCEPTION 'Book already returned';
  END IF;

  -- Update transaction record
  UPDATE transactions
  SET return_date = NOW(),
      status = 'returned'
  WHERE id = p_transaction_id;

  -- Increment available copies
  UPDATE books
  SET available_copies = available_copies + 1,
      status = CASE 
        WHEN available_copies + 1 > 0 THEN 'available'::book_status
        ELSE status
      END
  WHERE id = v_book_id;
END;
$$;