CREATE OR REPLACE FUNCTION public.delete_old_file()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  status INT;
  content TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT result.status, result.content
      INTO status, content
      FROM public.delete_storage_object_from_bucket('files', OLD.file_path) AS result;

    IF status IS NULL OR status NOT IN (200, 204, 404) THEN
      RAISE EXCEPTION 'Could not delete file storage object (%): %', status, content;
    END IF;

    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_old_message_images()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  status INT;
  content TEXT;
  image_path TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    FOREACH image_path IN ARRAY OLD.image_paths
    LOOP
      SELECT result.status, result.content
        INTO status, content
        FROM public.delete_storage_object_from_bucket('message_images', image_path) AS result;

      IF status IS NULL OR status NOT IN (200, 204, 404) THEN
        RAISE EXCEPTION 'Could not delete message image storage object (%): %', status, content;
      END IF;
    END LOOP;

    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;
