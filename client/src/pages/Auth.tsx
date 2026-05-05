import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { BarChart3 } from "lucide-react";

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: () => {
      toast.success("Login realizado!");
      window.location.reload();
    },
    onError: (err) => {
      toast.error(err.message || "Erro ao fazer login");
    },
  });

  const registerMutation = trpc.auth.register.useMutation({
    onSuccess: () => {
      toast.success("Cadastro realizado! Você já está logado.");
      window.location.reload();
    },
    onError: (err) => {
      toast.error(err.message || "Erro ao cadastrar");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast.error("Preencha todos os campos");
      return;
    }

    if (isLogin) {
      loginMutation.mutate({ email, password });
    } else {
      if (!name) {
        toast.error("Preencha o nome");
        return;
      }
      registerMutation.mutate({ email, password, name });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "linear-gradient(135deg, oklch(0.11 0.025 220), oklch(0.15 0.03 220))" }}>
      <Card className="w-full max-w-md border-border/40">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="w-12 h-12 rounded-lg flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, oklch(0.65 0.18 35), oklch(0.55 0.15 195))" }}>
              <BarChart3 className="w-6 h-6 text-white" />
            </div>
          </div>
          <CardTitle className="text-2xl gradient-text">
            {isLogin ? "Login" : "Cadastro"}
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-2">
            {isLogin ? "Acesse seu painel financeiro" : "Crie sua conta para começar"}
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <Input
                placeholder="Seu nome"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={registerMutation.isPending}
              />
            )}
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loginMutation.isPending || registerMutation.isPending}
            />
            <Input
              type="password"
              placeholder="Senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loginMutation.isPending || registerMutation.isPending}
            />
            <Button
              type="submit"
              className="w-full font-semibold"
              disabled={loginMutation.isPending || registerMutation.isPending}
              style={{ background: "linear-gradient(135deg, oklch(0.65 0.18 35), oklch(0.58 0.20 28))" }}
            >
              {loginMutation.isPending || registerMutation.isPending 
                ? "Carregando..." 
                : isLogin ? "Entrar" : "Cadastrar"}
            </Button>
            <button
              type="button"
              onClick={() => {
                setIsLogin(!isLogin);
                setEmail("");
                setPassword("");
                setName("");
              }}
              className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {isLogin ? "Não tem conta? Cadastre-se" : "Já tem conta? Faça login"}
            </button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
