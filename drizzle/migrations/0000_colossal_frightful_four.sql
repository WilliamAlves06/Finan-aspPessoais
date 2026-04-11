CREATE TABLE `alerts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`type` enum('NEGATIVE_BALANCE','LOW_BALANCE','FIXED_DUE_SOON','HIGH_INSTALLMENTS','GOAL_NO_CONTRIBUTION','CARD_DUE_SOON') NOT NULL,
	`priority` enum('HIGH','MEDIUM','LOW') NOT NULL DEFAULT 'MEDIUM',
	`message` text NOT NULL,
	`referenceMonth` varchar(7),
	`dismissed` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `alerts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cardInstallments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`cardId` int NOT NULL,
	`userId` int NOT NULL,
	`description` varchar(200) NOT NULL,
	`totalValue` decimal(10,2) NOT NULL,
	`installmentValue` decimal(10,2) NOT NULL,
	`currentInstallment` int NOT NULL,
	`totalInstallments` int NOT NULL,
	`referenceMonth` varchar(7) NOT NULL,
	`categoryId` int,
	`paid` boolean NOT NULL DEFAULT false,
	`purchaseGroupId` varchar(64),
	`deletedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `cardInstallments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(100) NOT NULL,
	`type` enum('ENTRADA','SAIDA','AMBOS') NOT NULL DEFAULT 'AMBOS',
	`isDefault` boolean NOT NULL DEFAULT false,
	`deletedAt` timestamp,
	CONSTRAINT `categories_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `creditCards` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(100) NOT NULL,
	`limit` decimal(10,2) NOT NULL,
	`closingDay` int NOT NULL,
	`dueDay` int NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`deletedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `creditCards_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `fixedExpensePayments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`fixedExpenseId` int NOT NULL,
	`userId` int NOT NULL,
	`referenceMonth` varchar(7) NOT NULL,
	`paidAt` timestamp,
	`paid` boolean NOT NULL DEFAULT false,
	CONSTRAINT `fixedExpensePayments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `fixedExpenses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(150) NOT NULL,
	`value` decimal(10,2) NOT NULL,
	`dueDay` int NOT NULL,
	`categoryId` int,
	`active` boolean NOT NULL DEFAULT true,
	`startDate` date NOT NULL,
	`endDate` date,
	`deletedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `fixedExpenses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `goalContributions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`goalId` int NOT NULL,
	`userId` int NOT NULL,
	`value` decimal(10,2) NOT NULL,
	`date` date NOT NULL,
	`note` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `goalContributions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `goals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(150) NOT NULL,
	`targetValue` decimal(10,2) NOT NULL,
	`accumulatedValue` decimal(10,2) NOT NULL DEFAULT '0',
	`priority` int NOT NULL DEFAULT 3,
	`targetDate` date,
	`completed` boolean NOT NULL DEFAULT false,
	`deletedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `goals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`type` enum('ENTRADA','SAIDA') NOT NULL,
	`value` decimal(10,2) NOT NULL,
	`date` date NOT NULL,
	`categoryId` int,
	`description` text,
	`origin` enum('MANUAL','FIXO','CARTAO') NOT NULL DEFAULT 'MANUAL',
	`deletedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `transactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`email` varchar(320) NOT NULL,
	`password` varchar(255) NOT NULL,
	`name` text,
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_email_unique` UNIQUE(`email`)
);
