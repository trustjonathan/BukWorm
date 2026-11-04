ALTER TABLE public.file_items
ADD COLUMN google_embedding vector(768);

CREATE INDEX file_items_google_embedding_idx
ON public.file_items
USING hnsw (google_embedding vector_cosine_ops);

CREATE FUNCTION public.match_file_items_google (
  query_embedding vector(768),
  match_count int DEFAULT null,
  file_ids UUID[] DEFAULT null
) RETURNS TABLE (
  id UUID,
  file_id UUID,
  content TEXT,
  tokens INT,
  similarity float
)
LANGUAGE plpgsql
AS $$
#variable_conflict use_column
BEGIN
  RETURN QUERY
  SELECT
    id,
    file_id,
    content,
    tokens,
    1 - (file_items.google_embedding <=> query_embedding) AS similarity
  FROM public.file_items
  WHERE file_id = ANY(file_ids)
    AND google_embedding IS NOT NULL
  ORDER BY file_items.google_embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

ALTER TABLE public.workspaces
ALTER COLUMN embeddings_provider SET DEFAULT 'google';

UPDATE public.workspaces
SET embeddings_provider = 'google'
WHERE embeddings_provider IS DISTINCT FROM 'google';

UPDATE public.chats
SET embeddings_provider = 'google'
WHERE embeddings_provider IS DISTINCT FROM 'google';

UPDATE public.assistants
SET embeddings_provider = 'google'
WHERE embeddings_provider IS DISTINCT FROM 'google';

UPDATE public.presets
SET embeddings_provider = 'google'
WHERE embeddings_provider IS DISTINCT FROM 'google';

CREATE OR REPLACE FUNCTION public.set_home_embeddings_provider_google()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.workspaces
  SET embeddings_provider = 'google'
  WHERE user_id = NEW.id
    AND is_home;

  RETURN NEW;
END;
$$;

CREATE TRIGGER set_home_embeddings_provider_google_trigger
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.set_home_embeddings_provider_google();
