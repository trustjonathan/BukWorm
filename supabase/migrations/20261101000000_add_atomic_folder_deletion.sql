CREATE OR REPLACE FUNCTION public.delete_folder_and_items(
  p_folder_id UUID,
  p_content_type TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF p_content_type NOT IN (
    'chats',
    'presets',
    'prompts',
    'files',
    'collections',
    'assistants',
    'tools',
    'models'
  ) THEN
    RAISE EXCEPTION 'Unsupported folder content type: %', p_content_type;
  END IF;

  EXECUTE format(
    'DELETE FROM public.%I WHERE folder_id = $1',
    p_content_type
  )
  USING p_folder_id;

  DELETE FROM public.folders
  WHERE id = p_folder_id
    AND type = p_content_type;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Folder not found or access denied.';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_folder_and_items(UUID, TEXT)
TO authenticated;
