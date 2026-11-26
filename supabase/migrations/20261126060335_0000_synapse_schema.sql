/*
# Synapse — Full schema for islands, sources, concepts, cards, review system

## What this migration does
Creates the complete database for the Synapse study app: islands (subjects), sources (study material), concepts (topic tree), cards (flashcards), card_states (spaced-repetition state), and review_logs (history). Each table is protected by row-level security so a user only sees their own data. Also creates a private storage bucket for uploaded PDFs and photos.

## New tables
1. `islands` — each subject is an island on the map. Columns: id (uuid PK), user_id (uuid, defaults to auth.uid(), references auth.users), name, emoji, color, map_x, map_y, created_at.
2. `sources` — uploaded study material per island. Columns: id, island_id (FK→islands CASCADE), kind (pdf|image|text), file_path, raw_text, status (processing|done|failed), created_at.
3. `concepts` — topic tree up to 3 levels. Columns: id, island_id (FK), parent_id (self-ref CASCADE), title, summary, depth (0-2), importance (1-5), source_quote.
4. `cards` — flashcards. Columns: id, island_id (FK), concept_id (FK→concepts CASCADE), type (cloze|qa), front, back, source_quote, reported (bool, for flagging wrong cards).
5. `card_states` — spaced-repetition state per user per card. Composite PK (card_id, user_id). Columns: due_at, interval_days, reps, lapses, last_review_at.
6. `review_logs` — every review event. Columns: id, card_id (FK), user_id, rating (1-3), reviewed_at.

## Security
- RLS enabled on all 6 tables.
- `authenticated` role gets SELECT/INSERT/UPDATE/DELETE on all tables.
- `service_role` gets ALL on all tables (used by edge functions).
- islands: owner-scoped by user_id = auth.uid().
- sources/concepts/cards: scoped through owns_island() helper (checks island ownership).
- card_states/review_logs: scoped by user_id = auth.uid().
- Storage: private "materials" bucket; policies ensure users can only read/insert/delete files in their own folder (auth.uid() as first path segment).
- owns_island() is a SECURITY DEFINER function (runs as owner, safe because it only does a read).
- REVOKE EXECUTE on owns_island from PUBLIC and anon so only authenticated can call it.
*/

