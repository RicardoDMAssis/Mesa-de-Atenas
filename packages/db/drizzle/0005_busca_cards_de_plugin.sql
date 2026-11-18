-- Cards de plugin (type = 'plugin') entram na busca pelo texto da reserva (`fallback`):
-- o `content` deles só o plugin sabe interpretar.
DROP TRIGGER `cards_search_insert`;
--> statement-breakpoint
DROP TRIGGER `cards_search_update`;
--> statement-breakpoint
CREATE TRIGGER `cards_search_insert` AFTER INSERT ON `cards` WHEN new.deleted_at IS NULL BEGIN
  INSERT INTO search_index (kind, ref_id, title, body)
  VALUES (
    'card', new.id, '',
    CASE WHEN new.type = 'plugin' THEN
      coalesce(json_extract(new.fallback, '$.front'), '') || ' ' ||
      coalesce(json_extract(new.fallback, '$.back'), '')
    ELSE
      coalesce(json_extract(new.content, '$.front'), '') || ' ' ||
      coalesce(json_extract(new.content, '$.back'), '') || ' ' ||
      coalesce(json_extract(new.content, '$.text'), '') || ' ' ||
      coalesce(json_extract(new.content, '$.extra'), '')
    END
  );
END;
--> statement-breakpoint
CREATE TRIGGER `cards_search_update` AFTER UPDATE OF `content`, `fallback`, `deleted_at` ON `cards` BEGIN
  DELETE FROM search_index WHERE kind = 'card' AND ref_id = old.id;
  INSERT INTO search_index (kind, ref_id, title, body)
  SELECT
    'card', new.id, '',
    CASE WHEN new.type = 'plugin' THEN
      coalesce(json_extract(new.fallback, '$.front'), '') || ' ' ||
      coalesce(json_extract(new.fallback, '$.back'), '')
    ELSE
      coalesce(json_extract(new.content, '$.front'), '') || ' ' ||
      coalesce(json_extract(new.content, '$.back'), '') || ' ' ||
      coalesce(json_extract(new.content, '$.text'), '') || ' ' ||
      coalesce(json_extract(new.content, '$.extra'), '')
    END
  WHERE new.deleted_at IS NULL;
END;
