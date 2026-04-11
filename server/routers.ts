import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { SignJWT } from "jose";
import { nanoid } from "nanoid";
import { router, publicProcedure, protectedProcedure } from "./_core/trpc";
import { ENV } from "./_core/env";
import { COOKIE_NAME } from "@shared/const";
import * as db from "./db";

const JWT_SECRET = new TextEncoder().encode(ENV.jwtSecret);

async function makeToken(userId: number) {
  return new SignJWT({ userId })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("30d")
    .sign(JWT_SECRET);
}

function sessionCookie(token: string, clear = false) {
  if (clear) return `${COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax; HttpOnly`;
  return `${COOKIE_NAME}=${token}; Path=/; Max-Age=2592000; SameSite=Lax; HttpOnly`;
}

function toYYYYMM(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
const authRouter = router({
  register: publicProcedure
    .input(z.object({
      email: z.string().email("Email inválido"),
      password: z.string().min(6, "Mínimo 6 caracteres"),
      name: z.string().min(1, "Nome obrigatório"),
    }))
    .mutation(async ({ input, ctx }) => {
      const existing = await db.getUserByEmail(input.email);
      if (existing) throw new TRPCError({ code: "CONFLICT", message: "Email já cadastrado" });
      await db.createUser(input.email, input.password, input.name);
      const user = await db.getUserByEmail(input.email);
      if (!user) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Erro ao criar usuário" });
      const token = await makeToken(user.id);
      ctx.res.setHeader("Set-Cookie", sessionCookie(token));
      return { success: true, user: { id: user.id, email: user.email, name: user.name } };
    }),

  login: publicProcedure
    .input(z.object({
      email: z.string().email("Email inválido"),
      password: z.string().min(1, "Senha obrigatória"),
    }))
    .mutation(async ({ input, ctx }) => {
      const user = await db.getUserByEmail(input.email);
      if (!user) throw new TRPCError({ code: "UNAUTHORIZED", message: "Email ou senha incorretos" });
      const ok = await db.verifyPassword(input.password, user.password);
      if (!ok) throw new TRPCError({ code: "UNAUTHORIZED", message: "Email ou senha incorretos" });
      const token = await makeToken(user.id);
      ctx.res.setHeader("Set-Cookie", sessionCookie(token));
      return { success: true, user: { id: user.id, email: user.email, name: user.name } };
    }),

  me: protectedProcedure.query(({ ctx }) => ({
    id: ctx.user.id,
    email: ctx.user.email,
    name: ctx.user.name,
    role: ctx.user.role,
  })),

  logout: publicProcedure.mutation(({ ctx }) => {
    ctx.res.setHeader("Set-Cookie", sessionCookie("", true));
    return { success: true };
  }),
});

// ─── Transactions ─────────────────────────────────────────────────────────────
const transactionsRouter = router({
  listCategories: protectedProcedure.query(async ({ ctx }) => {
    await db.seedDefaultCategories(ctx.user.id);
    return db.getCategoriesByUser(ctx.user.id);
  }),

  createCategory: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(100),
      type: z.enum(["ENTRADA", "SAIDA", "AMBOS"]).default("AMBOS"),
    }))
    .mutation(async ({ ctx, input }) => {
      await db.createCategory({ userId: ctx.user.id, ...input, isDefault: false });
      return { success: true };
    }),

  deleteCategory: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await db.deleteCategory(input.id, ctx.user.id);
      return { success: true };
    }),

  listByMonth: protectedProcedure
    .input(z.object({ year: z.number(), month: z.number().min(1).max(12) }))
    .query(async ({ ctx, input }) => {
      return db.getTransactionsByMonth(ctx.user.id, input.year, input.month);
    }),

  create: protectedProcedure
    .input(z.object({
      type: z.enum(["ENTRADA", "SAIDA"]),
      value: z.number().positive(),
      date: z.string(),
      categoryId: z.number().optional(),
      description: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await db.createTransaction({
        userId: ctx.user.id,
        type: input.type,
        value: String(input.value),
        date: input.date as unknown as Date,
        categoryId: input.categoryId ?? null,
        description: input.description ?? null,
        origin: "MANUAL",
      });
      return { success: true };
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      type: z.enum(["ENTRADA", "SAIDA"]).optional(),
      value: z.number().positive().optional(),
      date: z.string().optional(),
      categoryId: z.number().nullable().optional(),
      description: z.string().nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const patch: Record<string, unknown> = {};
      if (data.type !== undefined) patch.type = data.type;
      if (data.value !== undefined) patch.value = String(data.value);
      if (data.date !== undefined) patch.date = data.date;
      if (data.categoryId !== undefined) patch.categoryId = data.categoryId;
      if (data.description !== undefined) patch.description = data.description;
      await db.updateTransaction(id, ctx.user.id, patch as Parameters<typeof db.updateTransaction>[2]);
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await db.deleteTransaction(input.id, ctx.user.id);
      return { success: true };
    }),
});

