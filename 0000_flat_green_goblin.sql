CREATE TABLE `app_state` (
	`owner_key` text PRIMARY KEY NOT NULL,
	`config_json` text NOT NULL,
	`state_json` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
