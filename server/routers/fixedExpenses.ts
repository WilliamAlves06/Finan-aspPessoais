import { z } from "zod";
import {
  createFixedExpense,
  deleteFixedExpense,
  getFixedExpensePayments,
  getFixedExpensesByUser,
  updateFixedExpense,
  upsertFixedExpensePayment,
} from "../db";
import { protectedProcedure, router } from "../_core/trpc";

export const fixedExpensesRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return getFixedExpensesByUser(ctx.user.id);
  }),

  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(150),
      value: z.number().positive(),
      dueDay: z.number().min(1).max(31),
      categoryId: z.number().optional(),
      startDate: z.string(), // YYYY-MM-DD
      endDate: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await createFixedExpense({
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
      const updateData: Record<string, unknown> = {};
      if (data.name !== undefined) updateData.name = data.name;
      if (data.value !== undefined) updateData.value = String(data.value);
      if (data.dueDay !== undefined) updateData.dueDay = data.dueDay;
      if (data.categoryId !== undefined) updateData.categoryId = data.categoryId;
      if (data.active !== undefined) updateData.active = data.active;
      if (data.endDate !== undefined) updateData.endDate = data.endDate;
      await updateFixedExpense(id, ctx.user.id, updateData as Parameters<typeof updateFixedExpense>[2]);
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await deleteFixedExpense(input.id, ctx.user.id);
      return { success: true };
    }),

  getPayments: protectedProcedure
    .input(z.object({ referenceMonth: z.string() })) // YYYY-MM
    .query(async ({ ctx, input }) => {
      return getFixedExpensePayments(ctx.user.id, input.referenceMonth);
    }),

  togglePayment: protectedProcedure
    .input(z.object({
      fixedExpenseId: z.number(),
      referenceMonth: z.string(),
      paid: z.boolean(),
    }))
    .mutation(async ({ ctx, input }) => {
      await upsertFixedExpensePayment(input.fixedExpenseId, ctx.user.id, input.referenceMonth, input.paid);
      return { success: true };
    }),
});
