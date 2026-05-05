import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, RefreshCw, Brain, TrendingUp, Lightbulb, Target } from "lucide-react";
import { Streamdown } from "streamdown";
import { currentYearMonth } from "@/lib/format";

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export default function Insights() {
  const { year: cy, month: cm } = currentYearMonth();
  const [year, setYear] = useState(cy);
  const [month, setMonth] = useState(cm);
  const [insights, setInsights] = useState<string | null>(null);

  const generateMut = trpc.insights.generate.useMutation({
    onSuccess: (data) => setInsights(typeof data.insights === 'string' ? data.insights : String(data.insights)),
    onError: (e) => setInsights(`Erro ao gerar insights: ${e.message}`),
  });

  const currentYear = new Date().getFullYear();
  const years = [currentYear - 1, currentYear, currentYear + 1];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold gradient-text">Insights com IA</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Análise inteligente dos seus padrões financeiros</p>
        </div>
      </div>

      {/* Seletor de período + botão */}
      <Card className="metric-card border-border/40">
        <CardContent className="p-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary shrink-0" />
              <div>
                <p className="text-sm font-semibold text-foreground">Analisar período de referência</p>
                <p className="text-xs text-muted-foreground">A IA analisa os 3 meses anteriores ao mês selecionado</p>
              </div>
            </div>
            <div className="flex items-center gap-2 ml-auto flex-wrap">
              <Select value={String(month)} onValueChange={(v) => setMonth(parseInt(v))}>
                <SelectTrigger className="w-32 border-border/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m, i) => (
                    <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={String(year)} onValueChange={(v) => setYear(parseInt(v))}>
                <SelectTrigger className="w-24 border-border/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map((y) => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={() => generateMut.mutate({ year, month })}
                disabled={generateMut.isPending}
                className="glow-orange"
                style={{ background: "linear-gradient(135deg, oklch(0.65 0.18 35), oklch(0.55 0.15 195))" }}
              >
                {generateMut.isPending ? (
                  <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Analisando...</>
                ) : (
                  <><Sparkles className="h-4 w-4 mr-2" /> Gerar Insights</>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Features cards */}
      {!insights && !generateMut.isPending && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { icon: TrendingUp, title: "Padrões de Gastos", desc: "Identifica tendências e categorias que mais impactam seu orçamento", color: "oklch(0.65 0.18 35)" },
            { icon: Lightbulb, title: "Oportunidades de Economia", desc: "Sugere onde você pode reduzir gastos sem impactar sua qualidade de vida", color: "oklch(0.52 0.15 195)" },
            { icon: Target, title: "Progresso nas Metas", desc: "Avalia o ritmo de aportes e sugere ajustes para atingir seus objetivos", color: "oklch(0.68 0.14 155)" },
          ].map(({ icon: Icon, title, desc, color }) => (
            <Card key={title} className="metric-card border-border/40">
              <CardContent className="p-4 space-y-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: `${color}/15` }}>
                  <Icon className="h-5 w-5" style={{ color }} />
                </div>
                <div>
                  <p className="font-semibold text-foreground text-sm">{title}</p>
                  <p className="text-xs text-muted-foreground mt-1">{desc}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Loading state */}
      {generateMut.isPending && (
        <Card className="metric-card border-border/40">
          <CardContent className="p-8 flex flex-col items-center gap-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-full flex items-center justify-center glow-orange"
                style={{ background: "linear-gradient(135deg, oklch(0.65 0.18 35 / 0.2), oklch(0.52 0.15 195 / 0.2))" }}>
                <Brain className="h-8 w-8 text-primary animate-pulse" />
              </div>
            </div>
            <div className="text-center">
              <p className="font-semibold text-foreground">Analisando seus dados financeiros...</p>
              <p className="text-sm text-muted-foreground mt-1">
                A IA está processando suas transações dos últimos 3 meses. Isso pode levar alguns segundos.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Resultado */}
      {insights && !generateMut.isPending && (
        <Card className="metric-card border-border/40">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                Análise Financeira Personalizada
              </CardTitle>
              <Button variant="ghost" size="sm" className="text-xs text-muted-foreground"
                onClick={() => generateMut.mutate({ year, month })}>
                <RefreshCw className="h-3.5 w-3.5 mr-1" /> Atualizar
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="prose prose-invert prose-sm max-w-none"
              style={{
                "--tw-prose-body": "oklch(0.85 0.005 220)",
                "--tw-prose-headings": "oklch(0.95 0.005 220)",
                "--tw-prose-bold": "oklch(0.95 0.005 220)",
                "--tw-prose-links": "oklch(0.65 0.18 35)",
                "--tw-prose-bullets": "oklch(0.52 0.15 195)",
                "--tw-prose-hr": "oklch(0.25 0.04 220)",
                "--tw-prose-quotes": "oklch(0.65 0.18 35)",
              } as React.CSSProperties}>
              <Streamdown>{insights}</Streamdown>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Disclaimer */}
      <p className="text-xs text-muted-foreground text-center">
        Os insights são gerados por IA com base nos seus dados e têm caráter informativo. Consulte um profissional financeiro para decisões importantes.
      </p>
    </div>
  );
}
