CREATE TABLE `class_students` (
	`class_id` text NOT NULL,
	`user_id` text NOT NULL,
	`status` text NOT NULL,
	`joined_at` text,
	PRIMARY KEY(`class_id`, `user_id`),
	FOREIGN KEY (`class_id`) REFERENCES `classes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `class_teachers` (
	`class_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text NOT NULL,
	`added_at` text DEFAULT (current_timestamp) NOT NULL,
	PRIMARY KEY(`class_id`, `user_id`),
	FOREIGN KEY (`class_id`) REFERENCES `classes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `classes` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`term` text,
	`join_code` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `classes_join_code_unique` ON `classes` (`join_code`);--> statement-breakpoint
CREATE TABLE `invites` (
	`id` text PRIMARY KEY NOT NULL,
	`class_id` text NOT NULL,
	`email` text NOT NULL,
	`token` text NOT NULL,
	`invited_by` text NOT NULL,
	`expires_at` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`class_id`) REFERENCES `classes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`invited_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invites_token_unique` ON `invites` (`token`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`password_hash` text NOT NULL,
	`email` text NOT NULL,
	`name` text,
	`role` text NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);