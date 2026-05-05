import { z } from "zod";
import { notifyOwner } from "../_core/notification";
import { protectedProcedure, router } from "../_core/trpc";
import {
  clearAlertsForMonth,
  createAlert,
  dismissAlert,
  getActiveAlerts,
  getCreditCardsByUser,
  getFixedExpensePayments,
  getFixedExpensesByUser,
  getGoalsByUser,
  getInstallmentsByMonth,
  getPreviousMonthBalance,
  getRecentContributionsByGoal,
  getTransactionsByMonth,
  getUnsentAlerts,
  markAlertNotificationSent,
} from "../db";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function toYYYYMM(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

async function computeMonthSummary(userId: number, year: number, month: number) {
  const refMonth = toYYYYMM(year, month);

  // Transações manuais do mês
  const txs = await getTransactionsByMonth(userId, year, month);
  const manualIn = txs.filter((t) => t.type === "ENTRADA").reduce((s, t) => s + parseFloat(String(t.value)), 0);
  const manualOut = txs.filter((t) => t.type === "SAIDA").reduce((s, t) => s + parseFloat(String(t.value)), 0);

  // Gastos fixos ativos no mês
  const today = new Date();
  const fixedList = await getFixedExpensesByUser(userId);
  const activeFixed = fixedList.filter((f) => {
    if (!f.active) return false;
    const start = new Date(String(f.startDate));
    const end = f.endDate ? new Date(String(f.endDate)) : null;
    const refDate = new Date(year, month - 1, 1);
    if (start > refDate) return false;
    if (end && end < refDate) return false;
    return true;
  });
  const fixedTotal = activeFixed.reduce((s, f) => s + parseFloat(String(f.value)), 0);

  // Pagamentos de fixos no mês
  const payments = await getFixedExpensePayments(userId, refMonth);
  const paidFixedIds = new Set(payments.filter((p) => p.paid).map((p) => p.fixedExpenseId));
  const unpaidFixed = activeFixed.filter((f) => !paidFixedIds.has(f.id));
  const paidFixed = activeFixed.filter((f) => paidFixedIds.has(f.id));

  // Parcelas de cartão no mês
  const installments = await getInstallmentsByMonth(userId, refMonth);
  const cardTotal = installments.reduce((s, i) => s + parseFloat(String(i.installmentValue)), 0);

  // Saldo acumulado do mês anterior (RN-01)
  const prevBalance = await getPreviousMonthBalance(userId, year, month);
  const carryOver = prevBalance > 0 ? prevBalance : 0;

  const totalIn = manualIn + carryOver;
  const totalOut = manualOut + fixedTotal + cardTotal;
  const freeBalance = totalIn - totalOut;

  // Projeção de parcelas nos próximos 3 meses
  const nextMonthsProjection = [];
  for (let i = 1; i <= 3; i++) {
    const nm = month + i > 12 ? month + i - 12 : month + i;
    const ny = month + i > 12 ? year + 1 : year;
    const nmRef = toYYYYMM(ny, nm);
    const nmInstallments = await getInstallmentsByMonth(userId, nmRef);
    const nmFixed = fixedList.filter((f) => f.active);
    nextMonthsProjection.push({
      month: nmRef,
      cardCommitted: nmInstallments.reduce((s, i) => s + parseFloat(String(i.installmentValue)), 0),
      fixedCommitted: nmFixed.reduce((s, f) => s + parseFloat(String(f.value)), 0),
    });
  }

  // Distribuição por categoria
  const categoryBreakdown: Record<string, number> = {};
  for (const tx of txs.filter((t) => t.type === "SAIDA")) {
    const key = String(tx.categoryId ?? "Sem categoria");
    categoryBreakdown[key] = (categoryBreakdown[key] ?? 0) + parseFloat(String(tx.value));
  }

  return {
    year,
    month,
    refMonth,
    totalIn,
    totalOut,
    freeBalance,
    manualIn,
    manualOut,
    carryOver,
    fixedTotal,
    cardTotal,
    paidFixedCount: paidFixed.length,
    unpaidFixedCount: unpaidFixed.length,
    unpaidFixed,
    installments,
    activeFixed,
    nextMonthsProjection,
    categoryBreakdown,
    transactions: txs,
    today,
  };
}

// ─── Alert Engine ─────────────────────────────────────────────────────────────
async function generateAlertsForMonth(userId: number, year: number, month: number) {
  const summary = await computeMonthSummary(userId, year, month);
  const refMonth = summary.refMonth;
  const today = new Date();

  // Limpa alertas antigos do mês antes de regenerar
  await clearAlertsForMonth(userId, refMonth);

  const newAlerts = [];

  // RN: Saldo projetado negativo
  if (summary.freeBalance < 0) {
    newAlerts.push({
      userId,
      type: "NEGATIVE_BALANCE" as const,
      priority: "HIGH" as const,
      message: `Seu mês pode fechar no vermelho em R$ ${Math.abs(summary.freeBalance).toFixed(2).replace(".", ",")}. Revise seus gastos.`,
      referenceMonth: refMonth,
    });
  }

  // Saldo muito baixo (< 10% das entradas)
  if (summary.freeBalance >= 0 && summary.totalIn > 0 && summary.freeBalance < summary.totalIn * 0.1) {
    newAlerts.push({
      userId,
      type: "LOW_BALANCE" as const,
      priority: "MEDIUM" as const,
      message: `Seu saldo livre está muito baixo (${((summary.freeBalance / summary.totalIn) * 100).toFixed(1)}% das entradas). Considere revisar gastos.`,
      referenceMonth: refMonth,
    });
  }

  // Gastos fixos vencendo em ≤ 3 dias e não pagos
  for (const fe of summary.unpaidFixed) {
    const dueDate = new Date(year, month - 1, fe.dueDay);
    const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays >= 0 && diffDays <= 3) {
      newAlerts.push({
        userId,
        type: "FIXED_DUE_SOON" as const,
        priority: "MEDIUM" as const,
        message: `"${fe.name}" vence em ${diffDays === 0 ? "hoje" : `${diffDays} dia(s)`}. Marque como pago ao quitar.`,
        referenceMonth: refMonth,
      });
    }
  }

  // Parcelas comprometendo > 40% da renda
  if (summary.totalIn > 0 && summary.cardTotal / summary.totalIn > 0.4) {
    newAlerts.push({
      userId,
      type: "HIGH_INSTALLMENTS" as const,
      priority: "MEDIUM" as const,
      message: `Suas parcelas de cartão consomem ${((summary.cardTotal / summary.totalIn) * 100).toFixed(1)}% da sua renda mensal.`,
      referenceMonth: refMonth,
    });
  }

  // Metas sem aporte há 60+ dias
  const goalsList = await getGoalsByUser(userId);
  for (const goal of goalsList.filter((g) => !g.completed)) {
    const recent = await getRecentContributionsByGoal(goal.id, userId, 2);
    if (recent.length === 0) {
      newAlerts.push({
        userId,
        type: "GOAL_NO_CONTRIBUTION" as const,
        priority: "LOW" as const,
        message: `Você não fez aportes em "${goal.name}" há mais de 60 dias.`,
        referenceMonth: refMonth,
      });
    }
  }

  // Cartões com vencimento em ≤ 3 dias
  const cards = await getCreditCardsByUser(userId);
  for (const card of cards.filter((c) => c.active)) {
    const dueDate = new Date(year, month - 1, card.dueDay);
    const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays >= 0 && diffDays <= 3) {
      const cardInstallments = summary.installments.filter((i) => i.cardId === card.id);
      const cardTotal = cardInstallments.reduce((s, i) => s + parseFloat(String(i.installmentValue)), 0);
      if (cardTotal > 0) {
        newAlerts.push({
          userId,
          type: "CARD_DUE_SOON" as const,
          priority: "MEDIUM" as const,
          message: `Fatura do ${card.name} vence em ${diffDays === 0 ? "hoje" : `${diffDays} dia(s)`} — R$ ${cardTotal.toFixed(2).replace(".", ",")}.`,
          referenceMonth: refMonth,
        });
      }
    }
  }

  // Persiste alertas gerados
  for (const alert of newAlerts) {
    await createAlert(alert);
  }

  return newAlerts;
}

