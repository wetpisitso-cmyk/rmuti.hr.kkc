-- Payment proof is required before the final application submission
-- for positions whose fee_amount > 0. Supabase enforces this regardless of
-- whether the applicant follows the UI wizard.
CREATE OR REPLACE FUNCTION private.require_payment_slip_on_submit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_fee numeric;
BEGIN
  IF NEW.status = 'submitted' AND OLD.status IN ('draft','needs_correction') THEN
    SELECT fee_amount INTO v_fee FROM public.job_positions WHERE id=NEW.job_id;
    IF coalesce(v_fee,0) > 0 AND NOT EXISTS (
      SELECT 1
      FROM public.payment_records p
      JOIN public.application_documents d
        ON d.id=p.document_id AND d.application_id=NEW.id
           AND d.document_type='payment' AND d.storage_path=p.slip_path
      WHERE p.application_id=NEW.id
        AND p.status IN ('pending','confirmed')
        AND p.amount=v_fee
    ) THEN
      RAISE EXCEPTION 'PAYMENT_SLIP_REQUIRED';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS require_payment_slip_before_submit ON public.applications;
CREATE TRIGGER require_payment_slip_before_submit
  BEFORE UPDATE OF status ON public.applications
  FOR EACH ROW EXECUTE FUNCTION private.require_payment_slip_on_submit();
