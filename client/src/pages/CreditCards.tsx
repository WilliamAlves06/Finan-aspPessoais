import { trpc } from "@/lib/trpc";
import { formatCurrency, formatInstallments, currentYearMonth, prevMonth, nextMonth, formatMonthFull } from "@/lib/format";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronLeft, ChevronRight, Plus, Trash2, CreditCard, Calendar, Layers } from "lucide-react";
import { toast } from "sonner";

type CardForm = { name: string; limit: string; closingDay: string; dueDay: string };
const emptyCardForm: CardForm = { name: "", limit: "", closingDay: "20", dueDay: "27" };

type PurchaseForm = {
  cardId: string; description: string; totalValue: string;
  installments: string; firstInstallmentMonth: string; categoryId: string;
};
const emptyPurchaseForm: PurchaseForm = {
  cardId: "", description: "", totalValue: "", installments: "1",
  firstInstallmentMonth: (() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`; })(),
  categoryId: "",
};

export default function CreditCards() {
  const { year: cy, month: cm } = currentYearMonth();
  const [year, setYear] = useState(cy);
  const [month, setMonth] = useState(cm);
  const refMonth = `${year}-${String(month).padStart(2, "0")}`;

  const [cardDialogOpen, setCardDialogOpen] = useState(false);
  const [purchaseDialogOpen, setPurchaseDialogOpen] = useState(false);
  const [cardForm, setCardForm] = useState<CardForm>(emptyCardForm);
  const [purchaseForm, setPurchaseForm] = useState<PurchaseForm>(emptyPurchaseForm);

  const utils = trpc.useUtils();
  const { data: cards = [], isLoading } = trpc.creditCards.list.useQuery();
  const { data: monthInstallments = [] } = trpc.creditCards.getInstallmentsByMonth.useQuery({ referenceMonth: refMonth });
  const { data: categories = [] } = trpc.transactions.listCategories.useQuery();

  const catMap = Object.fromEntries(categories.map((c) => [c.id, c.name]));

  const createCardMut = trpc.creditCards.create.useMutation({
    onSuccess: () => { utils.creditCards.list.invalidate(); toast.success("Cartão criado!"); setCardDialogOpen(false); setCardForm(emptyCardForm); },
    onError: (e) => toast.error(e.message),
  });
  const deleteCardMut = trpc.creditCards.delete.useMutation({
    onSuccess: () => { utils.creditCards.list.invalidate(); toast.success("Cartão excluído!"); },
    onError: (e) => toast.error(e.message),
  });
  const addPurchaseMut = trpc.creditCards.addPurchase.useMutation({
    onSuccess: () => {
      utils.creditCards.getInstallmentsByMonth.invalidate();
      utils.dashboard.summary.invalidate();
      toast.success("Compra lançada!");
      setPurchaseDialogOpen(false);
      setPurchaseForm(emptyPurchaseForm);
    },
    onError: (e) => toast.error(e.message),
  });
  const deletePurchaseMut = trpc.creditCards.deletePurchase.useMutation({
    onSuccess: () => { utils.creditCards.getInstallmentsByMonth.invalidate(); toast.success("Compra excluída!"); },
    onError: (e) => toast.error(e.message),
  });

  // Agrupa parcelas por cartão
  const byCard = cards.map((card) => {
    const installs = monthInstallments.filter((i) => i.cardId === card.id);
    const total = installs.reduce((s, i) => s + parseFloat(String(i.installmentValue)), 0);
    return { card, installs, total };
  });

  const grandTotal = monthInstallments.reduce((s, i) => s + parseFloat(String(i.installmentValue)), 0);

  // Agrupa por purchaseGroupId para exibição
  const purchaseGroups = monthInstallments.reduce<Record<string, typeof monthInstallments>>((acc, inst) => {
    const key = inst.purchaseGroupId ?? String(inst.id);
    if (!acc[key]) acc[key] = [];
    acc[key].push(inst);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold gradient-text">Cartões de Crédito</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Compras parceladas e faturas mensais</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { const p = prevMonth(year, month); setYear(p.year); setMonth(p.month); }}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-semibold min-w-36 text-center capitalize">{formatMonthFull(year, month)}</span>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { const n = nextMonth(year, month); setYear(n.year); setMonth(n.month); }}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button onClick={() => setPurchaseDialogOpen(true)} size="sm" className="glow-orange" style={{ background: "linear-gradient(135deg, oklch(0.65 0.18 35), oklch(0.58 0.20 28))" }}>
            <Plus className="h-4 w-4 mr-1" /> Nova Compra
          </Button>
          <Button onClick={() => setCardDialogOpen(true)} size="sm" variant="outline" className="border-border/50">
            <CreditCard className="h-4 w-4 mr-1" /> Novo Cartão
          </Button>
        </div>
      </div>

      {/* Total geral */}
      <Card className="metric-card border-border/40">
        <CardContent className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "oklch(0.65 0.18 35 / 0.15)" }}>
              <Layers className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Total de Faturas</p>
              <p className="text-2xl font-bold font-tabular text-foreground">{formatCurrency(grandTotal)}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">{Object.keys(purchaseGroups).length} compra(s)</p>
            <p className="text-xs text-muted-foreground">{cards.filter((c) => c.active).length} cartão(ões)</p>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="faturas">
        <TabsList className="bg-card border border-border/40">
          <TabsTrigger value="faturas">Faturas do Mês</TabsTrigger>
          <TabsTrigger value="cartoes">Meus Cartões</TabsTrigger>
        </TabsList>

        {/* Faturas */}
        <TabsContent value="faturas" className="space-y-4 mt-4">
          {byCard.filter((bc) => bc.installs.length > 0).map(({ card, installs, total }) => (
            <Card key={card.id} className="metric-card border-border/40">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-primary" />
                    {card.name}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs border-border/40">
                      <Calendar className="h-3 w-3 mr-1" /> Vence dia {card.dueDay}
                    </Badge>
                    <span className="font-bold text-sm font-tabular text-foreground">{formatCurrency(total)}</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border/30">
                  {installs.map((inst) => (
                    <div key={inst.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/3 transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground truncate">{inst.description}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant="outline" className="text-xs h-4 px-1.5 border-border/40">
                            {formatInstallments(inst.currentInstallment, inst.totalInstallments)}
                          </Badge>
                          {inst.categoryId && (
                            <span className="text-xs text-muted-foreground">{catMap[inst.categoryId]}</span>
                          )}
                        </div>
                      </div>
                      <span className="font-medium text-sm font-tabular text-foreground shrink-0">
                        {formatCurrency(inst.installmentValue)}
                      </span>
                      {inst.currentInstallment === 1 && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-red-500/10 shrink-0"
                          onClick={() => { if (confirm("Excluir todas as parcelas desta compra?")) deletePurchaseMut.mutate({ purchaseGroupId: inst.purchaseGroupId! }); }}>
                          <Trash2 className="h-3.5 w-3.5 text-red-400" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
          {byCard.every((bc) => bc.installs.length === 0) && (
            <div className="text-center py-12 text-muted-foreground text-sm">
              Nenhuma parcela neste mês.
            </div>
          )}
        </TabsContent>

        {/* Cartões */}
        <TabsContent value="cartoes" className="mt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {cards.map((card) => (
              <Card key={card.id} className="metric-card border-border/40 overflow-hidden">
                <div className="h-1.5 accent-line" />
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-bold text-foreground">{card.name}</p>
                      {!card.active && <Badge variant="outline" className="text-xs mt-1 border-border/40">Inativo</Badge>}
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-red-500/10"
                      onClick={() => { if (confirm("Excluir este cartão e todas as compras?")) deleteCardMut.mutate({ id: card.id }); }}>
                      <Trash2 className="h-3.5 w-3.5 text-red-400" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2 rounded-lg" style={{ background: "oklch(0.18 0.03 220)" }}>
                      <p className="text-muted-foreground">Limite</p>
                      <p className="font-semibold text-foreground font-tabular">{formatCurrency(card.limit)}</p>
                    </div>
                    <div className="p-2 rounded-lg" style={{ background: "oklch(0.18 0.03 220)" }}>
                      <p className="text-muted-foreground">Fechamento</p>
                      <p className="font-semibold text-foreground">Dia {card.closingDay}</p>
                    </div>
                    <div className="p-2 rounded-lg" style={{ background: "oklch(0.18 0.03 220)" }}>
                      <p className="text-muted-foreground">Vencimento</p>
                      <p className="font-semibold text-foreground">Dia {card.dueDay}</p>
                    </div>
                    <div className="p-2 rounded-lg" style={{ background: "oklch(0.18 0.03 220)" }}>
                      <p className="text-muted-foreground">Fatura atual</p>
                      <p className="font-semibold text-primary font-tabular">
                        {formatCurrency(byCard.find((bc) => bc.card.id === card.id)?.total ?? 0)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {cards.length === 0 && !isLoading && (
              <div className="col-span-3 text-center py-12 text-muted-foreground text-sm">
                Nenhum cartão cadastrado.
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialog: Novo Cartão */}
      <Dialog open={cardDialogOpen} onOpenChange={setCardDialogOpen}>
        <DialogContent className="sm:max-w-md" style={{ background: "oklch(0.14 0.028 220)", border: "1px solid oklch(0.28 0.05 220)" }}>
          <DialogHeader>
            <DialogTitle className="gradient-text">Novo Cartão de Crédito</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Nome do Cartão *</Label>
              <Input placeholder="Ex: Nubank, Itaú Visa" value={cardForm.name}
                onChange={(e) => setCardForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Limite (R$)</Label>
              <Input type="number" step="0.01" placeholder="0,00" value={cardForm.limit}
                onChange={(e) => setCardForm((f) => ({ ...f, limit: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Dia de Fechamento</Label>
                <Input type="number" min="1" max="31" value={cardForm.closingDay}
                  onChange={(e) => setCardForm((f) => ({ ...f, closingDay: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Dia de Vencimento</Label>
                <Input type="number" min="1" max="31" value={cardForm.dueDay}
                  onChange={(e) => setCardForm((f) => ({ ...f, dueDay: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCardDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => {
              if (!cardForm.name) return toast.error("Informe o nome do cartão.");
              createCardMut.mutate({ name: cardForm.name, limit: parseFloat(cardForm.limit) || 0, closingDay: parseInt(cardForm.closingDay), dueDay: parseInt(cardForm.dueDay) });
            }} style={{ background: "linear-gradient(135deg, oklch(0.65 0.18 35), oklch(0.58 0.20 28))" }}>
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Nova Compra */}
      <Dialog open={purchaseDialogOpen} onOpenChange={setPurchaseDialogOpen}>
        <DialogContent className="sm:max-w-md" style={{ background: "oklch(0.14 0.028 220)", border: "1px solid oklch(0.28 0.05 220)" }}>
          <DialogHeader>
            <DialogTitle className="gradient-text">Lançar Compra</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Cartão *</Label>
              <Select value={purchaseForm.cardId} onValueChange={(v) => setPurchaseForm((f) => ({ ...f, cardId: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione o cartão..." /></SelectTrigger>
                <SelectContent>
                  {cards.filter((c) => c.active).map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Descrição *</Label>
              <Input placeholder="Ex: iPhone 15, Viagem, Notebook" value={purchaseForm.description}
                onChange={(e) => setPurchaseForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Valor Total (R$) *</Label>
                <Input type="number" step="0.01" placeholder="0,00" value={purchaseForm.totalValue}
                  onChange={(e) => setPurchaseForm((f) => ({ ...f, totalValue: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Parcelas</Label>
                <Input type="number" min="1" max="60" value={purchaseForm.installments}
                  onChange={(e) => setPurchaseForm((f) => ({ ...f, installments: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Mês da 1ª Parcela</Label>
              <Input type="month" value={purchaseForm.firstInstallmentMonth}
                onChange={(e) => setPurchaseForm((f) => ({ ...f, firstInstallmentMonth: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <Select value={purchaseForm.categoryId} onValueChange={(v) => setPurchaseForm((f) => ({ ...f, categoryId: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {purchaseForm.totalValue && purchaseForm.installments && parseInt(purchaseForm.installments) > 1 && (
              <div className="p-3 rounded-xl text-xs" style={{ background: "oklch(0.52 0.15 195 / 0.1)", border: "1px solid oklch(0.52 0.15 195 / 0.3)" }}>
                <span className="text-muted-foreground">Valor por parcela: </span>
                <span className="font-bold text-teal-400">
                  {formatCurrency(parseFloat(purchaseForm.totalValue) / parseInt(purchaseForm.installments))}
                </span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPurchaseDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => {
              if (!purchaseForm.cardId || !purchaseForm.description || !purchaseForm.totalValue) return toast.error("Preencha os campos obrigatórios.");
              addPurchaseMut.mutate({
                cardId: parseInt(purchaseForm.cardId),
                description: purchaseForm.description,
                totalValue: parseFloat(purchaseForm.totalValue),
                installments: parseInt(purchaseForm.installments) || 1,
                firstInstallmentMonth: purchaseForm.firstInstallmentMonth,
                categoryId: purchaseForm.categoryId ? parseInt(purchaseForm.categoryId) : undefined,
              });
            }} disabled={addPurchaseMut.isPending}
              style={{ background: "linear-gradient(135deg, oklch(0.65 0.18 35), oklch(0.58 0.20 28))" }}>
              Lançar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
