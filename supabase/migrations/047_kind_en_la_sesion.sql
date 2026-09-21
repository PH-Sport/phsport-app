-- 047: la clase de cuenta viaja dentro de la sesión.
--
-- Cada navegación pasaba por el servidor de la app, que preguntaba a la base
-- «¿esta cuenta es agencia o jugador?» para mandar a cada uno a su marco. Con
-- la app en otro continente que la base (medido el 2026-09-18: 1,3–3,5 s solo
-- en empezar a responder), esa pregunta era la mitad del retraso.
--
-- Ahora `kind` se copia a `app_metadata` de la cuenta. Supabase lo devuelve
-- con la sesión, así que el servidor lo sabe sin consultar nada. Es
-- `app_metadata` y no `user_metadata` a propósito: el usuario no puede
-- editarlo, y por eso sirve para decidir acceso.
--
-- Solo añade: un trigger y un relleno de las ocho cuentas. `main` no lee
-- app_metadata para nada y sigue igual.

create function public.sync_kind_to_auth()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update auth.users
  set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('kind', new.kind::text)
  where id = new.id;
  return new;
end;
$$;

-- Solo la dispara el trigger; nadie la llama a mano.
revoke execute on function public.sync_kind_to_auth() from public, anon, authenticated;

-- AFTER: el perfil nace desde un trigger AFTER INSERT de auth.users
-- (handle_new_user), así que la cuenta ya existe cuando esto escribe en ella.
create trigger trg_profiles_kind_to_auth
  after insert or update of kind on public.profiles
  for each row execute function public.sync_kind_to_auth();

-- Las cuentas que ya existen: las ocho son AGENCIA. Sin el relleno también
-- funcionaría (sin `kind` en la sesión se asume agencia), pero mejor explícito.
update auth.users u
set raw_app_meta_data = coalesce(u.raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('kind', p.kind::text)
from public.profiles p
where p.id = u.id;
