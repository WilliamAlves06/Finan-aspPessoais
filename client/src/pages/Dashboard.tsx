import { trpc } from "@/lib/trpc";
import { formatCurrency, formatMonthFull, currentYearMonth, prevMonth, nextMonth } from "@/lib/format";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  TrendingUp, TrendingDown, ChevronLeft, ChevronRight, AlertTriangle,
  Wallet, CreditCard, Target, CheckCircle, Clock, RefreshCw,
  ArrowUpRight, ArrowDownRight, Minus,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";
import { toast } from "sonner";

const CHART_COLORS = [
  "oklch(0.65 0.18 35)", "oklch(0.52 0.15 195)", "oklch(0.68 0.14 155)",
  "oklch(0.73 0.16 60)", "oklch(0.58 0.20 310)", "oklch(0.62 0.18 250)",
  "oklch(0.70 0.15 90)", "oklch(0.60 0.22 15)",
];

function MonthSelector({ year, month, onChange }: { year: number; month: number; onChange: (y: number, m: number) => void }) {
  return (
    <div className="flex items-center gap-2">
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { const p = prevMonth(year, month); onChange(p.year, p.month); }}>
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="text-sm font-semibold min-w-36 text-center capitalize">
        {formatMonthFull(year, month)}
      </span>
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { const n = nextMonth(year, month); onChange(n.year, n.month); }}>
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

