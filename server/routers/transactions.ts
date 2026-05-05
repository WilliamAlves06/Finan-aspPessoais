import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  createCategory,
  createTransaction,
  deleteCategory,
  deleteTransaction,
  getCategoriesByUser,
  getTransactionsByMonth,
  seedDefaultCategories,
  updateTransaction,
} from "../db";
import { protectedProcedure, router } from "../_core/trpc";

export const transactionsRouter = router({
  // ─── Categories ──────────────────────────────────────────────────────────────
  listCategories: protectedProcedure.query(async ({ ctx }) => {
    await seedDefaultCategories(ctx.user.id);
    return getCategoriesByUser(ctx.user.id);
  }),

  createCategory: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(100),
      type: z.enum(["ENTRADA", "SAIDA", "AMBOS"]).default("AMBOS"),
    }))
    .mutation(async ({ ctx, input }) => {
      await createCategory({ userId: ctx.user.id, name: input.name, type: input.type, isDefault: false });
      return { success: true };
    }),

  deleteCategory: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await deleteCategory(input.id, ctx.user.id);
      return { success: true };
    }),

  // ─── Transactions ─────────────────────────────────────────────────────────────
  listByMonth: protectedProcedure
    .input(z.object({ year: z.number(), month: z.number().min(1).max(12) }))
    .query(async ({ ctx, input }) => {
      return getTransactionsByMonth(ctx.user.id, input.year, input.month);
    }),

  create: protectedProcedure
    .input(z.object({
      type: z.enum(["ENTRADA", "SAIDA"]),
      value: z.number().positive(),
      date: z.string(), // YYYY-MM-DD
      categoryId: z.number().optional(),
      description: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await createTransaction({
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
      const updateData: Record<string, unknown> = {};
      if (data.type !== undefined) updateData.type = data.type;
      if (data.value !== undefined) updateData.value = String(data.value);
      if (data.date !== undefined) updateData.date = data.date;
      if (data.categoryId !== undefined) updateData.categoryId = data.categoryId;
      if (data.description !== undefined) updateData.description = data.description;
      await updateTransaction(id, ctx.user.id, updateData as Parameters<typeof updateTransaction>[2]);
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await deleteTransaction(input.id, ctx.user.id);
      return { success: true };
    }),
});
