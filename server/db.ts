import { and, desc, eq, gte, isNull, lte, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import {
  Alert,
  CardInstallment,
  Category,
  CreditCard,
  FixedExpense,
  FixedExpensePayment,
  Goal,
  GoalContribution,
  InsertAlert,
  InsertCardInstallment,
  InsertCategory,
  InsertCreditCard,
  InsertFixedExpense,
  InsertFixedExpensePayment,
  InsertGoal,
  InsertGoalContribution,
  InsertTransaction,
  InsertUser,
  Transaction,
  alerts,
  cardInstallments,
  categories,
  creditCards,
  fixedExpensePayments,
  fixedExpenses,
  goalContributions,
  goals,
  transactions,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

// The Neon integration provides NEON_DATABASE_URL (pooled). We also accept a
// plain DATABASE_URL so the same code works locally and on other hosts.
const CONNECTION_STRING =
  process.env.DATABASE_URL ??
  process.env.NEON_DATABASE_URL ??
  process.env.POSTGRES_URL ??
  "";

let _db: ReturnType<typeof drizzle> | null = null;
let _pool: Pool | null = null;

export async function getDb() {
  if (!_db && CONNECTION_STRING) {
    try {
      _pool = new Pool({
        connectionString: CONNECTION_STRING,
        ssl: { rejectUnauthorized: false },
      });
      _db = drizzle(_pool);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── Users ────────────────────────────────────────────────────────────────────
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.email) throw new Error("User email is required for upsert");
  if (!user.password) throw new Error("User password is required for upsert");
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot upsert user: database not available"); return; }
  try {
    const values: InsertUser = { email: user.email, password: user.password };
    const updateSet: Record<string, unknown> = { lastSignedIn: new Date() };
    if (user.name !== undefined) { 
      values.name = user.name;
      updateSet.name = user.name;
    }
    if (user.lastSignedIn !== undefined) { 
      values.lastSignedIn = user.lastSignedIn; 
      updateSet.lastSignedIn = user.lastSignedIn; 
    }
    if (user.role !== undefined) { 
      values.role = user.role; 
      updateSet.role = user.role; 
    }
    await db.insert(users).values(values).onConflictDoUpdate({ target: users.email, set: updateSet });
  } catch (error) { console.error("[Database] Failed to upsert user:", error); throw error; }
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ─── Categories ───────────────────────────────────────────────────────────────
export async function getCategoriesByUser(userId: number): Promise<Category[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(categories).where(and(eq(categories.userId, userId), isNull(categories.deletedAt)));
}

export async function createCategory(data: InsertCategory): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(categories).values(data);
}

export async function seedDefaultCategories(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const existing = await db.select().from(categories).where(and(eq(categories.userId, userId), eq(categories.isDefault, true))).limit(1);
  if (existing.length > 0) return;
  const defaults: InsertCategory[] = [
    { userId, name: "Salário", type: "ENTRADA", isDefault: true },
    { userId, name: "Freelance", type: "ENTRADA", isDefault: true },
    { userId, name: "Dividendos", type: "ENTRADA", isDefault: true },
    { userId, name: "Aluguel recebido", type: "ENTRADA", isDefault: true },
    { userId, name: "Outros (entrada)", type: "ENTRADA", isDefault: true },
    { userId, name: "Alimentação", type: "SAIDA", isDefault: true },
    { userId, name: "Transporte", type: "SAIDA", isDefault: true },
    { userId, name: "Saúde", type: "SAIDA", isDefault: true },
    { userId, name: "Lazer", type: "SAIDA", isDefault: true },
    { userId, name: "Educação", type: "SAIDA", isDefault: true },
    { userId, name: "Vestuário", type: "SAIDA", isDefault: true },
    { userId, name: "Casa", type: "SAIDA", isDefault: true },
    { userId, name: "Outros (saída)", type: "SAIDA", isDefault: true },
  ];
  await db.insert(categories).values(defaults);
}

export async function deleteCategory(id: number, userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(categories).set({ deletedAt: new Date() }).where(and(eq(categories.id, id), eq(categories.userId, userId)));
}

// ─── Transactions ─────────────────────────────────────────────────────────────
export async function getTransactionsByMonth(userId: number, year: number, month: number): Promise<Transaction[]> {
  const db = await getDb();
  if (!db) return [];
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  // Exclusive upper bound = first day of next month (Postgres rejects invalid dates like "-31").
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const endDateExclusive = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;
  return db.select().from(transactions).where(
    and(eq(transactions.userId, userId), isNull(transactions.deletedAt), sql`${transactions.date} >= ${startDate}`, sql`${transactions.date} < ${endDateExclusive}`)
  ).orderBy(desc(transactions.date));
}

export async function createTransaction(data: InsertTransaction): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(transactions).values(data);
}

export async function updateTransaction(id: number, userId: number, data: Partial<InsertTransaction>): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(transactions).set(data).where(and(eq(transactions.id, id), eq(transactions.userId, userId)));
}

export async function deleteTransaction(id: number, userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(transactions).set({ deletedAt: new Date() }).where(and(eq(transactions.id, id), eq(transactions.userId, userId)));
}

// RN-01: saldo acumulado do mês anterior (calculado on-the-fly)
export async function getPreviousMonthBalance(userId: number, year: number, month: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  // Soma todas as transações anteriores ao primeiro dia do mês informado.
  const startOfMonth = `${year}-${String(month).padStart(2, "0")}-01`;
  const rows = await db.select({
    type: transactions.type,
    total: sql<string>`SUM(CAST(${transactions.value} AS DECIMAL(10,2)))`,
  }).from(transactions).where(
    and(eq(transactions.userId, userId), isNull(transactions.deletedAt), sql`${transactions.date} < ${startOfMonth}`)
  ).groupBy(transactions.type);
  let balance = 0;
  for (const row of rows) {
    const val = parseFloat(row.total ?? "0");
    if (row.type === "ENTRADA") balance += val;
    else balance -= val;
  }
  return balance;
}

// ─── Fixed Expenses ───────────────────────────────────────────────────────────
export async function getFixedExpensesByUser(userId: number): Promise<FixedExpense[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(fixedExpenses).where(and(eq(fixedExpenses.userId, userId), isNull(fixedExpenses.deletedAt))).orderBy(fixedExpenses.dueDay);
}

export async function createFixedExpense(data: InsertFixedExpense): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(fixedExpenses).values(data);
}

