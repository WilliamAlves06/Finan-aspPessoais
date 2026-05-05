import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ─── Mock DB ──────────────────────────────────────────────────────────────────
vi.mock("./db", () => ({
  upsertUser: vi.fn(),
  getUserByOpenId: vi.fn(),
  getCategoriesByUser: vi.fn().mockResolvedValue([
    { id: 1, userId: 1, name: "Salário", type: "ENTRADA", isDefault: true, createdAt: new Date() },
    { id: 2, userId: 1, name: "Alimentação", type: "SAIDA", isDefault: true, createdAt: new Date() },
  ]),
  seedDefaultCategories: vi.fn().mockResolvedValue(undefined),
  createCategory: vi.fn().mockResolvedValue(undefined),
  deleteCategory: vi.fn().mockResolvedValue(undefined),
  getTransactionsByMonth: vi.fn().mockResolvedValue([
    { id: 1, userId: 1, type: "ENTRADA", value: "3000.00", date: new Date(), categoryId: 1, description: "Salário", origin: "MANUAL", createdAt: new Date() },
    { id: 2, userId: 1, type: "SAIDA", value: "500.00", date: new Date(), categoryId: 2, description: "Supermercado", origin: "MANUAL", createdAt: new Date() },
  ]),
  createTransaction: vi.fn().mockResolvedValue(undefined),
  updateTransaction: vi.fn().mockResolvedValue(undefined),
  deleteTransaction: vi.fn().mockResolvedValue(undefined),
  getFixedExpensesByUser: vi.fn().mockResolvedValue([
    { id: 1, userId: 1, name: "Aluguel", value: "1200.00", dueDay: 5, active: true, categoryId: null, startDate: new Date("2024-01-01"), endDate: null, deletedAt: null, createdAt: new Date() },
  ]),
  getFixedExpensePayments: vi.fn().mockResolvedValue([]),
  createFixedExpense: vi.fn().mockResolvedValue(undefined),
  updateFixedExpense: vi.fn().mockResolvedValue(undefined),
  deleteFixedExpense: vi.fn().mockResolvedValue(undefined),
  upsertFixedExpensePayment: vi.fn().mockResolvedValue(undefined),
  getCreditCardsByUser: vi.fn().mockResolvedValue([
    { id: 1, userId: 1, name: "Nubank", limit: "5000.00", closingDay: 20, dueDay: 27, active: true, createdAt: new Date() },
  ]),
  createCreditCard: vi.fn().mockResolvedValue(undefined),
  deleteCreditCard: vi.fn().mockResolvedValue(undefined),
  getInstallmentsByMonth: vi.fn().mockResolvedValue([
    { id: 1, cardId: 1, userId: 1, description: "iPhone", totalValue: "6000.00", installmentValue: "500.00", currentInstallment: 1, totalInstallments: 12, referenceMonth: "2026-03", purchaseGroupId: "grp1", categoryId: null, createdAt: new Date() },
  ]),
  createInstallments: vi.fn().mockResolvedValue(undefined),
  deleteInstallmentsByGroup: vi.fn().mockResolvedValue(undefined),
  getGoalsByUser: vi.fn().mockResolvedValue([
    { id: 1, userId: 1, name: "Viagem Europa", targetValue: "15000.00", accumulatedValue: "3000.00", priority: 4, targetDate: null, completed: false, deletedAt: null, createdAt: new Date() },
  ]),
  createGoal: vi.fn().mockResolvedValue(undefined),
  updateGoal: vi.fn().mockResolvedValue(undefined),
  deleteGoal: vi.fn().mockResolvedValue(undefined),
  getGoalContributions: vi.fn().mockResolvedValue([
    { id: 1, goalId: 1, userId: 1, value: "3000.00", date: new Date(), note: "Aporte inicial", createdAt: new Date() },
  ]),
  createGoalContribution: vi.fn().mockResolvedValue(undefined),
  getRecentContributionsByGoal: vi.fn().mockResolvedValue([]),
  getActiveAlerts: vi.fn().mockResolvedValue([
    { id: 1, userId: 1, type: "LOW_BALANCE", priority: "MEDIUM", message: "Saldo baixo", referenceMonth: "2026-03", dismissed: false, notificationSent: false, createdAt: new Date() },
  ]),
  createAlert: vi.fn().mockResolvedValue(undefined),
  dismissAlert: vi.fn().mockResolvedValue(undefined),
  markAlertNotificationSent: vi.fn().mockResolvedValue(undefined),
  clearAlertsForMonth: vi.fn().mockResolvedValue(undefined),
  getUnsentAlerts: vi.fn().mockResolvedValue([]),
  getPreviousMonthBalance: vi.fn().mockResolvedValue(0),
}));

vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [{ message: { content: "## Análise\nSeus gastos estão controlados." } }],
  }),
}));

vi.mock("./_core/notification", () => ({
  notifyOwner: vi.fn().mockResolvedValue(true),
}));

