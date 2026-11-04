-- Run manually to create profiles for existing auth users who have no profile.
-- This file is intentionally outside supabase/migrations and is not applied.
INSERT INTO public.profiles (
  user_id,
  bio,
  display_name,
  image_path,
  image_url,
  profile_context,
  use_azure_openai,
  username
)
SELECT
  users.id,
  '',
  LEFT(COALESCE(NULLIF(users.raw_user_meta_data->>'full_name', ''), ''), 100),
  '',
  '',
  '',
  FALSE,
  'user' || SUBSTR(REPLACE(gen_random_uuid()::text, '-', ''), 1, 16)
FROM auth.users AS users
LEFT JOIN public.profiles AS profiles ON profiles.user_id = users.id
WHERE profiles.user_id IS NULL
ON CONFLICT (user_id) DO NOTHING;