export async function updateFixedExpense(id: number, userId: number, data: Partial<InsertFixedExpense>): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(fixedExpenses).set(data).where(and(eq(fixedExpenses.id, id), eq(fixedExpenses.userId, userId)));
}

export async function deleteFixedExpense(id: number, userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(fixedExpenses).set({ deletedAt: new Date() }).where(and(eq(fixedExpenses.id, id), eq(fixedExpenses.userId, userId)));
}

export async function getFixedExpensePayments(userId: number, referenceMonth: string): Promise<FixedExpensePayment[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(fixedExpensePayments).where(and(eq(fixedExpensePayments.userId, userId), eq(fixedExpensePayments.referenceMonth, referenceMonth)));
}

export async function upsertFixedExpensePayment(fixedExpenseId: number, userId: number, referenceMonth: string, paid: boolean): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const existing = await db.select().from(fixedExpensePayments).where(
    and(eq(fixedExpensePayments.fixedExpenseId, fixedExpenseId), eq(fixedExpensePayments.userId, userId), eq(fixedExpensePayments.referenceMonth, referenceMonth))
  ).limit(1);
  if (existing.length > 0) {
    await db.update(fixedExpensePayments).set({ paid, paidAt: paid ? new Date() : null }).where(eq(fixedExpensePayments.id, existing[0].id));
  } else {
    await db.insert(fixedExpensePayments).values({ fixedExpenseId, userId, referenceMonth, paid, paidAt: paid ? new Date() : null });
  }
}

// ─── Credit Cards ─────────────────────────────────────────────────────────────
export async function getCreditCardsByUser(userId: number): Promise<CreditCard[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(creditCards).where(and(eq(creditCards.userId, userId), isNull(creditCards.deletedAt)));
}

export async function createCreditCard(data: InsertCreditCard): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(creditCards).values(data);
}

