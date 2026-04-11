import { trpc } from "@/lib/trpc";
import { formatCurrency, formatDate, currentYearMonth, prevMonth, nextMonth, formatMonthFull } from "@/lib/format";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Plus, Pencil, Trash2, TrendingUp, TrendingDown, Wallet } from "lucide-react";
import { toast } from "sonner";

type TransactionForm = {
  type: "ENTRADA" | "SAIDA";
  value: string;
  date: string;
  categoryId: string;
  description: string;
};

const emptyForm: TransactionForm = {
  type: "SAIDA",
  value: "",
  date: new Date().toISOString().split("T")[0],
  categoryId: "",
  description: "",
};

export default function Transactions() {
  const { year: cy, month: cm } = currentYearMonth();
  const [year, setYear] = useState(cy);
  const [month, setMonth] = useState(cm);
  const [filterType, setFilterType] = useState<"ALL" | "ENTRADA" | "SAIDA">("ALL");
  const [filterCategory, setFilterCategory] = useState<string>("ALL");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<TransactionForm>(emptyForm);

  const utils = trpc.useUtils();
  const { data: txs = [], isLoading } = trpc.transactions.listByMonth.useQuery({ year, month });
  const { data: categories = [] } = trpc.transactions.listCategories.useQuery();

  const createMut = trpc.transactions.create.useMutation({
    onSuccess: () => { utils.transactions.listByMonth.invalidate(); utils.dashboard.summary.invalidate(); toast.success("Transação criada!"); setDialogOpen(false); setForm(emptyForm); },
    onError: (e) => toast.error(e.message),
  });
  const updateMut = trpc.transactions.update.useMutation({
    onSuccess: () => { utils.transactions.listByMonth.invalidate(); utils.dashboard.summary.invalidate(); toast.success("Transação atualizada!"); setDialogOpen(false); setEditId(null); setForm(emptyForm); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMut = trpc.transactions.delete.useMutation({
    onSuccess: () => { utils.transactions.listByMonth.invalidate(); utils.dashboard.summary.invalidate(); toast.success("Transação excluída!"); },
    onError: (e) => toast.error(e.message),
  });

  const filtered = txs.filter((t) => {
    if (filterType !== "ALL" && t.type !== filterType) return false;
    if (filterCategory !== "ALL" && String(t.categoryId) !== filterCategory) return false;
    return true;
  });

  const totalIn = txs.filter((t) => t.type === "ENTRADA").reduce((s, t) => s + parseFloat(String(t.value)), 0);
  const totalOut = txs.filter((t) => t.type === "SAIDA").reduce((s, t) => s + parseFloat(String(t.value)), 0);

  const catMap = Object.fromEntries(categories.map((c) => [c.id, c.name]));

  function openCreate() {
    setEditId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(tx: typeof txs[0]) {
    setEditId(tx.id);
    setForm({
      type: tx.type,
      value: String(parseFloat(String(tx.value))),
      date: String(tx.date).split("T")[0],
      categoryId: tx.categoryId ? String(tx.categoryId) : "",
      description: tx.description ?? "",
    });
    setDialogOpen(true);
  }

  function handleSubmit() {
    if (!form.value || !form.date) return toast.error("Preencha valor e data.");
    const payload = {
      type: form.type,
      value: parseFloat(form.value),
      date: form.date,
      categoryId: form.categoryId ? parseInt(form.categoryId) : undefined,
      description: form.description || undefined,
    };
    if (editId) updateMut.mutate({ id: editId, ...payload });
    else createMut.mutate(payload);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold gradient-text">Entradas & Saídas</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Controle de todas as movimentações financeiras</p>
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
            <Plus className="h-4 w-4 mr-1" /> Nova Transação
          </Button>
        </div>
      </div>

      {/* Totalizadores */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="metric-card border-border/40">
          <CardContent className="p-4 flex items-center gap-3">
            <TrendingUp className="h-5 w-5 text-emerald-400 shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Entradas</p>
              <p className="font-bold text-emerald-400 font-tabular">{formatCurrency(totalIn)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="metric-card border-border/40">
          <CardContent className="p-4 flex items-center gap-3">
            <TrendingDown className="h-5 w-5 text-red-400 shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Saídas</p>
              <p className="font-bold text-red-400 font-tabular">{formatCurrency(totalOut)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="metric-card border-border/40">
          <CardContent className="p-4 flex items-center gap-3">
            <Wallet className="h-5 w-5 text-primary shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Saldo</p>
              <p className={`font-bold font-tabular ${totalIn - totalOut >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {formatCurrency(totalIn - totalOut)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        {(["ALL", "ENTRADA", "SAIDA"] as const).map((t) => (
          <Button key={t} variant={filterType === t ? "default" : "outline"} size="sm"
            onClick={() => setFilterType(t)}
            className={filterType === t ? "glow-orange" : "border-border/50"}
            style={filterType === t ? { background: "linear-gradient(135deg, oklch(0.65 0.18 35), oklch(0.58 0.20 28))" } : {}}>
            {t === "ALL" ? "Todos" : t === "ENTRADA" ? "Entradas" : "Saídas"}
          </Button>
        ))}
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-40 h-8 text-xs border-border/50">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todas as categorias</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Lista */}
      <Card className="metric-card border-border/40">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground text-sm">Carregando...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              Nenhuma transação encontrada neste período.
            </div>
          ) : (
            <div className="divide-y divide-border/30">
              {filtered.map((tx) => (
                <div key={tx.id} className="flex items-center gap-3 px-4 py-3 hover:bg-white/3 transition-colors">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    tx.type === "ENTRADA" ? "bg-emerald-500/15" : "bg-red-500/15"
                  }`}>
                    {tx.type === "ENTRADA"
                      ? <TrendingUp className="h-4 w-4 text-emerald-400" />
                      : <TrendingDown className="h-4 w-4 text-red-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {tx.description ?? catMap[tx.categoryId ?? 0] ?? "Sem descrição"}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-muted-foreground">{formatDate(String(tx.date))}</span>
                      {tx.categoryId && (
                        <Badge variant="outline" className="text-xs h-4 px-1.5 border-border/40">
                          {catMap[tx.categoryId]}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <span className={`font-bold font-tabular text-sm shrink-0 ${
                    tx.type === "ENTRADA" ? "text-emerald-400" : "text-red-400"
                  }`}>
                    {tx.type === "ENTRADA" ? "+" : "-"}{formatCurrency(tx.value)}
                  </span>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-white/10" onClick={() => openEdit(tx)}>
                      <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-red-500/10"
                      onClick={() => { if (confirm("Excluir esta transação?")) deleteMut.mutate({ id: tx.id }); }}>
                      <Trash2 className="h-3.5 w-3.5 text-red-400" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog criar/editar */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) { setEditId(null); setForm(emptyForm); } }}>
        <DialogContent className="sm:max-w-md" style={{ background: "oklch(0.14 0.028 220)", border: "1px solid oklch(0.28 0.05 220)" }}>
          <DialogHeader>
            <DialogTitle className="gradient-text">{editId ? "Editar Transação" : "Nova Transação"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              {(["ENTRADA", "SAIDA"] as const).map((t) => (
                <button key={t} onClick={() => setForm((f) => ({ ...f, type: t }))}
                  className={`p-3 rounded-xl border text-sm font-medium transition-all ${
                    form.type === t
                      ? t === "ENTRADA" ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-400" : "border-red-500/50 bg-red-500/15 text-red-400"
                      : "border-border/40 text-muted-foreground hover:border-border"
                  }`}>
                  {t === "ENTRADA" ? "Entrada" : "Saída"}
                </button>
              ))}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tx-value">Valor (R$)</Label>
              <Input id="tx-value" type="number" step="0.01" placeholder="0,00" value={form.value}
                onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tx-date">Data</Label>
              <Input id="tx-date" type="date" value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tx-cat">Categoria</Label>
              <Select value={form.categoryId} onValueChange={(v) => setForm((f) => ({ ...f, categoryId: v }))}>
                <SelectTrigger id="tx-cat"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {categories.filter((c) => c.type === form.type || c.type === "AMBOS").map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tx-desc">Descrição (opcional)</Label>
              <Input id="tx-desc" placeholder="Ex: Supermercado Extra" value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
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