// ─── Fixed Expenses ───────────────────────────────────────────────────────────
const fixedExpensesRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => db.getFixedExpensesByUser(ctx.user.id)),

  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(150),
      value: z.number().positive(),
      dueDay: z.number().min(1).max(31),
      categoryId: z.number().optional(),
      startDate: z.string(),
      endDate: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await db.createFixedExpense({
        userId: ctx.user.id,
        name: input.name,
        value: String(input.value),
        dueDay: input.dueDay,
        categoryId: input.categoryId ?? null,
        active: true,
        startDate: input.startDate as unknown as Date,
        endDate: input.endDate ? (input.endDate as unknown as Date) : null,
      });
      return { success: true };
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).max(150).optional(),
      value: z.number().positive().optional(),
      dueDay: z.number().min(1).max(31).optional(),
      categoryId: z.number().nullable().optional(),
      active: z.boolean().optional(),
      endDate: z.string().nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const patch: Record<string, unknown> = {};
      if (data.name !== undefined) patch.name = data.name;
      if (data.value !== undefined) patch.value = String(data.value);
      if (data.dueDay !== undefined) patch.dueDay = data.dueDay;
      if (data.categoryId !== undefined) patch.categoryId = data.categoryId;
      if (data.active !== undefined) patch.active = data.active;
      if (data.endDate !== undefined) patch.endDate = data.endDate;
      await db.updateFixedExpense(id, ctx.user.id, patch as Parameters<typeof db.updateFixedExpense>[2]);
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await db.deleteFixedExpense(input.id, ctx.user.id);
      return { success: true };
    }),

  getPayments: protectedProcedure
    .input(z.object({ referenceMonth: z.string() }))
    .query(async ({ ctx, input }) => db.getFixedExpensePayments(ctx.user.id, input.referenceMonth)),

  togglePayment: protectedProcedure
    .input(z.object({
      fixedExpenseId: z.number(),
      referenceMonth: z.string(),
      paid: z.boolean(),
    }))
    .mutation(async ({ ctx, input }) => {
      await db.upsertFixedExpensePayment(input.fixedExpenseId, ctx.user.id, input.referenceMonth, input.paid);
      return { success: true };
    }),
});