function MetricCard({ title, value, subtitle, icon: Icon, trend, color }: {
  title: string; value: string; subtitle?: string;
  icon: React.ElementType; trend?: "up" | "down" | "neutral"; color?: string;
}) {
  return (
    <Card className="metric-card border-border/40 overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">{title}</p>
            <p className="text-2xl font-bold font-tabular text-foreground truncate" style={{ color: color ?? undefined }}>{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-1.5">{subtitle}</p>}
          </div>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ml-3"
            style={{ background: `${color ?? "oklch(0.65 0.18 35)"}/15` }}>
            <Icon className="h-5 w-5" style={{ color: color ?? "oklch(0.65 0.18 35)" }} />
          </div>
        </div>
        {trend && (
          <div className="mt-3 flex items-center gap-1">
            {trend === "up" ? <ArrowUpRight className="h-3 w-3 text-emerald-400" /> :
             trend === "down" ? <ArrowDownRight className="h-3 w-3 text-red-400" /> :
             <Minus className="h-3 w-3 text-muted-foreground" />}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { year: cy, month: cm } = currentYearMonth();
  const [year, setYear] = useState(cy);
  const [month, setMonth] = useState(cm);

  const { data: summary, isLoading, refetch } = trpc.dashboard.summary.useQuery({ year, month });
  const { data: history } = trpc.dashboard.balanceHistory.useQuery();
  const { data: alerts } = trpc.dashboard.getAlerts.useQuery();
  const { data: categories } = trpc.transactions.listCategories.useQuery();
  const generateAlerts = trpc.dashboard.generateAlerts.useMutation({ onSuccess: () => refetch() });

  // Auto-gera alertas ao mudar de mês
  useEffect(() => {
    generateAlerts.mutate({ year, month });
  }, [year, month]); // eslint-disable-line react-hooks/exhaustive-deps

  const catMap = Object.fromEntries((categories ?? []).map((c) => [c.id, c.name]));

  // Dados para gráfico de pizza por categoria
  const pieData = summary
    ? Object.entries(summary.categoryBreakdown).map(([catId, value]) => ({
        name: catMap[Number(catId)] ?? "Outros",
        value: Math.round(value * 100) / 100,
      })).sort((a, b) => b.value - a.value).slice(0, 8)
    : [];

  const balance = summary?.freeBalance ?? 0;
  const balanceStatus = balance > 0 ? "POSITIVO" : balance < 0 ? "NEGATIVO" : "EQUILIBRADO";
  const balanceColor = balance > 0 ? "oklch(0.68 0.18 155)" : balance < 0 ? "oklch(0.65 0.20 25)" : "oklch(0.73 0.16 60)";

  const activeAlerts = (alerts ?? []).filter((a) => !a.dismissed);
  const highAlerts = activeAlerts.filter((a) => a.priority === "HIGH");

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Carregando dados financeiros...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold gradient-text">Dashboard Financeiro</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Visão consolidada das suas finanças</p>
        </div>
        <MonthSelector year={year} month={month} onChange={(y, m) => { setYear(y); setMonth(m); }} />
      </div>

      {/* Alertas críticos */}
      {highAlerts.length > 0 && (
        <div className="rounded-xl border border-red-500/30 p-4"
          style={{ background: "oklch(0.55 0.22 25 / 0.1)" }}>
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-red-400 mb-1">
                {highAlerts.length} alerta(s) crítico(s) este mês
              </p>
              {highAlerts.slice(0, 2).map((a) => (
                <p key={a.id} className="text-xs text-muted-foreground">{a.message}</p>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Métricas principais */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard
          title="Total de Entradas"
          value={formatCurrency(summary?.totalIn ?? 0)}
          subtitle={summary?.carryOver ? `Inclui sobra de ${formatCurrency(summary.carryOver)}` : "Receitas do mês"}
          icon={TrendingUp}
          color="oklch(0.68 0.18 155)"
        />
        <MetricCard
          title="Total de Saídas"
          value={formatCurrency(summary?.totalOut ?? 0)}
          subtitle={`Fixos: ${formatCurrency(summary?.fixedTotal ?? 0)} · Cartão: ${formatCurrency(summary?.cardTotal ?? 0)}`}
          icon={TrendingDown}
          color="oklch(0.65 0.20 25)"
        />
        <MetricCard
          title="Saldo Livre"
          value={formatCurrency(balance)}
          subtitle={`Status: ${balanceStatus}`}
          icon={Wallet}
          color={balanceColor}
        />
        <Card className="metric-card border-border/40 overflow-hidden">
          <CardContent className="p-5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Status do Mês</p>
            <div className="flex items-center gap-2 mb-3">
              <span className={`text-2xl font-bold ${balance >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {balanceStatus}
              </span>
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Gastos fixos</span>
                <span>{summary?.paidFixedCount ?? 0}/{(summary?.paidFixedCount ?? 0) + (summary?.unpaidFixedCount ?? 0)} pagos</span>
              </div>
              <Progress
                value={summary ? calcPct(summary.paidFixedCount, summary.paidFixedCount + summary.unpaidFixedCount) : 0}
                className="h-1.5"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Evolução de saldo */}
        <Card className="metric-card border-border/40">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-foreground">Evolução do Saldo (6 meses)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={history ?? []} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                <defs>
                  <linearGradient id="colorIn" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="oklch(0.68 0.18 155)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="oklch(0.68 0.18 155)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorOut" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="oklch(0.65 0.20 25)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="oklch(0.65 0.20 25)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.25 0.04 220 / 0.5)" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "oklch(0.58 0.015 220)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "oklch(0.58 0.015 220)" }} axisLine={false} tickLine={false}
                  tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ background: "oklch(0.15 0.03 220)", border: "1px solid oklch(0.28 0.05 220)", borderRadius: "8px", fontSize: "12px" }}
                  formatter={(v: number) => formatCurrency(v)}
                />
                <Area type="monotone" dataKey="totalIn" stroke="oklch(0.68 0.18 155)" fill="url(#colorIn)" strokeWidth={2} name="Entradas" />
                <Area type="monotone" dataKey="totalOut" stroke="oklch(0.65 0.20 25)" fill="url(#colorOut)" strokeWidth={2} name="Saídas" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Distribuição por categoria */}
        <Card className="metric-card border-border/40">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-foreground">Gastos por Categoria</CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                    dataKey="value" nameKey="name" paddingAngle={3}>
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: "oklch(0.15 0.03 220)", border: "1px solid oklch(0.28 0.05 220)", borderRadius: "8px", fontSize: "12px" }}
                    formatter={(v: number) => formatCurrency(v)}
                  />
                  <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize: "11px", color: "oklch(0.58 0.015 220)" }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
                Nenhum gasto registrado neste mês
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Projeção próximos meses */}
      {summary && summary.nextMonthsProjection.length > 0 && (
        <Card className="metric-card border-border/40">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-foreground">Comprometido nos Próximos Meses</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={summary.nextMonthsProjection} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.25 0.04 220 / 0.5)" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "oklch(0.58 0.015 220)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "oklch(0.58 0.015 220)" }} axisLine={false} tickLine={false}
                  tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ background: "oklch(0.15 0.03 220)", border: "1px solid oklch(0.28 0.05 220)", borderRadius: "8px", fontSize: "12px" }}
                  formatter={(v: number) => formatCurrency(v)}
                />
                <Bar dataKey="fixedCommitted" name="Fixos" fill="oklch(0.52 0.15 195)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="cardCommitted" name="Cartão" fill="oklch(0.65 0.18 35)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Resumo gastos fixos + cartões */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Gastos fixos */}
        <Card className="metric-card border-border/40">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Wallet className="h-4 w-4 text-primary" />
              Gastos Fixos do Mês
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Total</span>
              <span className="font-bold text-foreground">{formatCurrency(summary?.fixedTotal ?? 0)}</span>
            </div>
            <div className="flex gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-muted-foreground">{summary?.paidFixedCount ?? 0} pagos</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-amber-400" />
                <span className="text-muted-foreground">{summary?.unpaidFixedCount ?? 0} pendentes</span>
              </div>
            </div>
            {(summary?.unpaidFixed ?? []).slice(0, 3).map((fe) => (
              <div key={fe.id} className="flex items-center justify-between text-xs p-2 rounded-lg"
                style={{ background: "oklch(0.73 0.16 60 / 0.08)", border: "1px solid oklch(0.73 0.16 60 / 0.2)" }}>
                <span className="text-foreground">{fe.name}</span>
                <span className="font-medium text-amber-400">{formatCurrency(fe.value)}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Cartões */}
        <Card className="metric-card border-border/40">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-primary" />
              Cartões de Crédito
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Fatura atual</span>
              <span className="font-bold text-foreground">{formatCurrency(summary?.cardTotal ?? 0)}</span>
            </div>
            {summary && summary.nextMonthsProjection[0] && (
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Comprometido próx. mês</span>
                <span className="text-sm font-medium text-amber-400">
                  {formatCurrency(summary.nextMonthsProjection[0].cardCommitted)}
                </span>
              </div>
            )}
            {(summary?.installments ?? []).slice(0, 3).map((inst) => (
              <div key={inst.id} className="flex items-center justify-between text-xs p-2 rounded-lg"
                style={{ background: "oklch(0.52 0.15 195 / 0.08)", border: "1px solid oklch(0.52 0.15 195 / 0.2)" }}>
                <span className="text-foreground truncate max-w-32">{inst.description}</span>
                <span className="font-medium text-teal-400 shrink-0 ml-2">
                  {inst.currentInstallment}/{inst.totalInstallments}x · {formatCurrency(inst.installmentValue)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function calcPct(a: number, b: number) {
  if (b === 0) return 0;
  return Math.round((a / b) * 100);
}
