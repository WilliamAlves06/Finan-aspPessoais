import { trpc } from "@/lib/trpc";
import { formatCurrency, formatDate, calcPercent } from "@/lib/format";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Target, TrendingUp, CheckCircle, PlusCircle, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";

type GoalForm = { name: string; targetValue: string; initialAmount: string; priority: string; targetDate: string };
const emptyGoalForm: GoalForm = { name: "", targetValue: "", initialAmount: "0", priority: "3", targetDate: "" };

type ContribForm = { value: string; date: string; note: string };
const emptyContribForm: ContribForm = { value: "", date: new Date().toISOString().split("T")[0], note: "" };

export default function Goals() {
  const [goalDialogOpen, setGoalDialogOpen] = useState(false);
  const [contribDialogOpen, setContribDialogOpen] = useState(false);
  const [selectedGoalId, setSelectedGoalId] = useState<number | null>(null);
  const [goalForm, setGoalForm] = useState<GoalForm>(emptyGoalForm);
  const [contribForm, setContribForm] = useState<ContribForm>(emptyContribForm);
  const [expandedGoal, setExpandedGoal] = useState<number | null>(null);

  const utils = trpc.useUtils();
  const { data: goals = [], isLoading } = trpc.goals.list.useQuery();
  const { data: contributions = [] } = trpc.goals.getContributions.useQuery(
    { goalId: expandedGoal! },
    { enabled: expandedGoal !== null }
  );

  const createGoalMut = trpc.goals.create.useMutation({
    onSuccess: () => { utils.goals.list.invalidate(); toast.success("Meta criada!"); setGoalDialogOpen(false); setGoalForm(emptyGoalForm); },
    onError: (e) => toast.error(e.message),
  });
  const deleteGoalMut = trpc.goals.delete.useMutation({
    onSuccess: () => { utils.goals.list.invalidate(); toast.success("Meta excluída!"); },
    onError: (e) => toast.error(e.message),
  });
  const completeGoalMut = trpc.goals.update.useMutation({
    onSuccess: () => { utils.goals.list.invalidate(); toast.success("Meta marcada como concluída!"); },
    onError: (e) => toast.error(e.message),
  });
  const addContribMut = trpc.goals.addContribution.useMutation({
    onSuccess: () => {
      utils.goals.list.invalidate();
      utils.goals.getContributions.invalidate({ goalId: selectedGoalId! });
      toast.success("Aporte registrado!");
      setContribDialogOpen(false);
      setContribForm(emptyContribForm);
    },
    onError: (e) => toast.error(e.message),
  });

  const totalTarget = goals.reduce((s, g) => s + parseFloat(String(g.targetValue)), 0);
  const totalAccumulated = goals.reduce((s, g) => s + parseFloat(String(g.accumulatedValue)), 0);
  const activeGoals = goals.filter((g) => !g.completed);
  const completedGoals = goals.filter((g) => g.completed);

  const PRIORITY_LABELS: Record<number, string> = { 1: "Muito Baixa", 2: "Baixa", 3: "Média", 4: "Alta", 5: "Urgente" };
  const PRIORITY_COLORS: Record<number, string> = {
    1: "oklch(0.58 0.015 220)", 2: "oklch(0.68 0.14 155)", 3: "oklch(0.73 0.16 60)",
    4: "oklch(0.65 0.18 35)", 5: "oklch(0.55 0.22 25)",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold gradient-text">Grandes Compras</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Planejamento e metas de médio/longo prazo</p>
        </div>
        <Button onClick={() => setGoalDialogOpen(true)} size="sm" className="glow-orange"
          style={{ background: "linear-gradient(135deg, oklch(0.65 0.18 35), oklch(0.58 0.20 28))" }}>
          <Plus className="h-4 w-4 mr-1" /> Nova Meta
        </Button>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="metric-card border-border/40">
          <CardContent className="p-4 flex items-center gap-3">
            <Target className="h-5 w-5 text-primary shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Metas ativas</p>
              <p className="font-bold text-foreground">{activeGoals.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="metric-card border-border/40">
          <CardContent className="p-4 flex items-center gap-3">
            <TrendingUp className="h-5 w-5 text-emerald-400 shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Acumulado</p>
              <p className="font-bold text-emerald-400 font-tabular">{formatCurrency(totalAccumulated)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="metric-card border-border/40">
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-teal-400 shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Concluídas</p>
              <p className="font-bold text-teal-400">{completedGoals.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Metas ativas */}
      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground text-sm">Carregando...</div>
      ) : activeGoals.length === 0 ? (
        <Card className="metric-card border-border/40">
          <CardContent className="p-8 text-center text-muted-foreground text-sm">
            Nenhuma meta ativa. Crie sua primeira grande compra!
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {activeGoals.sort((a, b) => (b.priority ?? 3) - (a.priority ?? 3)).map((goal) => {
            const target = parseFloat(String(goal.targetValue));
            const accumulated = parseFloat(String(goal.accumulatedValue));
            const pct = calcPercent(accumulated, target);
            const remaining = target - accumulated;
            const isExpanded = expandedGoal === goal.id;
            const monthsLeft = (goal as any).monthsToComplete;
            const avgMonthly = (goal as any).avgMonthlyContribution;

            return (
              <Card key={goal.id} className="metric-card border-border/40 overflow-hidden">
                <div className="h-1" style={{ background: `linear-gradient(90deg, ${PRIORITY_COLORS[goal.priority ?? 3]}, transparent)` }} />
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-foreground">{goal.name}</h3>
                        <Badge variant="outline" className="text-xs border-border/40"
                          style={{ color: PRIORITY_COLORS[goal.priority ?? 3] }}>
                          {PRIORITY_LABELS[goal.priority ?? 3]}
                        </Badge>
                        {goal.targetDate && (
                          <Badge variant="outline" className="text-xs border-border/40">
                            Prazo: {formatDate(String(goal.targetDate))}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span>{formatCurrency(accumulated)} de {formatCurrency(target)}</span>
                        {monthsLeft && <span>· ~{monthsLeft} meses para concluir</span>}
                        {avgMonthly > 0 && <span>· Média: {formatCurrency(avgMonthly)}/mês</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-emerald-500/10"
                        onClick={() => { setSelectedGoalId(goal.id); setContribDialogOpen(true); }}
                        title="Adicionar aporte">
                        <PlusCircle className="h-4 w-4 text-emerald-400" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-teal-500/10"
                        onClick={() => completeGoalMut.mutate({ id: goal.id, completed: true })}
                        title="Marcar como concluída">
                        <CheckCircle className="h-4 w-4 text-teal-400" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-red-500/10"
                        onClick={() => { if (confirm("Excluir esta meta?")) deleteGoalMut.mutate({ id: goal.id }); }}>
                        <Trash2 className="h-3.5 w-3.5 text-red-400" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7"
                        onClick={() => {
                          setExpandedGoal(isExpanded ? null : goal.id);
                        }}>
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  {/* Barra de progresso */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{pct}% concluído</span>
                      <span className="text-muted-foreground">Faltam {formatCurrency(remaining)}</span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: "oklch(0.20 0.03 220)" }}>
                      <div className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(pct, 100)}%`,
                          background: `linear-gradient(90deg, ${PRIORITY_COLORS[goal.priority ?? 3]}, oklch(0.52 0.15 195))`,
                        }} />
                    </div>
                  </div>

                  {/* Sugestão de aporte */}
                  {remaining > 0 && goal.targetDate && (
                    <div className="text-xs p-2 rounded-lg" style={{ background: "oklch(0.52 0.15 195 / 0.08)", border: "1px solid oklch(0.52 0.15 195 / 0.2)" }}>
                      <span className="text-muted-foreground">Sugestão de aporte mensal: </span>
                      <span className="font-bold text-teal-400">
                        {formatCurrency(calcSuggestedMonthly(remaining, String(goal.targetDate)))}
                      </span>
                    </div>
                  )}

                  {/* Histórico de aportes */}
                  {isExpanded && (
                    <div className="space-y-2 pt-2 border-t border-border/30">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Histórico de Aportes</p>
                      {contributions.length === 0 ? (
                        <p className="text-xs text-muted-foreground">Nenhum aporte registrado.</p>
                      ) : (
                        <div className="space-y-1.5 max-h-40 overflow-y-auto">
                          {contributions.map((c) => (
                            <div key={c.id} className="flex items-center justify-between text-xs p-2 rounded-lg"
                              style={{ background: "oklch(0.18 0.03 220)" }}>
                              <div>
                                <span className="text-foreground font-medium">{formatCurrency(c.value)}</span>
                                {c.note && <span className="text-muted-foreground ml-2">— {c.note}</span>}
                              </div>
                              <span className="text-muted-foreground">{formatDate(String(c.date))}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Metas concluídas */}
      {completedGoals.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Concluídas</h2>
          {completedGoals.map((goal) => (
            <Card key={goal.id} className="border-border/30 opacity-60">
              <CardContent className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-400" />
                  <span className="text-sm text-foreground">{goal.name}</span>
                </div>
                <span className="text-sm font-tabular text-muted-foreground">{formatCurrency(goal.targetValue)}</span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog: Nova Meta */}
      <Dialog open={goalDialogOpen} onOpenChange={setGoalDialogOpen}>
        <DialogContent className="sm:max-w-md" style={{ background: "oklch(0.14 0.028 220)", border: "1px solid oklch(0.28 0.05 220)" }}>
          <DialogHeader>
            <DialogTitle className="gradient-text">Nova Meta</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Nome da Meta *</Label>
              <Input placeholder="Ex: Viagem Europa, iPhone, Carro" value={goalForm.name}
                onChange={(e) => setGoalForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Valor Total (R$) *</Label>
                <Input type="number" step="0.01" placeholder="0,00" value={goalForm.targetValue}
                  onChange={(e) => setGoalForm((f) => ({ ...f, targetValue: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Já tenho (R$)</Label>
                <Input type="number" step="0.01" placeholder="0,00" value={goalForm.initialAmount}
                  onChange={(e) => setGoalForm((f) => ({ ...f, initialAmount: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Prioridade (1-5)</Label>
                <Input type="number" min="1" max="5" value={goalForm.priority}
                  onChange={(e) => setGoalForm((f) => ({ ...f, priority: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Prazo (data)</Label>
                <Input type="date" value={goalForm.targetDate}
                  onChange={(e) => setGoalForm((f) => ({ ...f, targetDate: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGoalDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => {
              if (!goalForm.name || !goalForm.targetValue) return toast.error("Preencha nome e valor.");
              createGoalMut.mutate({
                name: goalForm.name, targetValue: parseFloat(goalForm.targetValue),
                initialAmount: parseFloat(goalForm.initialAmount) || 0,
                priority: parseInt(goalForm.priority) || 3,
                targetDate: goalForm.targetDate || undefined,
              });
            }} style={{ background: "linear-gradient(135deg, oklch(0.65 0.18 35), oklch(0.58 0.20 28))" }}>
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Aporte */}
      <Dialog open={contribDialogOpen} onOpenChange={setContribDialogOpen}>
        <DialogContent className="sm:max-w-sm" style={{ background: "oklch(0.14 0.028 220)", border: "1px solid oklch(0.28 0.05 220)" }}>
          <DialogHeader>
            <DialogTitle className="gradient-text">Registrar Aporte</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Valor (R$) *</Label>
              <Input type="number" step="0.01" placeholder="0,00" value={contribForm.value}
                onChange={(e) => setContribForm((f) => ({ ...f, value: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Data</Label>
              <Input type="date" value={contribForm.date}
                onChange={(e) => setContribForm((f) => ({ ...f, date: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Observação</Label>
              <Input placeholder="Ex: Bônus de trabalho" value={contribForm.note}
                onChange={(e) => setContribForm((f) => ({ ...f, note: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setContribDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => {
              if (!contribForm.value || !selectedGoalId) return toast.error("Informe o valor.");
              addContribMut.mutate({ goalId: selectedGoalId, value: parseFloat(contribForm.value), date: contribForm.date, note: contribForm.note || undefined });
            }} style={{ background: "linear-gradient(135deg, oklch(0.65 0.18 35), oklch(0.58 0.20 28))" }}>
              Registrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function calcSuggestedMonthly(remaining: number, targetDate: string): number {
  const target = new Date(targetDate);
  const now = new Date();
  const months = Math.max(1, (target.getFullYear() - now.getFullYear()) * 12 + (target.getMonth() - now.getMonth()));
  return Math.ceil(remaining / months);
}
