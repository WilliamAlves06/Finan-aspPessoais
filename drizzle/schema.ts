import {
  boolean,
  date,
  integer,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

// ─── Users ────────────────────────────────────────────────────────────────────
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  password: varchar("password", { length: 255 }).notNull(), // Hash bcrypt
  name: text("name"),
  role: varchar("role", { length: 16 }).$type<"user" | "admin">().default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Categories ───────────────────────────────────────────────────────────────
export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  type: varchar("type", { length: 16 }).$type<"ENTRADA" | "SAIDA" | "AMBOS">().notNull().default("AMBOS"),
  isDefault: boolean("isDefault").default(false).notNull(),
  deletedAt: timestamp("deletedAt"),
});

export type Category = typeof categories.$inferSelect;
export type InsertCategory = typeof categories.$inferInsert;

// ─── Transactions ─────────────────────────────────────────────────────────────
export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  type: varchar("type", { length: 16 }).$type<"ENTRADA" | "SAIDA">().notNull(),
  value: numeric("value", { precision: 10, scale: 2 }).notNull(),
  date: date("date").notNull(),
  categoryId: integer("categoryId"),
  description: text("description"),
  origin: varchar("origin", { length: 16 }).$type<"MANUAL" | "FIXO" | "CARTAO">().notNull().default("MANUAL"),
  referenceId: integer("referenceId"),
  deletedAt: timestamp("deletedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = typeof transactions.$inferInsert;

// ─── Fixed Expenses ───────────────────────────────────────────────────────────
export const fixedExpenses = pgTable("fixedExpenses", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  name: varchar("name", { length: 150 }).notNull(),
  value: numeric("value", { precision: 10, scale: 2 }).notNull(),
  dueDay: integer("dueDay").notNull(), // 1-31
  categoryId: integer("categoryId"),
  active: boolean("active").default(true).notNull(),
  startDate: date("startDate").notNull(),
  endDate: date("endDate"),
  deletedAt: timestamp("deletedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type FixedExpense = typeof fixedExpenses.$inferSelect;
export type InsertFixedExpense = typeof fixedExpenses.$inferInsert;

// ─── Fixed Expense Payments (quitação mensal) ─────────────────────────────────
export const fixedExpensePayments = pgTable("fixedExpensePayments", {
  id: serial("id").primaryKey(),
  fixedExpenseId: integer("fixedExpenseId").notNull(),
  userId: integer("userId").notNull(),
  referenceMonth: varchar("referenceMonth", { length: 7 }).notNull(), // YYYY-MM
  paidAt: timestamp("paidAt"),
  paid: boolean("paid").default(false).notNull(),
});

export type FixedExpensePayment = typeof fixedExpensePayments.$inferSelect;
export type InsertFixedExpensePayment = typeof fixedExpensePayments.$inferInsert;

// ─── Credit Cards ─────────────────────────────────────────────────────────────
export const creditCards = pgTable("creditCards", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  limit: numeric("limit", { precision: 10, scale: 2 }).notNull(),
  closingDay: integer("closingDay").notNull(), // dia de fechamento
  dueDay: integer("dueDay").notNull(), // dia de vencimento
  active: boolean("active").default(true).notNull(),
  deletedAt: timestamp("deletedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CreditCard = typeof creditCards.$inferSelect;
export type InsertCreditCard = typeof creditCards.$inferInsert;

// ─── Card Installments ────────────────────────────────────────────────────────
export const cardInstallments = pgTable("cardInstallments", {
  id: serial("id").primaryKey(),
  cardId: integer("cardId").notNull(),
  userId: integer("userId").notNull(),
  description: varchar("description", { length: 200 }).notNull(),
  totalValue: numeric("totalValue", { precision: 10, scale: 2 }).notNull(),
  installmentValue: numeric("installmentValue", { precision: 10, scale: 2 }).notNull(),
  currentInstallment: integer("currentInstallment").notNull(),
  totalInstallments: integer("totalInstallments").notNull(),
  referenceMonth: varchar("referenceMonth", { length: 7 }).notNull(), // YYYY-MM
  categoryId: integer("categoryId"),
  paid: boolean("paid").default(false).notNull(),
  purchaseGroupId: varchar("purchaseGroupId", { length: 64 }), // agrupa parcelas da mesma compra
  deletedAt: timestamp("deletedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CardInstallment = typeof cardInstallments.$inferSelect;
export type InsertCardInstallment = typeof cardInstallments.$inferInsert;

// ─── Goals (Grandes Compras) ──────────────────────────────────────────────────
export const goals = pgTable("goals", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  name: varchar("name", { length: 150 }).notNull(),
  targetValue: numeric("targetValue", { precision: 10, scale: 2 }).notNull(),
  accumulatedValue: numeric("accumulatedValue", { precision: 10, scale: 2 }).default("0").notNull(),
  priority: integer("priority").default(3).notNull(), // 1-5
  targetDate: date("targetDate"),
  completed: boolean("completed").default(false).notNull(),
  deletedAt: timestamp("deletedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Goal = typeof goals.$inferSelect;
export type InsertGoal = typeof goals.$inferInsert;

// ─── Goal Contributions ───────────────────────────────────────────────────────
export const goalContributions = pgTable("goalContributions", {
  id: serial("id").primaryKey(),
  goalId: integer("goalId").notNull(),
  userId: integer("userId").notNull(),
  value: numeric("value", { precision: 10, scale: 2 }).notNull(),
  date: date("date").notNull(),
  note: text("note"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type GoalContribution = typeof goalContributions.$inferSelect;
export type InsertGoalContribution = typeof goalContributions.$inferInsert;

// ─── Alerts ───────────────────────────────────────────────────────────────────
export const alerts = pgTable("alerts", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  type: varchar("type", { length: 32 }).$type<
    | "NEGATIVE_BALANCE"
    | "LOW_BALANCE"
    | "FIXED_DUE_SOON"
    | "HIGH_INSTALLMENTS"
    | "GOAL_NO_CONTRIBUTION"
    | "CARD_DUE_SOON"
  >().notNull(),
  priority: varchar("priority", { length: 8 }).$type<"HIGH" | "MEDIUM" | "LOW">().notNull().default("MEDIUM"),
  message: text("message").notNull(),
  referenceMonth: varchar("referenceMonth", { length: 7 }), // YYYY-MM
  dismissed: boolean("dismissed").default(false).notNull(),
  notificationSent: boolean("notificationSent").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Alert = typeof alerts.$inferSelect;
export type InsertAlert = typeof alerts.$inferInsert;
