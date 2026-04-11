import "dotenv/config";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { and, eq, gte, isNull, lte, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import {
  users, categories, transactions, fixedExpenses, fixedExpensePayments,
  creditCards, cardInstallments, goals, goalContributions, alerts,
} from "../drizzle/schema";

// ─── Connection ───────────────────────────────────────────────────────────────
let db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (db) return db;
  const connection = await mysql.createPool({ uri: process.env.DATABASE_URL! });
  db = drizzle(connection);
  return db;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
export async function getUserById(id: number) {
  const d = await getDb();
  const rows = await d.select().from(users).where(eq(users.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getUserByEmail(email: string) {
  const d = await getDb();
  const rows = await d.select().from(users).where(eq(users.email, email)).limit(1);
  return rows[0] ?? null;
}

export async function createUser(email: string, password: string, name: string) {
  const d = await getDb();
  const hash = await bcrypt.hash(password, 10);
  await d.insert(users).values({ email, password: hash, name, role: "user" });
}

export async function verifyPassword(plain: string, hash: string) {
  return bcrypt.compare(plain, hash);
}

// ─── Categories ───────────────────────────────────────────────────────────────
const DEFAULT_CATEGORIES = [
  { name: "Alimentação", type: "SAIDA" as const },
  { name: "Transporte", type: "SAIDA" as const },
  { name: "Moradia", type: "SAIDA" as const },
  { name: "Saúde", type: "SAIDA" as const },
  { name: "Lazer", type: "SAIDA" as const },
  { name: "Educação", type: "SAIDA" as const },
  { name: "Vestuário", type: "SAIDA" as const },
  { name: "Outros", type: "AMBOS" as const },
  { name: "Salário", type: "ENTRADA" as const },
  { name: "Freelance", type: "ENTRADA" as const },
];

export async function seedDefaultCategories(userId: number) {
  const d = await getDb();
  const existing = await d.select().from(categories)
    .where(and(eq(categories.userId, userId), eq(categories.isDefault, true)));
  if (existing.length > 0) return;
  for (const cat of DEFAULT_CATEGORIES) {
    await d.insert(categories).values({ userId, name: cat.name, type: cat.type, isDefault: true });
  }
}

export async function getCategoriesByUser(userId: number) {
  const d = await getDb();
  return d.select().from(categories)
    .where(and(eq(categories.userId, userId), isNull(categories.deletedAt)));
}

export async function createCategory(data: { userId: number; name: string; type: "ENTRADA" | "SAIDA" | "AMBOS"; isDefault: boolean }) {
  const d = await getDb();
  await d.insert(categories).values(data);
}

export async function deleteCategory(id: number, userId: number) {
  const d = await getDb();
  await d.update(categories).set({ deletedAt: new Date() })
    .where(and(eq(categories.id, id), eq(categories.userId, userId)));
}

// ─── Transactions ─────────────────────────────────────────────────────────────
export async function getTransactionsByMonth(userId: number, year: number, month: number) {
  const d = await getDb();
  const from = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const to = `${year}-${String(month).padStart(2, "0")}-${lastDay}`;
  return d.select().from(transactions)
    .where(and(
      eq(transactions.userId, userId),
      isNull(transactions.deletedAt),
      gte(transactions.date, from as unknown as Date),
      lte(transactions.date, to as unknown as Date),
    ));
}

export async function createTransaction(data: {
  userId: number; type: "ENTRADA" | "SAIDA"; value: string;
  date: Date; categoryId: number | null; description: string | null; origin: "MANUAL" | "FIXO" | "CARTAO";
}) {
  const d = await getDb();
  await d.insert(transactions).values(data);
}

export async function updateTransaction(id: number, userId: number, data: Partial<{
  type: "ENTRADA" | "SAIDA"; value: string; date: Date; categoryId: number | null; description: string | null;
}>) {
  const d = await getDb();
  await d.update(transactions).set(data).where(and(eq(transactions.id, id), eq(transactions.userId, userId)));
}

export async function deleteTransaction(id: number, userId: number) {
  const d = await getDb();
  await d.update(transactions).set({ deletedAt: new Date() })
    .where(and(eq(transactions.id, id), eq(transactions.userId, userId)));
}

// ─── Fixed Expenses ───────────────────────────────────────────────────────────
export async function getFixedExpensesByUser(userId: number) {
  const d = await getDb();
  return d.select().from(fixedExpenses)
    .where(and(eq(fixedExpenses.userId, userId), isNull(fixedExpenses.deletedAt)));
}

export async function createFixedExpense(data: {
  userId: number; name: string; value: string; dueDay: number;
  categoryId: number | null; active: boolean; startDate: Date; endDate: Date | null;
}) {
  const d = await getDb();
  await d.insert(fixedExpenses).values(data);
}

export async function updateFixedExpense(id: number, userId: number, data: Partial<{
  name: string; value: string; dueDay: number; categoryId: number | null; active: boolean; endDate: Date | null;
}>) {
  const d = await getDb();
  await d.update(fixedExpenses).set(data).where(and(eq(fixedExpenses.id, id), eq(fixedExpenses.userId, userId)));
}

export async function deleteFixedExpense(id: number, userId: number) {
  const d = await getDb();
  await d.update(fixedExpenses).set({ deletedAt: new Date() })
    .where(and(eq(fixedExpenses.id, id), eq(fixedExpenses.userId, userId)));
}

export async function getFixedExpensePayments(userId: number, referenceMonth: string) {
  const d = await getDb();
  return d.select().from(fixedExpensePayments)
    .where(and(eq(fixedExpensePayments.userId, userId), eq(fixedExpensePayments.referenceMonth, referenceMonth)));
}

export async function upsertFixedExpensePayment(fixedExpenseId: number, userId: number, referenceMonth: string, paid: boolean) {
  const d = await getDb();
  const existing = await d.select().from(fixedExpensePayments)
    .where(and(
      eq(fixedExpensePayments.fixedExpenseId, fixedExpenseId),
      eq(fixedExpensePayments.userId, userId),
      eq(fixedExpensePayments.referenceMonth, referenceMonth),
    )).limit(1);
  if (existing.length > 0) {
    await d.update(fixedExpensePayments)
      .set({ paid, paidAt: paid ? new Date() : null })
      .where(eq(fixedExpensePayments.id, existing[0].id));
  } else {
    await d.insert(fixedExpensePayments).values({
      fixedExpenseId, userId, referenceMonth, paid, paidAt: paid ? new Date() : null,
    });
  }
}

// ─── Credit Cards ─────────────────────────────────────────────────────────────
export async function getCreditCardsByUser(userId: number) {
  const d = await getDb();
  return d.select().from(creditCards)
    .where(and(eq(creditCards.userId, userId), isNull(creditCards.deletedAt)));
}

export async function createCreditCard(data: {
  userId: number; name: string; limit: string; closingDay: number; dueDay: number; active: boolean;
}) {
  const d = await getDb();
  await d.insert(creditCards).values(data);
}

export async function updateCreditCard(id: number, userId: number, data: Partial<{
  name: string; limit: string; closingDay: number; dueDay: number; active: boolean;
}>) {
  const d = await getDb();
  await d.update(creditCards).set(data).where(and(eq(creditCards.id, id), eq(creditCards.userId, userId)));
}

export async function deleteCreditCard(id: number, userId: number) {
  const d = await getDb();
  await d.update(creditCards).set({ deletedAt: new Date() })
    .where(and(eq(creditCards.id, id), eq(creditCards.userId, userId)));
}

export async function createCardInstallments(rows: Array<{
  cardId: number; userId: number; description: string; totalValue: string;
  installmentValue: string; currentInstallment: number; totalInstallments: number;
  referenceMonth: string; categoryId: number | null; paid: boolean; purchaseGroupId: string;
}>) {
  const d = await getDb();
  await d.insert(cardInstallments).values(rows);
}

export async function getInstallmentsByMonth(userId: number, referenceMonth: string) {
  const d = await getDb();
  return d.select().from(cardInstallments)
    .where(and(
      eq(cardInstallments.userId, userId),
      eq(cardInstallments.referenceMonth, referenceMonth),
      isNull(cardInstallments.deletedAt),
    ));
}

export async function getInstallmentsByCard(cardId: number, userId: number) {
  const d = await getDb();
  return d.select().from(cardInstallments)
    .where(and(
      eq(cardInstallments.cardId, cardId),
      eq(cardInstallments.userId, userId),
      isNull(cardInstallments.deletedAt),
    ));
}

export async function deleteCardPurchase(purchaseGroupId: string, userId: number) {
  const d = await getDb();
  await d.update(cardInstallments).set({ deletedAt: new Date() })
    .where(and(eq(cardInstallments.purchaseGroupId, purchaseGroupId), eq(cardInstallments.userId, userId)));
}

// ─── Goals ────────────────────────────────────────────────────────────────────
export async function getGoalsByUser(userId: number) {
  const d = await getDb();
  return d.select().from(goals)
    .where(and(eq(goals.userId, userId), isNull(goals.deletedAt)));
}

export async function createGoal(data: {
  userId: number; name: string; targetValue: string; accumulatedValue: string;
  priority: number; targetDate: Date | null; completed: boolean;
}) {
  const d = await getDb();
  await d.insert(goals).values(data);
}

export async function updateGoal(id: number, userId: number, data: Partial<{
  name: string; targetValue: string; accumulatedValue: string; priority: number;
  targetDate: Date | null; completed: boolean;
}>) {
  const d = await getDb();
  await d.update(goals).set(data).where(and(eq(goals.id, id), eq(goals.userId, userId)));
}

export async function deleteGoal(id: number, userId: number) {
  const d = await getDb();
  await d.update(goals).set({ deletedAt: new Date() })
    .where(and(eq(goals.id, id), eq(goals.userId, userId)));
}

export async function createGoalContribution(data: {
  goalId: number; userId: number; value: string; date: Date; note: string | null;
}) {
  const d = await getDb();
  await d.insert(goalContributions).values(data);
  // Update accumulated value
  const contribs = await d.select().from(goalContributions).where(eq(goalContributions.goalId, data.goalId));
  const total = contribs.reduce((s, c) => s + parseFloat(String(c.value)), 0);
  await d.update(goals).set({ accumulatedValue: String(total) }).where(eq(goals.id, data.goalId));
}

export async function getGoalContributions(goalId: number, userId: number) {
  const d = await getDb();
  return d.select().from(goalContributions)
    .where(and(eq(goalContributions.goalId, goalId), eq(goalContributions.userId, userId)));
}

export async function getRecentContributionsByGoal(goalId: number, userId: number, months = 3) {
  const d = await getDb();
  const since = new Date();
  since.setMonth(since.getMonth() - months);
  return d.select().from(goalContributions)
    .where(and(
      eq(goalContributions.goalId, goalId),
      eq(goalContributions.userId, userId),
      gte(goalContributions.date, since as unknown as Date),
    ));
}

// ─── Alerts ───────────────────────────────────────────────────────────────────
export async function getActiveAlerts(userId: number) {
  const d = await getDb();
  return d.select().from(alerts)
    .where(and(eq(alerts.userId, userId), eq(alerts.dismissed, false)));
}

export async function createAlert(data: {
  userId: number;
  type: "NEGATIVE_BALANCE" | "LOW_BALANCE" | "FIXED_DUE_SOON" | "HIGH_INSTALLMENTS" | "GOAL_NO_CONTRIBUTION" | "CARD_DUE_SOON";
  priority: "HIGH" | "MEDIUM" | "LOW";
  message: string;
  referenceMonth: string;
}) {
  const d = await getDb();
  await d.insert(alerts).values({ ...data, dismissed: false });
}

export async function clearAlertsForMonth(userId: number, referenceMonth: string) {
  const d = await getDb();
  await d.update(alerts).set({ dismissed: true })
    .where(and(eq(alerts.userId, userId), eq(alerts.referenceMonth, referenceMonth)));
}

export async function dismissAlert(id: number, userId: number) {
  const d = await getDb();
  await d.update(alerts).set({ dismissed: true })
    .where(and(eq(alerts.id, id), eq(alerts.userId, userId)));
}

// ─── Dashboard helpers ────────────────────────────────────────────────────────
export async function getPreviousMonthBalance(userId: number, year: number, month: number) {
  // Sum of all ENTRADA - SAIDA - fixedExpenses - cardInstallments before this month
  const d = await getDb();
  const to = new Date(year, month - 1, 0); // last day of previous month

  const txRows = await d.select().from(transactions)
    .where(and(
      eq(transactions.userId, userId),
      isNull(transactions.deletedAt),
      lte(transactions.date, to as unknown as Date),
    ));

  const txBalance = txRows.reduce((s, t) => {
    const v = parseFloat(String(t.value));
    return t.type === "ENTRADA" ? s + v : s - v;
  }, 0);

  return txBalance;
}