// ─── Router ───────────────────────────────────────────────────────────────────
export const dashboardRouter = router({
  summary: protectedProcedure
    .input(z.object({ year: z.number(), month: z.number().min(1).max(12) }))
    .query(async ({ ctx, input }) => {
      return computeMonthSummary(ctx.user.id, input.year, input.month);
    }),

  generateAlerts: protectedProcedure
    .input(z.object({ year: z.number(), month: z.number().min(1).max(12) }))
    .mutation(async ({ ctx, input }) => {
      const generated = await generateAlertsForMonth(ctx.user.id, input.year, input.month);

      // Envia notificações para alertas críticos não enviados
      const unsent = await getUnsentAlerts(ctx.user.id);
      const highPriority = unsent.filter((a) => a.priority === "HIGH");
      if (highPriority.length > 0) {
        const messages = highPriority.map((a) => `• ${a.message}`).join("\n");
        try {
          await notifyOwner({
            title: "⚠️ FinançasPessoais — Alertas Críticos",
            content: `Você tem ${highPriority.length} alerta(s) crítico(s):\n\n${messages}`,
          });
          for (const a of highPriority) {
            await markAlertNotificationSent(a.id);
          }
        } catch (e) {
          console.error("[Alerts] Failed to send notification:", e);
        }
      }

      return { generated: generated.length };
    }),

  getAlerts: protectedProcedure.query(async ({ ctx }) => {
    return getActiveAlerts(ctx.user.id);
  }),

  dismissAlert: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await dismissAlert(input.id, ctx.user.id);
      return { success: true };
    }),

  // Histórico de saldo dos últimos 6 meses
  balanceHistory: protectedProcedure.query(async ({ ctx }) => {
    const now = new Date();
    const history = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      const summary = await computeMonthSummary(ctx.user.id, y, m);
      history.push({
        month: toYYYYMM(y, m),
        label: d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }),
        totalIn: summary.totalIn,
        totalOut: summary.totalOut,
        freeBalance: summary.freeBalance,
      });
    }
    return history;
  }),
});