// ─── Test Context Factory ──────────────────────────────────────────────────────
function createAuthContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "test-user",
      email: "test@example.com",
      name: "Test User",
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

// ─── Auth Tests ───────────────────────────────────────────────────────────────
describe("auth.me", () => {
  it("returns the authenticated user", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const user = await caller.auth.me();
    expect(user).toBeDefined();
    expect(user?.id).toBe(1);
    expect(user?.name).toBe("Test User");
  });
});

describe("auth.logout", () => {
  it("clears session cookie and returns success", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result.success).toBe(true);
  });
});

// ─── Transactions Tests ───────────────────────────────────────────────────────
describe("transactions.listCategories", () => {
  it("returns categories for the user", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const cats = await caller.transactions.listCategories();
    expect(Array.isArray(cats)).toBe(true);
    expect(cats.length).toBeGreaterThan(0);
    expect(cats[0]).toHaveProperty("name");
    expect(cats[0]).toHaveProperty("type");
  });
});

describe("transactions.listByMonth", () => {
  it("returns transactions for a given month", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const txs = await caller.transactions.listByMonth({ year: 2026, month: 3 });
    expect(Array.isArray(txs)).toBe(true);
    expect(txs.length).toBe(2);
    expect(txs[0].type).toBe("ENTRADA");
    expect(txs[1].type).toBe("SAIDA");
  });
});

describe("transactions.create", () => {
  it("creates a transaction and returns success", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.transactions.create({
      type: "ENTRADA",
      value: 1500,
      date: "2026-03-01",
      categoryId: 1,
      description: "Freelance",
    });
    expect(result.success).toBe(true);
  });

  it("rejects negative values", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.transactions.create({ type: "SAIDA", value: -100, date: "2026-03-01" })
    ).rejects.toThrow();
  });
});

// ─── Fixed Expenses Tests ─────────────────────────────────────────────────────
describe("fixedExpenses.list", () => {
  it("returns fixed expenses for the user", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const expenses = await caller.fixedExpenses.list();
    expect(Array.isArray(expenses)).toBe(true);
    expect(expenses[0].name).toBe("Aluguel");
    expect(expenses[0].dueDay).toBe(5);
  });
});

describe("fixedExpenses.create", () => {
  it("creates a fixed expense and returns success", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.fixedExpenses.create({
      name: "Internet",
      value: 99.9,
      dueDay: 10,
      startDate: "2026-01-01",
    });
    expect(result.success).toBe(true);
  });
});

// ─── Credit Cards Tests ───────────────────────────────────────────────────────
describe("creditCards.list", () => {
  it("returns credit cards for the user", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const cards = await caller.creditCards.list();
    expect(Array.isArray(cards)).toBe(true);
    expect(cards[0].name).toBe("Nubank");
    expect(cards[0].dueDay).toBe(27);
  });
});

describe("creditCards.getInstallmentsByMonth", () => {
  it("returns installments for a given month", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const installments = await caller.creditCards.getInstallmentsByMonth({ referenceMonth: "2026-03" });
    expect(Array.isArray(installments)).toBe(true);
    expect(installments[0].description).toBe("iPhone");
    expect(installments[0].currentInstallment).toBe(1);
    expect(installments[0].totalInstallments).toBe(12);
  });
});

// ─── Goals Tests ──────────────────────────────────────────────────────────────
describe("goals.list", () => {
  it("returns goals for the user", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const goals = await caller.goals.list();
    expect(Array.isArray(goals)).toBe(true);
    expect(goals[0].name).toBe("Viagem Europa");
    expect(goals[0].priority).toBe(4);
  });
});

describe("goals.create", () => {
  it("creates a goal and returns success", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.goals.create({
      name: "Notebook",
      targetValue: 5000,
      initialAmount: 500,
      priority: 3,
    });
    expect(result.success).toBe(true);
  });
});

describe("goals.getContributions", () => {
  it("returns contributions for a goal", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const contribs = await caller.goals.getContributions({ goalId: 1 });
    expect(Array.isArray(contribs)).toBe(true);
    expect(contribs[0].value).toBeDefined();
  });
});

// ─── Dashboard / Alerts Tests ─────────────────────────────────────────────────
describe("dashboard.getAlerts", () => {
  it("returns active alerts for the user", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const alerts = await caller.dashboard.getAlerts();
    expect(Array.isArray(alerts)).toBe(true);
    expect(alerts[0].type).toBe("LOW_BALANCE");
    expect(alerts[0].dismissed).toBe(false);
  });
});

describe("dashboard.dismissAlert", () => {
  it("dismisses an alert and returns success", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.dashboard.dismissAlert({ id: 1 });
    expect(result.success).toBe(true);
  });
});

// ─── Insights Tests ───────────────────────────────────────────────────────────
describe("insights.generate", () => {
  it("generates insights using LLM and returns string content", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.insights.generate({ year: 2026, month: 3 });
    expect(result).toHaveProperty("insights");
    expect(typeof result.insights).toBe("string");
    expect(result.insights.length).toBeGreaterThan(0);
  });
});
