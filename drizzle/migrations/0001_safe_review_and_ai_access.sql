CREATE OR REPLACE FUNCTION public.owns_card(_card uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT EXISTS (SELECT 1 FROM public.cards c JOIN public.islands i ON i.id=c.island_id WHERE c.id=_card AND i.user_id=auth.uid()) $$;
REVOKE ALL ON FUNCTION public.owns_card(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.owns_card(uuid) TO authenticated;
ALTER POLICY own_states ON public.card_states USING (user_id=auth.uid() AND public.owns_card(card_id)) WITH CHECK (user_id=auth.uid() AND public.owns_card(card_id));
ALTER POLICY own_logs ON public.review_logs USING (user_id=auth.uid() AND public.owns_card(card_id)) WITH CHECK (user_id=auth.uid() AND public.owns_card(card_id));
CREATE OR REPLACE FUNCTION public.record_review(_card uuid, _rating integer, _review_id uuid) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE s public.card_states; n real; r integer; l integer; t timestamptz := now();
BEGIN
 IF auth.uid() IS NULL OR NOT public.owns_card(_card) OR _rating NOT BETWEEN 1 AND 3 THEN RAISE EXCEPTION 'review unavailable'; END IF;
 PERFORM id FROM public.cards WHERE id=_card AND NOT reported FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'card unavailable'; END IF;
 IF EXISTS(SELECT 1 FROM public.review_logs WHERE id=_review_id AND user_id=auth.uid()) THEN RETURN; END IF;
 INSERT INTO public.card_states(card_id,user_id) VALUES(_card,auth.uid()) ON CONFLICT DO NOTHING;
 SELECT * INTO s FROM public.card_states WHERE card_id=_card AND user_id=auth.uid() FOR UPDATE;
 r:=s.reps; l:=s.lapses;
 IF _rating=1 THEN n:=1; r:=0; l:=l+1;
 ELSIF _rating=2 THEN n:=CASE WHEN s.last_review_at IS NULL OR s.interval_days<=0 THEN 2 ELSE round((s.interval_days*1.2)::numeric,2) END;
 ELSE r:=r+1; n:=CASE WHEN r<=6 THEN (ARRAY[1,3,7,14,30,60])[r] ELSE round((s.interval_days*2.2)::numeric,2) END;
 END IF;
 UPDATE public.card_states SET interval_days=n,reps=r,lapses=l,last_review_at=t,due_at=t+n*interval '1 day' WHERE card_id=_card AND user_id=auth.uid();
 INSERT INTO public.review_logs(id,card_id,user_id,rating,reviewed_at) VALUES(_review_id,_card,auth.uid(),_rating,t);
END $$;
REVOKE ALL ON FUNCTION public.record_review(uuid,integer,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_review(uuid,integer,uuid) TO authenticated;
CREATE TABLE public.ai_access_blocks(user_id uuid PRIMARY KEY DEFAULT auth.uid(), message text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT,INSERT,UPDATE,DELETE ON public.ai_access_blocks TO authenticated;
GRANT ALL ON public.ai_access_blocks TO service_role;
ALTER TABLE public.ai_access_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_ai_access_blocks ON public.ai_access_blocks FOR ALL TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());