import { z } from "zod";
import { nanoid } from "nanoid";
import {
  createCardInstallments,
  createCreditCard,
  deleteCreditCard,
  deleteCardPurchase,
  getCreditCardsByUser,
  getInstallmentsByCard,
  getInstallmentsByMonth,
  updateCreditCard,
} from "../db";
import { protectedProcedure, router } from "../_core/trpc";

export const creditCardsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return getCreditCardsByUser(ctx.user.id);
  }),

  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(100),
      limit: z.number().positive(),
      closingDay: z.number().min(1).max(31),
      dueDay: z.number().min(1).max(31),
    }))
    .mutation(async ({ ctx, input }) => {
      await createCreditCard({
        userId: ctx.user.id,
        name: input.name,
        limit: String(input.limit),
        closingDay: input.closingDay,
        dueDay: input.dueDay,
        active: true,
      });
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
      const updateData: Record<string, unknown> = {};
      if (data.name !== undefined) updateData.name = data.name;
      if (data.limit !== undefined) updateData.limit = String(data.limit);
      if (data.closingDay !== undefined) updateData.closingDay = data.closingDay;
      if (data.dueDay !== undefined) updateData.dueDay = data.dueDay;
      if (data.active !== undefined) updateData.active = data.active;
      await updateCreditCard(id, ctx.user.id, updateData as Parameters<typeof updateCreditCard>[2]);
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await deleteCreditCard(input.id, ctx.user.id);
      return { success: true };
    }),

  // Lançar compra (à vista ou parcelada)
  addPurchase: protectedProcedure
    .input(z.object({
      cardId: z.number(),
      description: z.string().min(1).max(200),
      totalValue: z.number().positive(),
      installments: z.number().min(1).max(60),
      firstInstallmentMonth: z.string(), // YYYY-MM
      categoryId: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const purchaseGroupId = nanoid();
      const baseValue = Math.floor((input.totalValue / input.installments) * 100) / 100;
      const lastValue = Math.round((input.totalValue - baseValue * (input.installments - 1)) * 100) / 100;

      const [firstYear, firstMonth] = input.firstInstallmentMonth.split("-").map(Number);
      const installmentRows = [];

      for (let i = 0; i < input.installments; i++) {
        const monthOffset = firstMonth - 1 + i;
        const year = firstYear + Math.floor(monthOffset / 12);
        const month = (monthOffset % 12) + 1;
        const refMonth = `${year}-${String(month).padStart(2, "0")}`;
        const isLast = i === input.installments - 1;
        installmentRows.push({
          cardId: input.cardId,
          userId: ctx.user.id,
          description: input.description,
          totalValue: String(input.totalValue),
          installmentValue: String(isLast ? lastValue : baseValue),
          currentInstallment: i + 1,
          totalInstallments: input.installments,
          referenceMonth: refMonth,
          categoryId: input.categoryId ?? null,
          paid: false,
          purchaseGroupId,
        });
      }

      await createCardInstallments(installmentRows);
      return { success: true, purchaseGroupId };
    }),

  deletePurchase: protectedProcedure
    .input(z.object({ purchaseGroupId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await deleteCardPurchase(input.purchaseGroupId, ctx.user.id);
      return { success: true };
    }),

  getInstallmentsByCard: protectedProcedure
    .input(z.object({ cardId: z.number() }))
    .query(async ({ ctx, input }) => {
      return getInstallmentsByCard(input.cardId, ctx.user.id);
    }),

  getInstallmentsByMonth: protectedProcedure
    .input(z.object({ referenceMonth: z.string() }))
    .query(async ({ ctx, input }) => {
      return getInstallmentsByMonth(ctx.user.id, input.referenceMonth);
    }),
});
