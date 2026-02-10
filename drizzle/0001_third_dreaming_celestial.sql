CREATE TABLE `submissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` int NOT NULL,
	`studentName` varchar(255) NOT NULL,
	`emoji` varchar(32) NOT NULL,
	`rating` int NOT NULL,
	`ipAddress` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `submissions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `survey_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(32) NOT NULL,
	`label` varchar(255),
	`isActive` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `survey_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `survey_sessions_code_unique` UNIQUE(`code`)
);
