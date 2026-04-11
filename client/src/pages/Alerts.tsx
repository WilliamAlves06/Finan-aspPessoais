import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Bell, CheckCircle, Info, RefreshCw, X, Zap } from "lucide-react";
import { toast } from "sonner";
import { currentYearMonth } from "@/lib/format";

const ALERT_TYPE_LABELS: Record<string, string> = {
  NEGATIVE_BALANCE: "Saldo Negativo",
  LOW_BALANCE: "Saldo Baixo",
  FIXED_DUE_SOON: "Fixo Vencendo",
  HIGH_INSTALLMENTS: "Parcelas Altas",
  GOAL_NO_CONTRIBUTION: "Meta sem Aporte",
  CARD_DUE_SOON: "Cartão Vencendo",
};

const ALERT_ICONS: Record<string, React.ElementType> = {
  NEGATIVE_BALANCE: AlertTriangle,
  LOW_BALANCE: AlertTriangle,
  FIXED_DUE_SOON: Bell,
  HIGH_INSTALLMENTS: Zap,
  GOAL_NO_CONTRIBUTION: Info,
  CARD_DUE_SOON: Bell,
};

const PRIORITY_STYLES: Record<string, { border: string; bg: string; text: string; badge: string }> = {
  HIGH: {
    border: "border-red-500/30",
    bg: "oklch(0.55 0.22 25 / 0.08)",
    text: "text-red-400",
    badge: "oklch(0.55 0.22 25)",
  },
  MEDIUM: {
    border: "border-amber-500/30",
    bg: "oklch(0.73 0.16 60 / 0.08)",
    text: "text-amber-400",
    badge: "oklch(0.73 0.16 60)",
  },
  LOW: {
    border: "border-teal-500/30",
    bg: "oklch(0.52 0.15 195 / 0.08)",
    text: "text-teal-400",
    badge: "oklch(0.52 0.15 195)",
  },
};

export default function Alerts() {
  const { year, month } = currentYearMonth();
  const [showDismissed, setShowDismissed] = useState(false);

  const utils = trpc.useUtils();
  const { data: alerts = [], isLoading, refetch } = trpc.dashboard.getAlerts.useQuery();
  const generateMut = trpc.dashboard.generateAlerts.useMutation({
    onSuccess: (data) => {
      utils.dashboard.getAlerts.invalidate();
      toast.success(`${data.generated} alerta(s) gerado(s) e verificados.`);
    },
    onError: (e) => toast.error(e.message),
  });
  const dismissMut = trpc.dashboard.dismissAlert.useMutation({
    onSuccess: () => { utils.dashboard.getAlerts.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const activeAlerts = alerts.filter((a) => !a.dismissed);
  const dismissedAlerts = alerts.filter((a) => a.dismissed);

  const highCount = activeAlerts.filter((a) => a.priority === "HIGH").length;
  const mediumCount = activeAlerts.filter((a) => a.priority === "MEDIUM").length;
  const lowCount = activeAlerts.filter((a) => a.priority === "LOW").length;

  const displayAlerts = showDismissed ? alerts : activeAlerts;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold gradient-text">Central de Alertas</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Monitoramento automático das suas finanças</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="border-border/50"
            onClick={() => setShowDismissed((v) => !v)}>
            {showDismissed ? "Ocultar dispensados" : "Ver dispensados"}
          </Button>
          <Button size="sm" onClick={() => generateMut.mutate({ year, month })}
            disabled={generateMut.isPending}
            className="glow-orange"
            style={{ background: "linear-gradient(135deg, oklch(0.65 0.18 35), oklch(0.58 0.20 28))" }}>
            <RefreshCw className={`h-4 w-4 mr-1 ${generateMut.isPending ? "animate-spin" : ""}`} />
            Verificar Alertas
          </Button>
        </div>
      </div>

      {/* Contadores */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="metric-card border-red-500/20">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-red-400 shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Críticos</p>
              <p className="font-bold text-red-400 text-xl">{highCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="metric-card border-amber-500/20">
          <CardContent className="p-4 flex items-center gap-3">
            <Bell className="h-5 w-5 text-amber-400 shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Atenção</p>
              <p className="font-bold text-amber-400 text-xl">{mediumCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="metric-card border-teal-500/20">
          <CardContent className="p-4 flex items-center gap-3">
            <Info className="h-5 w-5 text-teal-400 shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Informativos</p>
              <p className="font-bold text-teal-400 text-xl">{lowCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lista de alertas */}
      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground text-sm">Carregando...</div>
      ) : displayAlerts.length === 0 ? (
        <Card className="metric-card border-border/40">
          <CardContent className="p-8 flex flex-col items-center gap-3 text-center">
            <CheckCircle className="h-10 w-10 text-emerald-400" />
            <p className="font-semibold text-foreground">Tudo certo!</p>
            <p className="text-sm text-muted-foreground">Nenhum alerta ativo no momento. Suas finanças estão em ordem.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {/* Agrupa por prioridade */}
          {(["HIGH", "MEDIUM", "LOW"] as const).map((priority) => {
            const priorityAlerts = displayAlerts.filter((a) => a.priority === priority);
            if (priorityAlerts.length === 0) return null;
            const styles = PRIORITY_STYLES[priority];
            const priorityLabel = priority === "HIGH" ? "Críticos" : priority === "MEDIUM" ? "Atenção" : "Informativos";

            return (
              <div key={priority} className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: styles.text }}>
                  {priorityLabel} ({priorityAlerts.length})
                </h3>
                {priorityAlerts.map((alert) => {
                  const Icon = ALERT_ICONS[alert.type] ?? Bell;
                  return (
                    <div key={alert.id}
                      className={`flex items-start gap-3 p-4 rounded-xl border ${styles.border} ${alert.dismissed ? "opacity-50" : ""}`}
                      style={{ background: styles.bg }}>
                      <Icon className={`h-5 w-5 shrink-0 mt-0.5 ${styles.text}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <Badge variant="outline" className="text-xs border-border/40"
                            style={{ color: styles.badge, borderColor: `${styles.badge}/30` }}>
                            {ALERT_TYPE_LABELS[alert.type] ?? alert.type}
                          </Badge>
                          {alert.referenceMonth && (
                            <span className="text-xs text-muted-foreground">{alert.referenceMonth}</span>
                          )}
                          {alert.notificationSent && (
                            <Badge variant="outline" className="text-xs border-emerald-500/30 text-emerald-400">
                              Notificado
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-foreground">{alert.message}</p>
                      </div>
                      {!alert.dismissed && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-white/10 shrink-0"
                          onClick={() => dismissMut.mutate({ id: alert.id })}
                          title="Dispensar alerta">
                          <X className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {/* Info sobre notificações */}
      <Card className="metric-card border-border/40">
        <CardContent className="p-4 flex items-start gap-3">
          <Bell className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div className="text-sm text-muted-foreground">
            <p className="font-medium text-foreground mb-1">Notificações automáticas</p>
            <p>Alertas críticos são enviados automaticamente por email quando detectados. Você pode verificar manualmente a qualquer momento clicando em "Verificar Alertas".</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
