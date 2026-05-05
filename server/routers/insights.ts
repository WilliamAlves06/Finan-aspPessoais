import { z } from "zod";
import { invokeLLM } from "../_core/llm";
import { protectedProcedure, router } from "../_core/trpc";
import {
  getCategoriesByUser,
  getFixedExpensesByUser,
  getGoalsByUser,
  getTransactionsByMonth,
} from "../db";

export const insightsRouter = router({
  generate: protectedProcedure
    .input(z.object({ year: z.number(), month: z.number().min(1).max(12) }))
    .mutation(async ({ ctx, input }) => {
      const { year, month } = input;
      const userId = ctx.user.id;

      // Coleta dados dos últimos 3 meses
      const monthsData = [];
      for (let i = 2; i >= 0; i--) {
        const d = new Date(year, month - 1 - i, 1);
        const y = d.getFullYear();
        const m = d.getMonth() + 1;
        const txs = await getTransactionsByMonth(userId, y, m);
        monthsData.push({
          month: `${y}-${String(m).padStart(2, "0")}`,
          transactions: txs.map((t) => ({
            type: t.type,
            value: parseFloat(String(t.value)),
            categoryId: t.categoryId,
            description: t.description,
          })),
        });
      }

      const categories = await getCategoriesByUser(userId);
      const catMap = Object.fromEntries(categories.map((c) => [c.id, c.name]));
      const fixedExpenses = await getFixedExpensesByUser(userId);
      const goals = await getGoalsByUser(userId);

      // Prepara contexto para o LLM
      const contextText = JSON.stringify({
        months: monthsData.map((md) => ({
          ...md,
          transactions: md.transactions.map((t) => ({
            ...t,
            category: t.categoryId ? catMap[t.categoryId] : "Sem categoria",
          })),
        })),
        fixedExpenses: fixedExpenses.map((f) => ({
          name: f.name,
          value: parseFloat(String(f.value)),
          category: f.categoryId ? catMap[f.categoryId] : "Sem categoria",
        })),
        goals: goals.map((g) => ({
          name: g.name,
          targetValue: parseFloat(String(g.targetValue)),
          accumulatedValue: parseFloat(String(g.accumulatedValue)),
          priority: g.priority,
        })),
      }, null, 2);

      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `Você é um consultor financeiro pessoal especializado em finanças domésticas brasileiras. 
Analise os dados financeiros fornecidos e gere insights personalizados em português brasileiro.
Seja direto, prático e use valores em R$ (reais). 
Formate a resposta em Markdown com seções claras.
Foque em: padrões de gastos, oportunidades de economia, sugestões de orçamento e progresso nas metas.`,
          },
          {
            role: "user",
            content: `Analise meus dados financeiros dos últimos 3 meses e forneça:

1. **Análise de Padrões de Gastos**: Identifique as principais categorias de gasto e tendências
2. **Oportunidades de Economia**: Sugira onde é possível reduzir gastos com impacto real
3. **Saúde Financeira**: Avalie meu equilíbrio entre entradas, saídas fixas e variáveis
4. **Progresso nas Metas**: Analise o ritmo de aporte nas grandes compras planejadas
5. **Recomendações Prioritárias**: Liste 3 ações concretas para melhorar minha situação financeira

Dados financeiros:
${contextText}`,
          },
        ],
      });

      const content = response?.choices?.[0]?.message?.content ?? "Não foi possível gerar insights no momento.";
      return { insights: content };
    }),
});
