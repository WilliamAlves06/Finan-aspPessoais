import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as jose from "jose";
import { createUser, getUserByEmail, verifyPassword } from "./auth";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { dashboardRouter } from "./routers/dashboard";
import { transactionsRouter } from "./routers/transactions";
import { creditCardsRouter } from "./routers/creditCards";
import { fixedExpensesRouter } from "./routers/fixedExpenses";
import { goalsRouter } from "./routers/goals";
import { insightsRouter } from "./routers/insights";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "seu-secret-super-seguro");

async function createSessionToken(userId: number, email: string) {
  return await new jose.SignJWT({ userId, email })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("30d")
    .sign(JWT_SECRET);
}

export const appRouter = router({
  auth: router({
    register: publicProcedure
      .input(z.object({
        email: z.string().email("Email inválido"),
        password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
        name: z.string().min(1, "Nome é obrigatório"),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          const existing = await getUserByEmail(input.email);
          if (existing) {
            throw new TRPCError({ 
              code: "CONFLICT", 
              message: "Este email já está cadastrado" 
            });
          }

          await createUser(input.email, input.password, input.name);
          const user = await getUserByEmail(input.email);
          
          if (!user) {
            throw new TRPCError({ 
              code: "INTERNAL_SERVER_ERROR", 
              message: "Erro ao criar usuário" 
            });
          }

          const token = await createSessionToken(user.id, user.email);
          const cookieOptions = getSessionCookieOptions(ctx.req);
          
          // Define o cookie corretamente
          ctx.res.setHeader(
            "Set-Cookie",
            `${COOKIE_NAME}=${token}; Path=/; Max-Age=2592000; ${cookieOptions.secure ? "Secure; " : ""}SameSite=Lax; HttpOnly`
          );

          return { 
            success: true, 
            user: {
              id: user.id,
              email: user.email,
              name: user.name,
              role: user.role,
            }
          };
        } catch (error) {
          if (error instanceof TRPCError) throw error;
          console.error("[Auth Register Error]", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Erro ao cadastrar usuário",
          });
        }
      }),

    login: publicProcedure
      .input(z.object({
        email: z.string().email("Email inválido"),
        password: z.string().min(1, "Senha é obrigatória"),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          const user = await getUserByEmail(input.email);
          if (!user) {
            throw new TRPCError({ 
              code: "UNAUTHORIZED", 
              message: "Email ou senha incorretos" 
            });
          }

          const isValid = await verifyPassword(input.password, user.password);
          if (!isValid) {
            throw new TRPCError({ 
              code: "UNAUTHORIZED", 
              message: "Email ou senha incorretos" 
            });
          }

          const token = await createSessionToken(user.id, user.email);
          const cookieOptions = getSessionCookieOptions(ctx.req);
          
          // Define o cookie corretamente
          ctx.res.setHeader(
            "Set-Cookie",
            `${COOKIE_NAME}=${token}; Path=/; Max-Age=2592000; ${cookieOptions.secure ? "Secure; " : ""}SameSite=Lax; HttpOnly`
          );

          return { 
            success: true, 
            user: {
              id: user.id,
              email: user.email,
              name: user.name,
              role: user.role,
            }
          };
        } catch (error) {
          if (error instanceof TRPCError) throw error;
          console.error("[Auth Login Error]", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Erro ao fazer login",
          });
        }
      }),

    me: protectedProcedure.query(({ ctx }) => ctx.user),

    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true };
    }),
  }),

  dashboard: dashboardRouter,
  transactions: transactionsRouter,
  creditCards: creditCardsRouter,
  fixedExpenses: fixedExpensesRouter,
  goals: goalsRouter,
  insights: insightsRouter,
});

export type AppRouter = typeof appRouter;
