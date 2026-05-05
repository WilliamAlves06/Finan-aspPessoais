import { z } from "zod";
import {
  createGoal,
  createGoalContribution,
  deleteGoal,
  getGoalContributions,
  getGoalsByUser,
  getRecentContributionsByGoal,
  updateGoal,
} from "../db";
import { protectedProcedure, router } from "../_core/trpc";

export const goalsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const goalsList = await getGoalsByUser(ctx.user.id);
    // Calcula previsão de conclusão para cada meta
    const goalsWithForecast = await Promise.all(
      goalsList.map(async (goal) => {
        const recentContribs = await getRecentContributionsByGoal(goal.id, ctx.user.id, 3);
        const avgMonthly =
          recentContribs.length > 0
            ? recentContribs.reduce((s, c) => s + parseFloat(String(c.value)), 0) / 3
            : 0;
        const remaining = parseFloat(String(goal.targetValue)) - parseFloat(String(goal.accumulatedValue));
        const monthsLeft = avgMonthly > 0 ? Math.ceil(remaining / avgMonthly) : null;
        return { ...goal, avgMonthlyContribution: avgMonthly, monthsToComplete: monthsLeft };
      })
    );
    return goalsWithForecast;
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
      await createGoal({
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
      const updateData: Record<string, unknown> = {};
      if (data.name !== undefined) updateData.name = data.name;
      if (data.targetValue !== undefined) updateData.targetValue = String(data.targetValue);
      if (data.priority !== undefined) updateData.priority = data.priority;
      if (data.targetDate !== undefined) updateData.targetDate = data.targetDate;
      if (data.completed !== undefined) updateData.completed = data.completed;
      await updateGoal(id, ctx.user.id, updateData as Parameters<typeof updateGoal>[2]);
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await deleteGoal(input.id, ctx.user.id);
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
      await createGoalContribution({
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
    .query(async ({ ctx, input }) => {
      return getGoalContributions(input.goalId, ctx.user.id);
    }),
});
