-- Applied to production on 13 Nov 2026. New submissions must answer all
-- personal fields; saved drafts and submitted historical applications are untouched.
-- Applicants without LINE or extra skills can truthfully enter "ไม่มี".
CREATE OR REPLACE FUNCTION private.applicant_required_fields_valid(p_personal jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE STRICT SET search_path TO ''
AS $function$
 SELECT
   jsonb_typeof(p_personal) = 'object'
   AND char_length(btrim(coalesce(p_personal->>'english_name', ''))) BETWEEN 3 AND 200
   AND btrim(coalesce(p_personal->>'english_name', '')) ~ '^[A-Za-z][A-Za-z .''-]*[A-Za-z]$'
   AND coalesce(p_personal->>'gender', '') IN ('ชาย', 'หญิง', 'อื่น ๆ', 'ไม่ประสงค์ระบุ')
   AND char_length(btrim(coalesce(p_personal->>'nationality', ''))) BETWEEN 1 AND 100
   AND coalesce(p_personal->>'marital_status', '') IN ('โสด', 'สมรส', 'หย่า', 'หม้าย', 'อื่น ๆ')
   AND char_length(btrim(coalesce(p_personal->>'registered_address', ''))) BETWEEN 1 AND 2000
   AND char_length(btrim(coalesce(p_personal->>'ethnicity', ''))) BETWEEN 1 AND 100
   AND char_length(btrim(coalesce(p_personal->>'religion', ''))) BETWEEN 1 AND 100
   AND char_length(btrim(coalesce(p_personal->>'line_id', ''))) BETWEEN 1 AND 100
   AND char_length(btrim(coalesce(p_personal->>'skills', ''))) BETWEEN 1 AND 2000;
$function$;