// ─── Credit Cards ─────────────────────────────────────────────────────────────
const creditCardsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => db.getCreditCardsByUser(ctx.user.id)),

  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(100),
      limit: z.number().positive(),
      closingDay: z.number().min(1).max(31),
      dueDay: z.number().min(1).max(31),
    }))
    .mutation(async ({ ctx, input }) => {
      await db.createCreditCard({ userId: ctx.user.id, ...input, limit: String(input.limit), active: true });
      return { success: true };
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).max(100).optional(),
      limit: z.number().positive().optional(),
      closingDay: z.number().min(1).max(31).optional(),
      dueDay: z.number().min(1).max(31).optional(),
      active: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const patch: Record<string, unknown> = {};
      if (data.name !== undefined) patch.name = data.name;
      if (data.limit !== undefined) patch.limit = String(data.limit);
      if (data.closingDay !== undefined) patch.closingDay = data.closingDay;
      if (data.dueDay !== undefined) patch.dueDay = data.dueDay;
      if (data.active !== undefined) patch.active = data.active;
      await db.updateCreditCard(id, ctx.user.id, patch as Parameters<typeof db.updateCreditCard>[2]);
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await db.deleteCreditCard(input.id, ctx.user.id);
      return { success: true };
    }),

  addPurchase: protectedProcedure
    .input(z.object({
      cardId: z.number(),
      description: z.string().min(1).max(200),
      totalValue: z.number().positive(),
      installments: z.number().min(1).max(60),
      firstInstallmentMonth: z.string(),
      categoryId: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const groupId = nanoid();
      const base = Math.floor((input.totalValue / input.installments) * 100) / 100;
      const last = Math.round((input.totalValue - base * (input.installments - 1)) * 100) / 100;
      const [fy, fm] = input.firstInstallmentMonth.split("-").map(Number);
      const rows = Array.from({ length: input.installments }, (_, i) => {
        const offset = fm - 1 + i;
        const y = fy + Math.floor(offset / 12);
        const m = (offset % 12) + 1;
        return {
          cardId: input.cardId,
          userId: ctx.user.id,
          description: input.description,
          totalValue: String(input.totalValue),
          installmentValue: String(i === input.installments - 1 ? last : base),
          currentInstallment: i + 1,
          totalInstallments: input.installments,
          referenceMonth: `${y}-${String(m).padStart(2, "0")}`,
          categoryId: input.categoryId ?? null,
          paid: false,
          purchaseGroupId: groupId,
        };
      });
      await db.createCardInstallments(rows);
      return { success: true, purchaseGroupId: groupId };
    }),

  deletePurchase: protectedProcedure
    .input(z.object({ purchaseGroupId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await db.deleteCardPurchase(input.purchaseGroupId, ctx.user.id);
      return { success: true };
    }),

  getInstallmentsByCard: protectedProcedure
    .input(z.object({ cardId: z.number() }))
    .query(async ({ ctx, input }) => db.getInstallmentsByCard(input.cardId, ctx.user.id)),

  getInstallmentsByMonth: protectedProcedure
    .input(z.object({ referenceMonth: z.string() }))
    .query(async ({ ctx, input }) => db.getInstallmentsByMonth(ctx.user.id, input.referenceMonth)),
});

// ─── Goals ────────────────────────────────────────────────────────────────────
const goalsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const list = await db.getGoalsByUser(ctx.user.id);
    return Promise.all(list.map(async (g) => {
      const recent = await db.getRecentContributionsByGoal(g.id, ctx.user.id, 3);
      const avg = recent.length > 0
        ? recent.reduce((s, c) => s + parseFloat(String(c.value)), 0) / 3
        : 0;
      const remaining = parseFloat(String(g.targetValue)) - parseFloat(String(g.accumulatedValue));
      return { ...g, avgMonthlyContribution: avg, monthsToComplete: avg > 0 ? Math.ceil(remaining / avg) : null };
    }));
  }),

  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(150),
      targetValue: z.number().positive(),
      initialAmount: z.number().min(0).default(0),
      priority: z.number().min(1).max(5).default(3),
      targetDate: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await db.createGoal({
        userId: ctx.user.id,
        name: input.name,
        targetValue: String(input.targetValue),
        accumulatedValue: String(input.initialAmount),
        priority: input.priority,
        targetDate: input.targetDate ? (input.targetDate as unknown as Date) : null,
        completed: false,
      });
      return { success: true };
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).max(150).optional(),
      targetValue: z.number().positive().optional(),
      priority: z.number().min(1).max(5).optional(),
      targetDate: z.string().nullable().optional(),
      completed: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const patch: Record<string, unknown> = {};
      if (data.name !== undefined) patch.name = data.name;
      if (data.targetValue !== undefined) patch.targetValue = String(data.targetValue);
      if (data.priority !== undefined) patch.priority = data.priority;
      if (data.targetDate !== undefined) patch.targetDate = data.targetDate;
      if (data.completed !== undefined) patch.completed = data.completed;
      await db.updateGoal(id, ctx.user.id, patch as Parameters<typeof db.updateGoal>[2]);
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await db.deleteGoal(input.id, ctx.user.id);
      return { success: true };
    }),

  addContribution: protectedProcedure
    .input(z.object({
      goalId: z.number(),
      value: z.number().positive(),
      date: z.string(),
      note: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await db.createGoalContribution({
        goalId: input.goalId,
        userId: ctx.user.id,
        value: String(input.value),
        date: input.date as unknown as Date,
        note: input.note ?? null,
      });
      return { success: true };
    }),

  getContributions: protectedProcedure
    .input(z.object({ goalId: z.number() }))
    .query(async ({ ctx, input }) => db.getGoalContributions(input.goalId, ctx.user.id)),
});

