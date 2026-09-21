-- 048: las reglas del cubo para el jugador, corregidas.
--
-- Revisión con contexto limpio del 2026-09-21 (Fable) sobre la feature
-- entera de Jugadores. Dos hallazgos en `storage.objects`:
--
-- 1. La regla de BORRADO del jugador estaba muerta. En la 046, dentro del
--    `exists (select 1 from public.player_files f where …)`, el `name` sin
--    cualificar se ataba a `f.name` (el nombre original del archivo), no a
--    `storage.objects.name`: la base la deparseaba como `f.storage_path =
--    f.name`, imposible por construcción. Un jugador no podía quitar del cubo
--    lo que había subido; `deletePlayerFile` borraba la fila y dejaba dos
--    objetos huérfanos. Ninguna sesión simulada había hecho de jugador.
-- 2. La regla de SUBIDA solo exigía el prefijo `{su_id}/`: un jugador podía
--    llenar el cubo con objetos sin fila que nadie ve ni puede borrar. Como
--    la app crea la fila ANTES de subir (files.ts), la regla puede exigirla.
--
-- Solo cambia políticas del cubo. `main` no tiene jugadores y sigue igual.

drop policy if exists jugadores_delete_own_unplaced on storage.objects;
drop policy if exists jugadores_insert_own on storage.objects;

-- La fila a la que pertenece el objeto, sacada de la ruta misma: el jugador
-- del primer tramo y el id del archivo del nombre ({id}.{ext} o {id}.thumb.jpg).
-- `storage.objects.name` va cualificado a propósito: `player_files` también
-- tiene una columna `name`, y sin cualificar gana la de dentro.
create policy jugadores_insert_own on storage.objects
  for insert
  with check (
    bucket_id = 'jugadores'
    and (storage.foldername(storage.objects.name))[1] = public.own_player_id(auth.uid())::text
    and exists (
      select 1
      from public.player_files f
      where f.player_id::text = (storage.foldername(storage.objects.name))[1]
        and f.id::text = split_part(storage.filename(storage.objects.name), '.', 1)
        and (f.storage_path = storage.objects.name or f.thumb_path = storage.objects.name)
        and f.folder is null
        and f.uploaded_by = auth.uid()
    )
  );

create policy jugadores_delete_own_unplaced on storage.objects
  for delete
  using (
    bucket_id = 'jugadores'
    and (storage.foldername(storage.objects.name))[1] = public.own_player_id(auth.uid())::text
    and exists (
      select 1
      from public.player_files f
      where f.player_id::text = (storage.foldername(storage.objects.name))[1]
        and f.id::text = split_part(storage.filename(storage.objects.name), '.', 1)
        and (f.storage_path = storage.objects.name or f.thumb_path = storage.objects.name)
        and f.folder is null
        and f.uploaded_by = auth.uid()
    )
  );
