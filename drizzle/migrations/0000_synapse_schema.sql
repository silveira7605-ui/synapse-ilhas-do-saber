
CREATE TABLE public.islands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL,
  emoji text NOT NULL DEFAULT '🏝️',
  color text NOT NULL DEFAULT 'var(--isle-violet)',
  map_x real NOT NULL DEFAULT 50,
  map_y real NOT NULL DEFAULT 50,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  island_id uuid NOT NULL REFERENCES public.islands(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('pdf','image','text')),
  file_path text,
  raw_text text,
  status text NOT NULL DEFAULT 'processing' CHECK (status IN ('processing','done','failed')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.concepts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  island_id uuid NOT NULL REFERENCES public.islands(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.concepts(id) ON DELETE CASCADE,
  title text NOT NULL,
  summary text,
  depth int NOT NULL DEFAULT 0 CHECK (depth BETWEEN 0 AND 2),
  importance int NOT NULL DEFAULT 3 CHECK (importance BETWEEN 1 AND 5),
  source_quote text
);
CREATE TABLE public.cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  island_id uuid NOT NULL REFERENCES public.islands(id) ON DELETE CASCADE,
  concept_id uuid REFERENCES public.concepts(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('cloze','qa')),
  front text NOT NULL,
  back text NOT NULL,
  source_quote text,
  reported boolean NOT NULL DEFAULT false
);
CREATE TABLE public.card_states (
  card_id uuid NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  due_at timestamptz NOT NULL DEFAULT now(),
  interval_days real NOT NULL DEFAULT 0,
  reps int NOT NULL DEFAULT 0,
  lapses int NOT NULL DEFAULT 0,
  last_review_at timestamptz,
  PRIMARY KEY (card_id, user_id)
);
CREATE TABLE public.review_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  rating int NOT NULL CHECK (rating BETWEEN 1 AND 3),
  reviewed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.islands(user_id);
CREATE INDEX ON public.concepts(island_id);
CREATE INDEX ON public.cards(island_id);
CREATE INDEX ON public.review_logs(user_id, reviewed_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.islands, public.sources, public.concepts, public.cards, public.card_states, public.review_logs TO authenticated;
GRANT ALL ON public.islands, public.sources, public.concepts, public.cards, public.card_states, public.review_logs TO service_role;

ALTER TABLE public.islands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.concepts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.card_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_logs ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.owns_island(_island uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.islands WHERE id = _island AND user_id = auth.uid())
$$;

CREATE POLICY own_islands ON public.islands FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY own_sources ON public.sources FOR ALL TO authenticated USING (public.owns_island(island_id)) WITH CHECK (public.owns_island(island_id));
CREATE POLICY own_concepts ON public.concepts FOR ALL TO authenticated USING (public.owns_island(island_id)) WITH CHECK (public.owns_island(island_id));
CREATE POLICY own_cards ON public.cards FOR ALL TO authenticated USING (public.owns_island(island_id)) WITH CHECK (public.owns_island(island_id));
CREATE POLICY own_states ON public.card_states FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY own_logs ON public.review_logs FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY own_files_select ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'materials' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY own_files_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'materials' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY own_files_delete ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'materials' AND (storage.foldername(name))[1] = auth.uid()::text);