export async function updateCreditCard(id: number, userId: number, data: Partial<InsertCreditCard>): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(creditCards).set(data).where(and(eq(creditCards.id, id), eq(creditCards.userId, userId)));
}

export async function deleteCreditCard(id: number, userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(creditCards).set({ deletedAt: new Date() }).where(and(eq(creditCards.id, id), eq(creditCards.userId, userId)));
}

export async function getInstallmentsByMonth(userId: number, referenceMonth: string): Promise<CardInstallment[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(cardInstallments).where(
    and(eq(cardInstallments.userId, userId), eq(cardInstallments.referenceMonth, referenceMonth), isNull(cardInstallments.deletedAt))
  );
}

export async function getInstallmentsByCard(cardId: number, userId: number): Promise<CardInstallment[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(cardInstallments).where(
    and(eq(cardInstallments.cardId, cardId), eq(cardInstallments.userId, userId), isNull(cardInstallments.deletedAt))
  ).orderBy(cardInstallments.currentInstallment);
}

export async function createCardInstallments(installments: InsertCardInstallment[]): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(cardInstallments).values(installments);
}

export async function deleteCardPurchase(purchaseGroupId: string, userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(cardInstallments).set({ deletedAt: new Date() }).where(
    and(eq(cardInstallments.purchaseGroupId, purchaseGroupId), eq(cardInstallments.userId, userId))
  );
}

// ─── Goals ────────────────────────────────────────────────────────────────────
export async function getGoalsByUser(userId: number): Promise<Goal[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(goals).where(and(eq(goals.userId, userId), isNull(goals.deletedAt))).orderBy(goals.priority);
}

export async function createGoal(data: InsertGoal): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(goals).values(data);
}

export async function updateGoal(id: number, userId: number, data: Partial<InsertGoal>): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(goals).set(data).where(and(eq(goals.id, id), eq(goals.userId, userId)));
}

export async function deleteGoal(id: number, userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(goals).set({ deletedAt: new Date() }).where(and(eq(goals.id, id), eq(goals.userId, userId)));
}

export async function getGoalContributions(goalId: number, userId: number): Promise<GoalContribution[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(goalContributions).where(and(eq(goalContributions.goalId, goalId), eq(goalContributions.userId, userId))).orderBy(desc(goalContributions.createdAt));
}

export async function createGoalContribution(data: InsertGoalContribution): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(goalContributions).values(data);
  // Atualiza valor acumulado na meta
  const allContribs = await getGoalContributions(data.goalId, data.userId);
  const total = allContribs.reduce((sum, c) => sum + parseFloat(String(c.value)), 0);
  await db.update(goals).set({ accumulatedValue: String(total) }).where(eq(goals.id, data.goalId));
}

export async function getRecentContributionsByGoal(goalId: number, userId: number, months: number = 3): Promise<GoalContribution[]> {
  const db = await getDb();
  if (!db) return [];
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - months);
  const cutoffStr = cutoff.toISOString().split("T")[0];
  return db.select().from(goalContributions).where(
    and(eq(goalContributions.goalId, goalId), eq(goalContributions.userId, userId), sql`${goalContributions.date} >= ${cutoffStr}`)
  );
}

// ─── Alerts ───────────────────────────────────────────────────────────────────
export async function getActiveAlerts(userId: number): Promise<Alert[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(alerts).where(and(eq(alerts.userId, userId), eq(alerts.dismissed, false))).orderBy(desc(alerts.createdAt));
}

export async function createAlert(data: InsertAlert): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(alerts).values(data);
}

export async function dismissAlert(id: number, userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(alerts).set({ dismissed: true }).where(and(eq(alerts.id, id), eq(alerts.userId, userId)));
}

export async function markAlertNotificationSent(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(alerts).set({ notificationSent: true }).where(eq(alerts.id, id));
}

export async function clearAlertsForMonth(userId: number, referenceMonth: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(alerts).set({ dismissed: true }).where(
    and(eq(alerts.userId, userId), eq(alerts.referenceMonth, referenceMonth), eq(alerts.dismissed, false))
  );
}

export async function getUnsentAlerts(userId: number): Promise<Alert[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(alerts).where(
    and(eq(alerts.userId, userId), eq(alerts.notificationSent, false), eq(alerts.dismissed, false))
  );
}
