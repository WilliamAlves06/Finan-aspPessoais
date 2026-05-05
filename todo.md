# FinançasPessoais — TODO

## Schema & Backend
- [x] Schema Drizzle: tabelas transactions, categories, fixedExpenses, creditCards, cardInstallments, goals, goalContributions, alerts
- [x] Migrations e aplicação via webdev_execute_sql
- [x] tRPC routers: transactions (CRUD + saldo acumulado)
- [x] tRPC routers: categories (listagem)
- [x] tRPC routers: fixedExpenses (CRUD + quitação mensal)
- [x] tRPC routers: creditCards (CRUD + installments + fatura)
- [x] tRPC routers: goals (CRUD + aportes + progresso)
- [x] tRPC routers: alerts (geração automática + listagem + dismiss)
- [x] tRPC routers: dashboard (métricas consolidadas + projeções)
- [x] tRPC routers: insights LLM (análise de padrões + recomendações)
- [x] Notificações por email via notifyOwner para alertas críticos
- [x] Regras de negócio: saldo acumulado (RN-01)
- [x] Regras de negócio: gastos fixos automáticos (RN-02)
- [x] Regras de negócio: fatura fechada cartão (RN-03)
- [x] Regras de negócio: arredondamento parcelas (RN-04)

## Design & Layout
- [x] Tema cinematográfico: gradiente azul-petróleo + laranja queimado
- [x] Tipografia sans-serif branca em negrito (Space Grotesk + Inter)
- [x] Acentos geométricos ciano e laranja
- [x] DashboardLayout com sidebar personalizado e redimensionável
- [x] Navegação: Dashboard, Transações, Fixos, Cartões, Metas, Alertas, Insights

## Páginas Frontend
- [x] Dashboard: métricas consolidadas, projeção, alertas ativos, gráficos
- [x] Transações: CRUD com filtros por mês/categoria/tipo
- [x] Gastos Fixos: CRUD + quitação mensal + histórico
- [x] Cartões de Crédito: CRUD cartões + lançamentos parcelados + fatura
- [x] Grandes Compras: CRUD metas + aportes + progresso + previsão
- [x] Alertas: listagem com dismiss e detalhes
- [x] Insights LLM: análise de padrões e recomendações personalizadas

## Gráficos
- [x] Gráfico de evolução de saldo (linha - AreaChart)
- [x] Gráfico de distribuição de gastos por categoria (pizza/donut - PieChart)
- [x] Gráfico de projeção de faturas futuras (barras - BarChart)

## Testes
- [x] Vitest: testes de routers principais (17 testes passando)
- [x] Vitest: testes de regras de negócio (saldo acumulado, parcelas)
