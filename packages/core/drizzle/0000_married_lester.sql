CREATE TABLE `agent_sops` (
	`agent_id` text NOT NULL,
	`sop_id` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`agent_id`) REFERENCES `agents`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`sop_id`) REFERENCES `sops`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `agent_sops_unique` ON `agent_sops` (`agent_id`,`sop_id`);--> statement-breakpoint
CREATE TABLE `agents` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`system_prompt` text DEFAULT '' NOT NULL,
	`llm_provider` text DEFAULT 'openai' NOT NULL,
	`llm_model` text DEFAULT 'gpt-4o' NOT NULL,
	`tg_bot_token` text,
	`tg_bot_username` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `group_configs` (
	`id` text PRIMARY KEY NOT NULL,
	`tg_chat_id` text NOT NULL,
	`name` text DEFAULT '' NOT NULL,
	`type` text DEFAULT 'main' NOT NULL,
	`project_id` text,
	`config` text DEFAULT '{}' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `group_configs_tg_chat_id_unique` ON `group_configs` (`tg_chat_id`);--> statement-breakpoint
CREATE TABLE `mcp_servers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`command` text NOT NULL,
	`args` text DEFAULT '[]' NOT NULL,
	`env_vars` text DEFAULT '{}' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `mcp_servers_name_unique` ON `mcp_servers` (`name`);--> statement-breakpoint
CREATE TABLE `memories` (
	`id` text PRIMARY KEY NOT NULL,
	`agent_id` text,
	`task_id` text,
	`type` text DEFAULT 'summary' NOT NULL,
	`content` text NOT NULL,
	`metadata` text DEFAULT '{}' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`agent_id`) REFERENCES `agents`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`agent_id` text,
	`tg_chat_id` text NOT NULL,
	`tg_message_id` text NOT NULL,
	`tg_user_id` text,
	`tg_username` text,
	`direction` text DEFAULT 'incoming' NOT NULL,
	`content` text DEFAULT '' NOT NULL,
	`message_type` text DEFAULT 'text' NOT NULL,
	`raw_data` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`agent_id`) REFERENCES `agents`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `messages_chat_msg_unique` ON `messages` (`tg_chat_id`,`tg_message_id`);--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`repo_url` text,
	`config` text DEFAULT '{}' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `projects_name_unique` ON `projects` (`name`);--> statement-breakpoint
CREATE TABLE `skills` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`type` text DEFAULT 'builtin' NOT NULL,
	`input_schema` text DEFAULT '{}' NOT NULL,
	`config` text DEFAULT '{}' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `skills_name_unique` ON `skills` (`name`);--> statement-breakpoint
CREATE TABLE `sop_step_skills` (
	`sop_step_id` text NOT NULL,
	`skill_id` text NOT NULL,
	FOREIGN KEY (`sop_step_id`) REFERENCES `sop_steps`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`skill_id`) REFERENCES `skills`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sop_step_skills_unique` ON `sop_step_skills` (`sop_step_id`,`skill_id`);--> statement-breakpoint
CREATE TABLE `sop_steps` (
	`id` text PRIMARY KEY NOT NULL,
	`sop_id` text NOT NULL,
	`step_order` integer DEFAULT 0 NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`action_type` text NOT NULL,
	`action_config` text DEFAULT '{}' NOT NULL,
	`condition` text,
	`next_step_id` text,
	`next_step_on_fail` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`sop_id`) REFERENCES `sops`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `sops` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`trigger_type` text DEFAULT 'intent' NOT NULL,
	`trigger_config` text DEFAULT '{}' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `task_events` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`from_status` text,
	`to_status` text NOT NULL,
	`agent_id` text,
	`comment` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`agent_id`) REFERENCES `agents`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text,
	`parent_task_id` text,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'created' NOT NULL,
	`priority` text DEFAULT 'medium' NOT NULL,
	`assigned_agent_id` text,
	`created_by_agent_id` text,
	`sop_id` text,
	`current_sop_step_id` text,
	`metadata` text DEFAULT '{}' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`assigned_agent_id`) REFERENCES `agents`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by_agent_id`) REFERENCES `agents`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`sop_id`) REFERENCES `sops`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`current_sop_step_id`) REFERENCES `sop_steps`(`id`) ON UPDATE no action ON DELETE set null
);
