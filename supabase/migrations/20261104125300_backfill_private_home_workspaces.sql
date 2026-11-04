UPDATE public.workspaces
SET sharing = 'private'
WHERE is_home
  AND sharing <> 'private';

INSERT INTO public.workspaces (
  user_id,
  is_home,
  name,
  sharing,
  default_context_length,
  default_model,
  default_prompt,
  default_temperature,
  description,
  embeddings_provider,
  include_profile_context,
  include_workspace_instructions,
  instructions
)
SELECT
  users.id,
  TRUE,
  'Home',
  'private',
  4096,
  'gpt-4-turbo-preview',
  'You are a friendly, helpful AI assistant.',
  0.5,
  'My home workspace.',
  'openai',
  TRUE,
  TRUE,
  ''
FROM auth.users AS users
WHERE NOT EXISTS (
  SELECT 1
  FROM public.workspaces AS workspaces
  WHERE workspaces.user_id = users.id
    AND workspaces.is_home
)
ON CONFLICT (user_id) WHERE is_home DO NOTHING;