// ─── Dashboard ────────────────────────────────────────────────────────────────
async function computeSummary(userId: number, year: number, month: number) {
  const refMonth = toYYYYMM(year, month);
  const txs = await db.getTransactionsByMonth(userId, year, month);
  const manualIn = txs.filter(t => t.type === "ENTRADA").reduce((s, t) => s + parseFloat(String(t.value)), 0);
  const manualOut = txs.filter(t => t.type === "SAIDA").reduce((s, t) => s + parseFloat(String(t.value)), 0);

  const allFixed = await db.getFixedExpensesByUser(userId);
  const refDate = new Date(year, month - 1, 1);
  const activeFixed = allFixed.filter(f => {
    if (!f.active) return false;
    const start = new Date(String(f.startDate));
    const end = f.endDate ? new Date(String(f.endDate)) : null;
    if (start > refDate) return false;
    if (end && end < refDate) return false;
    return true;
  });
  const fixedTotal = activeFixed.reduce((s, f) => s + parseFloat(String(f.value)), 0);

  const payments = await db.getFixedExpensePayments(userId, refMonth);
  const paidIds = new Set(payments.filter(p => p.paid).map(p => p.fixedExpenseId));

  const installments = await db.getInstallmentsByMonth(userId, refMonth);
  const cardTotal = installments.reduce((s, i) => s + parseFloat(String(i.installmentValue)), 0);

  const prevBalance = await db.getPreviousMonthBalance(userId, year, month);
  const carryOver = prevBalance > 0 ? prevBalance : 0;

  const totalIn = manualIn + carryOver;
  const totalOut = manualOut + fixedTotal + cardTotal;
  const freeBalance = totalIn - totalOut;

  const categoryBreakdown: Record<string, number> = {};
  for (const tx of txs.filter(t => t.type === "SAIDA")) {
    const key = String(tx.categoryId ?? "0");
    categoryBreakdown[key] = (categoryBreakdown[key] ?? 0) + parseFloat(String(tx.value));
  }

  const nextMonthsProjection = await Promise.all(
    [1, 2, 3].map(async (i) => {
      const offset = month - 1 + i;
      const ny = year + Math.floor(offset / 12);
      const nm = (offset % 12) + 1;
      const nmRef = toYYYYMM(ny, nm);
      const nmInst = await db.getInstallmentsByMonth(userId, nmRef);
      return {
        month: nmRef,
        cardCommitted: nmInst.reduce((s, x) => s + parseFloat(String(x.installmentValue)), 0),
        fixedCommitted: activeFixed.reduce((s, f) => s + parseFloat(String(f.value)), 0),
      };
    })
  );

  return {
    year, month, refMonth, totalIn, totalOut, freeBalance,
    manualIn, manualOut, carryOver, fixedTotal, cardTotal,
    paidFixedCount: activeFixed.filter(f => paidIds.has(f.id)).length,
    unpaidFixedCount: activeFixed.filter(f => !paidIds.has(f.id)).length,
    unpaidFixed: activeFixed.filter(f => !paidIds.has(f.id)),
    installments, activeFixed, nextMonthsProjection, categoryBreakdown, transactions: txs,
  };
}

