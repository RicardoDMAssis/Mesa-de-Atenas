ALTER TABLE `assets` ADD `name` text;--> statement-breakpoint
ALTER TABLE `cards` ADD `origin_plugin_id` text;--> statement-breakpoint
ALTER TABLE `cards` ADD `origin_key` text;--> statement-breakpoint
ALTER TABLE `cards` ADD `edited_at` integer;--> statement-breakpoint
CREATE INDEX `cards_origin_idx` ON `cards` (`origin_plugin_id`,`origin_key`);