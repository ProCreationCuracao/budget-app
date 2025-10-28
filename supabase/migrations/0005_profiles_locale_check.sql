-- Normalize and constrain profiles.locale to a reasonable shape like en-US
-- 1) Normalize case: language lower, region upper
update public.profiles
set locale = case
  when locale is null then null
  when position('-' in locale) > 0 then lower(split_part(locale,'-',1)) || '-' || upper(split_part(locale,'-',2))
  else lower(locale)
end
where locale is not null;

-- 2) Replace clearly invalid formats with en-US
update public.profiles
set locale = 'en-US'
where locale is null or locale !~ '^[a-z]{2,}(-[A-Z]{2,})?$';

-- 3) Add CHECK constraint for shape (does not validate real BCP47, only shape)
alter table if exists public.profiles
  add constraint if not exists profiles_locale_format
  check (locale is null or locale ~ '^[a-z]{2,}(-[A-Z]{2,})?$');
