import {
  boolean,
  date,
  decimal,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

// ─── Users ────────────────────────────────────────────────────────────────────
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  password: varchar("password", { length: 255 }).notNull(),
  name: text("name"),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Categories ───────────────────────────────────────────────────────────────
export const categories = mysqlTable("categories", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  type: mysqlEnum("type", ["ENTRADA", "SAIDA", "AMBOS"]).notNull().default("AMBOS"),
  isDefault: boolean("isDefault").default(false).notNull(),
  deletedAt: timestamp("deletedAt"),
});

export type Category = typeof categories.$inferSelect;

// ─── Transactions ─────────────────────────────────────────────────────────────
export const transactions = mysqlTable("transactions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  type: mysqlEnum("type", ["ENTRADA", "SAIDA"]).notNull(),
  value: decimal("value", { precision: 10, scale: 2 }).notNull(),
  date: date("date").notNull(),
  categoryId: int("categoryId"),
  description: text("description"),
  origin: mysqlEnum("origin", ["MANUAL", "FIXO", "CARTAO"]).notNull().default("MANUAL"),
  deletedAt: timestamp("deletedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Transaction = typeof transactions.$inferSelect;

// ─── Fixed Expenses ───────────────────────────────────────────────────────────
export const fixedExpenses = mysqlTable("fixedExpenses", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 150 }).notNull(),
  value: decimal("value", { precision: 10, scale: 2 }).notNull(),
  dueDay: int("dueDay").notNull(),
  categoryId: int("categoryId"),
  active: boolean("active").default(true).notNull(),
  startDate: date("startDate").notNull(),
  endDate: date("endDate"),
  deletedAt: timestamp("deletedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type FixedExpense = typeof fixedExpenses.$inferSelect;

// ─── Fixed Expense Payments ───────────────────────────────────────────────────
export const fixedExpensePayments = mysqlTable("fixedExpensePayments", {
  id: int("id").autoincrement().primaryKey(),
  fixedExpenseId: int("fixedExpenseId").notNull(),
  userId: int("userId").notNull(),
  referenceMonth: varchar("referenceMonth", { length: 7 }).notNull(),
  paidAt: timestamp("paidAt"),
  paid: boolean("paid").default(false).notNull(),
});

export type FixedExpensePayment = typeof fixedExpensePayments.$inferSelect;

// ─── Credit Cards ─────────────────────────────────────────────────────────────
export const creditCards = mysqlTable("creditCards", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  limit: decimal("limit", { precision: 10, scale: 2 }).notNull(),
  closingDay: int("closingDay").notNull(),
  dueDay: int("dueDay").notNull(),
  active: boolean("active").default(true).notNull(),
  deletedAt: timestamp("deletedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CreditCard = typeof creditCards.$inferSelect;

// ─── Card Installments ────────────────────────────────────────────────────────
export const cardInstallments = mysqlTable("cardInstallments", {
  id: int("id").autoincrement().primaryKey(),
  cardId: int("cardId").notNull(),
  userId: int("userId").notNull(),
  description: varchar("description", { length: 200 }).notNull(),
  totalValue: decimal("totalValue", { precision: 10, scale: 2 }).notNull(),
  installmentValue: decimal("installmentValue", { precision: 10, scale: 2 }).notNull(),
  currentInstallment: int("currentInstallment").notNull(),
  totalInstallments: int("totalInstallments").notNull(),
  referenceMonth: varchar("referenceMonth", { length: 7 }).notNull(),
  categoryId: int("categoryId"),
  paid: boolean("paid").default(false).notNull(),
  purchaseGroupId: varchar("purchaseGroupId", { length: 64 }),
  deletedAt: timestamp("deletedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CardInstallment = typeof cardInstallments.$inferSelect;

// ─── Goals ────────────────────────────────────────────────────────────────────
export const goals = mysqlTable("goals", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 150 }).notNull(),
  targetValue: decimal("targetValue", { precision: 10, scale: 2 }).notNull(),
  accumulatedValue: decimal("accumulatedValue", { precision: 10, scale: 2 }).default("0").notNull(),
  priority: int("priority").default(3).notNull(),
  targetDate: date("targetDate"),
  completed: boolean("completed").default(false).notNull(),
  deletedAt: timestamp("deletedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Goal = typeof goals.$inferSelect;

// ─── Goal Contributions ───────────────────────────────────────────────────────
export const goalContributions = mysqlTable("goalContributions", {
  id: int("id").autoincrement().primaryKey(),
  goalId: int("goalId").notNull(),
  userId: int("userId").notNull(),
  value: decimal("value", { precision: 10, scale: 2 }).notNull(),
  date: date("date").notNull(),
  note: text("note"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type GoalContribution = typeof goalContributions.$inferSelect;

// ─── Alerts ───────────────────────────────────────────────────────────────────
export const alerts = mysqlTable("alerts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  type: mysqlEnum("type", [
    "NEGATIVE_BALANCE",
    "LOW_BALANCE",
    "FIXED_DUE_SOON",
    "HIGH_INSTALLMENTS",
    "GOAL_NO_CONTRIBUTION",
    "CARD_DUE_SOON",
  ]).notNull(),
  priority: mysqlEnum("priority", ["HIGH", "MEDIUM", "LOW"]).notNull().default("MEDIUM"),
  message: text("message").notNull(),
  referenceMonth: varchar("referenceMonth", { length: 7 }),
  dismissed: boolean("dismissed").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Alert = typeof alerts.$inferSelect;
