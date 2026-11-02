BEGIN;

ALTER TABLE public.message_likes
  ADD COLUMN emoji TEXT NOT NULL DEFAULT '❤️';

ALTER TABLE public.message_likes
  DROP CONSTRAINT message_likes_pkey;

ALTER TABLE public.message_likes
  ADD CONSTRAINT message_likes_pkey
  PRIMARY KEY (message_id, user_id, emoji);

ALTER TABLE public.message_likes
  ADD CONSTRAINT message_likes_emoji_length
  CHECK (char_length(emoji) BETWEEN 1 AND 32);

COMMIT;