async function generateAlerts(userId: number, year: number, month: number) {
  const s = await computeSummary(userId, year, month);
  const refMonth = s.refMonth;
  await db.clearAlertsForMonth(userId, refMonth);
  const today = new Date();

  if (s.freeBalance < 0) {
    await db.createAlert({ userId, type: "NEGATIVE_BALANCE", priority: "HIGH",
      message: `Saldo projetado negativo em R$ ${Math.abs(s.freeBalance).toFixed(2).replace(".", ",")}. Revise seus gastos.`,
      referenceMonth: refMonth });
  } else if (s.totalIn > 0 && s.freeBalance < s.totalIn * 0.1) {
    await db.createAlert({ userId, type: "LOW_BALANCE", priority: "MEDIUM",
      message: `Saldo livre muito baixo (${((s.freeBalance / s.totalIn) * 100).toFixed(1)}% das entradas).`,
      referenceMonth: refMonth });
  }

  for (const fe of s.unpaidFixed) {
    const due = new Date(year, month - 1, fe.dueDay);
    const diff = Math.ceil((due.getTime() - today.getTime()) / 86400000);
    if (diff >= 0 && diff <= 3) {
      await db.createAlert({ userId, type: "FIXED_DUE_SOON", priority: "MEDIUM",
        message: `"${fe.name}" vence em ${diff === 0 ? "hoje" : `${diff} dia(s)`}.`,
        referenceMonth: refMonth });
    }
  }

  if (s.totalIn > 0 && s.cardTotal / s.totalIn > 0.4) {
    await db.createAlert({ userId, type: "HIGH_INSTALLMENTS", priority: "MEDIUM",
      message: `Parcelas de cartão consomem ${((s.cardTotal / s.totalIn) * 100).toFixed(1)}% da sua renda.`,
      referenceMonth: refMonth });
  }

  const goalsList = await db.getGoalsByUser(userId);
  for (const g of goalsList.filter(x => !x.completed)) {
    const recent = await db.getRecentContributionsByGoal(g.id, userId, 2);
    if (recent.length === 0) {
      await db.createAlert({ userId, type: "GOAL_NO_CONTRIBUTION", priority: "LOW",
        message: `Nenhum aporte em "${g.name}" nos últimos 60 dias.`,
        referenceMonth: refMonth });
    }
  }

  const cards = await db.getCreditCardsByUser(userId);
  for (const card of cards.filter(c => c.active)) {
    const due = new Date(year, month - 1, card.dueDay);
    const diff = Math.ceil((due.getTime() - today.getTime()) / 86400000);
    if (diff >= 0 && diff <= 3) {
      const cardTotal = s.installments.filter(i => i.cardId === card.id)
        .reduce((sum, i) => sum + parseFloat(String(i.installmentValue)), 0);
      if (cardTotal > 0) {
        await db.createAlert({ userId, type: "CARD_DUE_SOON", priority: "MEDIUM",
          message: `Fatura ${card.name} vence em ${diff === 0 ? "hoje" : `${diff} dia(s)`} — R$ ${cardTotal.toFixed(2).replace(".", ",")}.`,
          referenceMonth: refMonth });
      }
    }
  }
}

const dashboardRouter = router({
  summary: protectedProcedure
    .input(z.object({ year: z.number(), month: z.number().min(1).max(12) }))
    .query(async ({ ctx, input }) => computeSummary(ctx.user.id, input.year, input.month)),

  generateAlerts: protectedProcedure
    .input(z.object({ year: z.number(), month: z.number().min(1).max(12) }))
    .mutation(async ({ ctx, input }) => {
      await generateAlerts(ctx.user.id, input.year, input.month);
      return { success: true };
    }),

  getAlerts: protectedProcedure.query(async ({ ctx }) => db.getActiveAlerts(ctx.user.id)),

  dismissAlert: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await db.dismissAlert(input.id, ctx.user.id);
      return { success: true };
    }),

  balanceHistory: protectedProcedure.query(async ({ ctx }) => {
    const now = new Date();
    return Promise.all(
      Array.from({ length: 6 }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
        return { y: d.getFullYear(), m: d.getMonth() + 1, d };
      }).map(async ({ y, m, d }) => {
        const s = await computeSummary(ctx.user.id, y, m);
        return {
          month: toYYYYMM(y, m),
          label: d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }),
          totalIn: s.totalIn, totalOut: s.totalOut, freeBalance: s.freeBalance,
        };
      })
    );
  }),
});

// ─── App Router ───────────────────────────────────────────────────────────────
export const appRouter = router({
  auth: authRouter,
  transactions: transactionsRouter,
  fixedExpenses: fixedExpensesRouter,
  creditCards: creditCardsRouter,
  goals: goalsRouter,
  dashboard: dashboardRouter,
});

export type AppRouter = typeof appRouter;
