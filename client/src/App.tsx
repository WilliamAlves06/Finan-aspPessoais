import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import Auth from "@/pages/Auth";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import DashboardLayout from "./components/DashboardLayout";
import Dashboard from "./pages/Dashboard";
import Transactions from "./pages/Transactions";
import FixedExpenses from "./pages/FixedExpenses";
import CreditCards from "./pages/CreditCards";
import Goals from "./pages/Goals";
import Alerts from "./pages/Alerts";
import Insights from "./pages/Insights";
import { useAuth } from "@/_core/hooks/useAuth";
import { Loader2 } from "lucide-react";

function ProtectedRouter() {
  return (
    <DashboardLayout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/transactions" component={Transactions} />
        <Route path="/fixed-expenses" component={FixedExpenses} />
        <Route path="/credit-cards" component={CreditCards} />
        <Route path="/goals" component={Goals} />
        <Route path="/alerts" component={Alerts} />
        <Route path="/insights" component={Insights} />
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </DashboardLayout>
  );
}

function Router() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Se não está autenticado, mostra a página de login
  if (!user) {
    return <Auth />;
  }

  // Se está autenticado, mostra o dashboard
  return <ProtectedRouter />;
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster richColors theme="dark" />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
