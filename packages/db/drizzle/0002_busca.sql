-- Busca textual (FTS5) em notas e cards, mantida por gatilhos.
-- `remove_diacritics 2` faz "fonetica" encontrar "fonética".
CREATE VIRTUAL TABLE `search_index` USING fts5(
  kind UNINDEXED,
  ref_id UNINDEXED,
  title,
  body,
  tokenize = 'unicode61 remove_diacritics 2'
);
--> statement-breakpoint
CREATE TRIGGER `notes_search_insert` AFTER INSERT ON `notes` WHEN new.deleted_at IS NULL BEGIN
  INSERT INTO search_index (kind, ref_id, title, body)
  VALUES ('note', new.id, new.title, new.plain_text);
END;
--> statement-breakpoint
CREATE TRIGGER `notes_search_update` AFTER UPDATE ON `notes` BEGIN
  DELETE FROM search_index WHERE kind = 'note' AND ref_id = old.id;
  INSERT INTO search_index (kind, ref_id, title, body)
  SELECT 'note', new.id, new.title, new.plain_text WHERE new.deleted_at IS NULL;
END;
--> statement-breakpoint
CREATE TRIGGER `notes_search_delete` AFTER DELETE ON `notes` BEGIN
  DELETE FROM search_index WHERE kind = 'note' AND ref_id = old.id;
END;
--> statement-breakpoint
CREATE TRIGGER `cards_search_insert` AFTER INSERT ON `cards` WHEN new.deleted_at IS NULL BEGIN
  INSERT INTO search_index (kind, ref_id, title, body)
  VALUES (
    'card', new.id, '',
    coalesce(json_extract(new.content, '$.front'), '') || ' ' ||
    coalesce(json_extract(new.content, '$.back'), '') || ' ' ||
    coalesce(json_extract(new.content, '$.text'), '') || ' ' ||
    coalesce(json_extract(new.content, '$.extra'), '')
  );
END;
--> statement-breakpoint
CREATE TRIGGER `cards_search_update` AFTER UPDATE OF `content`, `deleted_at` ON `cards` BEGIN
  DELETE FROM search_index WHERE kind = 'card' AND ref_id = old.id;
  INSERT INTO search_index (kind, ref_id, title, body)
  SELECT
    'card', new.id, '',
    coalesce(json_extract(new.content, '$.front'), '') || ' ' ||
    coalesce(json_extract(new.content, '$.back'), '') || ' ' ||
    coalesce(json_extract(new.content, '$.text'), '') || ' ' ||
    coalesce(json_extract(new.content, '$.extra'), '')
  WHERE new.deleted_at IS NULL;
END;
--> statement-breakpoint
CREATE TRIGGER `cards_search_delete` AFTER DELETE ON `cards` BEGIN
  DELETE FROM search_index WHERE kind = 'card' AND ref_id = old.id;
END;
--> statement-breakpoint
INSERT INTO search_index (kind, ref_id, title, body)
SELECT 'note', id, title, plain_text FROM notes WHERE deleted_at IS NULL;
