ALTER TABLE `cards` ADD `srs` text DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE `cards` DROP COLUMN `stability`;--> statement-breakpoint
ALTER TABLE `cards` DROP COLUMN `difficulty`;--> statement-breakpoint
ALTER TABLE `cards` DROP COLUMN `elapsed_days`;--> statement-breakpoint
ALTER TABLE `cards` DROP COLUMN `scheduled_days`;--> statement-breakpoint
ALTER TABLE `cards` DROP COLUMN `learning_steps`;--> statement-breakpoint
ALTER TABLE `review_logs` ADD `data` text DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE `review_logs` DROP COLUMN `due`;--> statement-breakpoint
ALTER TABLE `review_logs` DROP COLUMN `stability`;--> statement-breakpoint
ALTER TABLE `review_logs` DROP COLUMN `difficulty`;--> statement-breakpoint
ALTER TABLE `review_logs` DROP COLUMN `elapsed_days`;--> statement-breakpoint
ALTER TABLE `review_logs` DROP COLUMN `last_elapsed_days`;--> statement-breakpoint
ALTER TABLE `review_logs` DROP COLUMN `scheduled_days`;--> statement-breakpoint
ALTER TABLE `review_logs` DROP COLUMN `learning_steps`;