-- ── Tables ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.islands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  emoji text NOT NULL DEFAULT '🏝️',
  color text NOT NULL DEFAULT 'var(--isle-violet)',
  map_x real NOT NULL DEFAULT 50,
  map_y real NOT NULL DEFAULT 50,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  island_id uuid NOT NULL REFERENCES public.islands(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('pdf','image','text')),
  file_path text,
  raw_text text,
  status text NOT NULL DEFAULT 'processing' CHECK (status IN ('processing','done','failed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.concepts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  island_id uuid NOT NULL REFERENCES public.islands(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.concepts(id) ON DELETE CASCADE,
  title text NOT NULL,
  summary text,
  depth int NOT NULL DEFAULT 0 CHECK (depth BETWEEN 0 AND 2),
  importance int NOT NULL DEFAULT 3 CHECK (importance BETWEEN 1 AND 5),
  source_quote text
);

CREATE TABLE IF NOT EXISTS public.cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  island_id uuid NOT NULL REFERENCES public.islands(id) ON DELETE CASCADE,
  concept_id uuid REFERENCES public.concepts(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('cloze','qa')),
  front text NOT NULL,
  back text NOT NULL,
  source_quote text,
  reported boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS public.card_states (
  card_id uuid NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  due_at timestamptz NOT NULL DEFAULT now(),
  interval_days real NOT NULL DEFAULT 0,
  reps int NOT NULL DEFAULT 0,
  lapses int NOT NULL DEFAULT 0,
  last_review_at timestamptz,
  PRIMARY KEY (card_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.review_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  rating int NOT NULL CHECK (rating BETWEEN 1 AND 3),
  reviewed_at timestamptz NOT NULL DEFAULT now()
);

-- ── Indexes ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_islands_user ON public.islands(user_id);
CREATE INDEX IF NOT EXISTS idx_concepts_island ON public.concepts(island_id);
CREATE INDEX IF NOT EXISTS idx_cards_island ON public.cards(island_id);
CREATE INDEX IF NOT EXISTS idx_review_logs_user ON public.review_logs(user_id, reviewed_at);
CREATE INDEX IF NOT EXISTS idx_card_states_due ON public.card_states(user_id, due_at);

-- ── Grants ──────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON public.islands, public.sources, public.concepts, public.cards, public.card_states, public.review_logs TO authenticated;
GRANT ALL ON public.islands, public.sources, public.concepts, public.cards, public.card_states, public.review_logs TO service_role;

-- ── RLS ─────────────────────────────────────────────────
ALTER TABLE public.islands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.concepts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.card_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_logs ENABLE ROW LEVEL SECURITY;

-- ── Helper function ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.owns_island(_island uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.islands WHERE id = _island AND user_id = auth.uid())
$$;
REVOKE EXECUTE ON FUNCTION public.owns_island(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owns_island(uuid) TO authenticated;

-- ── Policies (4 per table: SELECT/INSERT/UPDATE/DELETE) ─
-- islands
DROP POLICY IF EXISTS "islands_select_own" ON public.islands;
CREATE POLICY "islands_select_own" ON public.islands FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "islands_insert_own" ON public.islands;
CREATE POLICY "islands_insert_own" ON public.islands FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "islands_update_own" ON public.islands;
CREATE POLICY "islands_update_own" ON public.islands FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "islands_delete_own" ON public.islands;
CREATE POLICY "islands_delete_own" ON public.islands FOR DELETE TO authenticated USING (user_id = auth.uid());

-- sources
DROP POLICY IF EXISTS "sources_select_own" ON public.sources;
CREATE POLICY "sources_select_own" ON public.sources FOR SELECT TO authenticated USING (public.owns_island(island_id));
DROP POLICY IF EXISTS "sources_insert_own" ON public.sources;
CREATE POLICY "sources_insert_own" ON public.sources FOR INSERT TO authenticated WITH CHECK (public.owns_island(island_id));
DROP POLICY IF EXISTS "sources_update_own" ON public.sources;
CREATE POLICY "sources_update_own" ON public.sources FOR UPDATE TO authenticated USING (public.owns_island(island_id)) WITH CHECK (public.owns_island(island_id));
DROP POLICY IF EXISTS "sources_delete_own" ON public.sources;
CREATE POLICY "sources_delete_own" ON public.sources FOR DELETE TO authenticated USING (public.owns_island(island_id));

-- concepts
DROP POLICY IF EXISTS "concepts_select_own" ON public.concepts;
CREATE POLICY "concepts_select_own" ON public.concepts FOR SELECT TO authenticated USING (public.owns_island(island_id));
DROP POLICY IF EXISTS "concepts_insert_own" ON public.concepts;
CREATE POLICY "concepts_insert_own" ON public.concepts FOR INSERT TO authenticated WITH CHECK (public.owns_island(island_id));
DROP POLICY IF EXISTS "concepts_update_own" ON public.concepts;
CREATE POLICY "concepts_update_own" ON public.concepts FOR UPDATE TO authenticated USING (public.owns_island(island_id)) WITH CHECK (public.owns_island(island_id));
DROP POLICY IF EXISTS "concepts_delete_own" ON public.concepts;
CREATE POLICY "concepts_delete_own" ON public.concepts FOR DELETE TO authenticated USING (public.owns_island(island_id));

-- cards
DROP POLICY IF EXISTS "cards_select_own" ON public.cards;
CREATE POLICY "cards_select_own" ON public.cards FOR SELECT TO authenticated USING (public.owns_island(island_id));
DROP POLICY IF EXISTS "cards_insert_own" ON public.cards;
CREATE POLICY "cards_insert_own" ON public.cards FOR INSERT TO authenticated WITH CHECK (public.owns_island(island_id));
DROP POLICY IF EXISTS "cards_update_own" ON public.cards;
CREATE POLICY "cards_update_own" ON public.cards FOR UPDATE TO authenticated USING (public.owns_island(island_id)) WITH CHECK (public.owns_island(island_id));
DROP POLICY IF EXISTS "cards_delete_own" ON public.cards;
CREATE POLICY "cards_delete_own" ON public.cards FOR DELETE TO authenticated USING (public.owns_island(island_id));

-- card_states
DROP POLICY IF EXISTS "card_states_select_own" ON public.card_states;
CREATE POLICY "card_states_select_own" ON public.card_states FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "card_states_insert_own" ON public.card_states;
CREATE POLICY "card_states_insert_own" ON public.card_states FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "card_states_update_own" ON public.card_states;
CREATE POLICY "card_states_update_own" ON public.card_states FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "card_states_delete_own" ON public.card_states;
CREATE POLICY "card_states_delete_own" ON public.card_states FOR DELETE TO authenticated USING (user_id = auth.uid());

-- review_logs
DROP POLICY IF EXISTS "review_logs_select_own" ON public.review_logs;
CREATE POLICY "review_logs_select_own" ON public.review_logs FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "review_logs_insert_own" ON public.review_logs;
CREATE POLICY "review_logs_insert_own" ON public.review_logs FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "review_logs_update_own" ON public.review_logs;
CREATE POLICY "review_logs_update_own" ON public.review_logs FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "review_logs_delete_own" ON public.review_logs;
CREATE POLICY "review_logs_delete_own" ON public.review_logs FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ── Storage: private bucket for PDFs & images ───────────
INSERT INTO storage.buckets (id, name, public) VALUES ('materials', 'materials', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "own_files_select" ON storage.objects;
CREATE POLICY "own_files_select" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'materials' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "own_files_insert" ON storage.objects;
CREATE POLICY "own_files_insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'materials' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "own_files_update" ON storage.objects;
CREATE POLICY "own_files_update" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'materials' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'materials' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "own_files_delete" ON storage.objects;
CREATE POLICY "own_files_delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'materials' AND (storage.foldername(name))[1] = auth.uid()::text);