import { trpc } from "@/lib/trpc";
import { formatCurrency, currentYYYYMM, prevMonth, nextMonth, formatMonthFull, currentYearMonth } from "@/lib/format";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ChevronLeft, ChevronRight, Plus, Pencil, Trash2, CheckCircle, Clock, Wallet } from "lucide-react";
import { toast } from "sonner";

type FEForm = {
  name: string; value: string; dueDay: string;
  categoryId: string; startDate: string; endDate: string;
};
const emptyForm: FEForm = {
  name: "", value: "", dueDay: "1",
  categoryId: "", startDate: new Date().toISOString().split("T")[0].slice(0, 7) + "-01", endDate: "",
};

export default function FixedExpenses() {
  const { year: cy, month: cm } = currentYearMonth();
  const [year, setYear] = useState(cy);
  const [month, setMonth] = useState(cm);
  const refMonth = `${year}-${String(month).padStart(2, "0")}`;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<FEForm>(emptyForm);

  const utils = trpc.useUtils();
  const { data: expenses = [], isLoading } = trpc.fixedExpenses.list.useQuery();
  const { data: payments = [] } = trpc.fixedExpenses.getPayments.useQuery({ referenceMonth: refMonth });
  const { data: categories = [] } = trpc.transactions.listCategories.useQuery();

  const paidSet = new Set(payments.filter((p) => p.paid).map((p) => p.fixedExpenseId));
  const catMap = Object.fromEntries(categories.map((c) => [c.id, c.name]));

  const activeExpenses = expenses.filter((e) => !e.deletedAt && e.active);
  const totalActive = activeExpenses.reduce((s, e) => s + parseFloat(String(e.value)), 0);
  const paidCount = activeExpenses.filter((e) => paidSet.has(e.id)).length;

  const createMut = trpc.fixedExpenses.create.useMutation({
    onSuccess: () => { utils.fixedExpenses.list.invalidate(); toast.success("Gasto fixo criado!"); setDialogOpen(false); setForm(emptyForm); },
    onError: (e) => toast.error(e.message),
  });
  const updateMut = trpc.fixedExpenses.update.useMutation({
    onSuccess: () => { utils.fixedExpenses.list.invalidate(); toast.success("Gasto fixo atualizado!"); setDialogOpen(false); setEditId(null); setForm(emptyForm); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMut = trpc.fixedExpenses.delete.useMutation({
    onSuccess: () => { utils.fixedExpenses.list.invalidate(); toast.success("Gasto fixo excluído!"); },
    onError: (e) => toast.error(e.message),
  });
  const togglePaymentMut = trpc.fixedExpenses.togglePayment.useMutation({
    onSuccess: () => { utils.fixedExpenses.getPayments.invalidate(); utils.dashboard.summary.invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const toggleActiveMut = trpc.fixedExpenses.update.useMutation({
    onSuccess: () => { utils.fixedExpenses.list.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  function openCreate() { setEditId(null); setForm(emptyForm); setDialogOpen(true); }
  function openEdit(fe: typeof expenses[0]) {
    setEditId(fe.id);
    setForm({
      name: fe.name, value: String(parseFloat(String(fe.value))),
      dueDay: String(fe.dueDay), categoryId: fe.categoryId ? String(fe.categoryId) : "",
      startDate: String(fe.startDate).split("T")[0], endDate: fe.endDate ? String(fe.endDate).split("T")[0] : "",
    });
    setDialogOpen(true);
  }

  function handleSubmit() {
    if (!form.name || !form.value || !form.dueDay) return toast.error("Preencha todos os campos obrigatórios.");
    const payload = {
      name: form.name, value: parseFloat(form.value), dueDay: parseInt(form.dueDay),
      categoryId: form.categoryId ? parseInt(form.categoryId) : undefined,
      startDate: form.startDate, endDate: form.endDate || undefined,
    };
    if (editId) updateMut.mutate({ id: editId, ...payload });
    else createMut.mutate(payload);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold gradient-text">Gastos Fixos</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Despesas recorrentes mensais</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { const p = prevMonth(year, month); setYear(p.year); setMonth(p.month); }}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-semibold min-w-36 text-center capitalize">{formatMonthFull(year, month)}</span>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { const n = nextMonth(year, month); setYear(n.year); setMonth(n.month); }}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button onClick={openCreate} size="sm" className="ml-2 glow-orange" style={{ background: "linear-gradient(135deg, oklch(0.65 0.18 35), oklch(0.58 0.20 28))" }}>
            <Plus className="h-4 w-4 mr-1" /> Novo Fixo
          </Button>
        </div>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="metric-card border-border/40">
          <CardContent className="p-4 flex items-center gap-3">
            <Wallet className="h-5 w-5 text-primary shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Total mensal</p>
              <p className="font-bold text-foreground font-tabular">{formatCurrency(totalActive)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="metric-card border-border/40">
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-emerald-400 shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Pagos</p>
              <p className="font-bold text-emerald-400">{paidCount} de {activeExpenses.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="metric-card border-border/40">
          <CardContent className="p-4 flex items-center gap-3">
            <Clock className="h-5 w-5 text-amber-400 shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Pendentes</p>
              <p className="font-bold text-amber-400">{activeExpenses.length - paidCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lista */}
      <Card className="metric-card border-border/40">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-foreground">Gastos Fixos Ativos</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground text-sm">Carregando...</div>
          ) : expenses.filter((e) => !e.deletedAt).length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              Nenhum gasto fixo cadastrado.
            </div>
          ) : (
            <div className="divide-y divide-border/30">
              {expenses.filter((e) => !e.deletedAt).map((fe) => {
                const isPaid = paidSet.has(fe.id);
                return (
                  <div key={fe.id} className={`flex items-center gap-3 px-4 py-3 transition-colors ${!fe.active ? "opacity-50" : "hover:bg-white/3"}`}>
                    {/* Toggle pago */}
                    <button
                      onClick={() => togglePaymentMut.mutate({ fixedExpenseId: fe.id, referenceMonth: refMonth, paid: !isPaid })}
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-all ${
                        isPaid ? "bg-emerald-500/20 text-emerald-400" : "bg-border/30 text-muted-foreground hover:bg-amber-500/20 hover:text-amber-400"
                      }`}
                      title={isPaid ? "Marcar como não pago" : "Marcar como pago"}
                    >
                      {isPaid ? <CheckCircle className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                    </button>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={`text-sm font-medium truncate ${isPaid ? "line-through text-muted-foreground" : "text-foreground"}`}>
                          {fe.name}
                        </p>
                        {!fe.active && <Badge variant="outline" className="text-xs h-4 px-1.5 border-border/40">Inativo</Badge>}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-muted-foreground">Vence dia {fe.dueDay}</span>
                        {fe.categoryId && (
                          <Badge variant="outline" className="text-xs h-4 px-1.5 border-border/40">{catMap[fe.categoryId]}</Badge>
                        )}
                      </div>
                    </div>

                    <span className={`font-bold font-tabular text-sm shrink-0 ${isPaid ? "text-muted-foreground" : "text-foreground"}`}>
                      {formatCurrency(fe.value)}
                    </span>

                    <div className="flex items-center gap-1 shrink-0">
                      <Switch
                        checked={fe.active}
                        onCheckedChange={(v) => toggleActiveMut.mutate({ id: fe.id, active: v })}
                        className="scale-75"
                      />
                      <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-white/10" onClick={() => openEdit(fe)}>
                        <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-red-500/10"
                        onClick={() => { if (confirm("Excluir este gasto fixo?")) deleteMut.mutate({ id: fe.id }); }}>
                        <Trash2 className="h-3.5 w-3.5 text-red-400" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) { setEditId(null); setForm(emptyForm); } }}>
        <DialogContent className="sm:max-w-md" style={{ background: "oklch(0.14 0.028 220)", border: "1px solid oklch(0.28 0.05 220)" }}>
          <DialogHeader>
            <DialogTitle className="gradient-text">{editId ? "Editar Gasto Fixo" : "Novo Gasto Fixo"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="fe-name">Nome *</Label>
              <Input id="fe-name" placeholder="Ex: Aluguel, Netflix, Academia" value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="fe-value">Valor (R$) *</Label>
                <Input id="fe-value" type="number" step="0.01" placeholder="0,00" value={form.value}
                  onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="fe-day">Dia de Vencimento *</Label>
                <Input id="fe-day" type="number" min="1" max="31" placeholder="1-31" value={form.dueDay}
                  onChange={(e) => setForm((f) => ({ ...f, dueDay: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fe-cat">Categoria</Label>
              <Select value={form.categoryId} onValueChange={(v) => setForm((f) => ({ ...f, categoryId: v }))}>
                <SelectTrigger id="fe-cat"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {categories.filter((c) => c.type === "SAIDA" || c.type === "AMBOS").map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="fe-start">Início da vigência</Label>
                <Input id="fe-start" type="date" value={form.startDate}
                  onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="fe-end">Fim da vigência</Label>
                <Input id="fe-end" type="date" value={form.endDate}
                  onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={createMut.isPending || updateMut.isPending}
              style={{ background: "linear-gradient(135deg, oklch(0.65 0.18 35), oklch(0.58 0.20 28))" }}>
              {editId ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
