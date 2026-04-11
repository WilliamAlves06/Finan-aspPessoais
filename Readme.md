# 💰 Finanças Pessoais

Sistema completo de controle financeiro pessoal, construído do zero com stack moderna full-stack TypeScript.

---

## ✨ Funcionalidades

- **Dashboard** — visão geral do mês com entradas, saídas, saldo livre e gráficos dos últimos 6 meses
- **Transações** — lançamentos manuais de entradas e saídas por categoria
- **Gastos Fixos** — controle de despesas recorrentes com marcação de pagamento mensal
- **Cartão de Crédito** — cadastro de cartões e parcelamentos automáticos por mês de referência
- **Metas** — objetivos de economia com aporte de contribuições e previsão de conclusão
- **Alertas** — notificações automáticas de saldo negativo, vencimentos próximos e metas sem aportes
- **Autenticação** — login e cadastro com JWT próprio, sem dependências externas

---

## 🛠️ Stack

| Camada | Tecnologia |
|---|---|
| Frontend | React 19 + TypeScript |
| Estilização | Tailwind CSS v4 + shadcn/ui |
| Roteamento | Wouter |
| Backend | Node.js + Express |
| API | tRPC (tipagem end-to-end) |
| Banco de dados | MySQL + Drizzle ORM |
| Autenticação | JWT (jose) + bcryptjs |
| Build | Vite + tsx |

---

## 🚀 Como rodar localmente

### Pré-requisitos

- [Node.js 18+](https://nodejs.org/)
- [pnpm](https://pnpm.io/) — `npm install -g pnpm`
- MySQL rodando localmente

### 1. Clone o repositório

```bash
git clone https://github.com/seu-usuario/financas-pessoais.git
cd financas-pessoais
```

### 2. Instale as dependências

```bash
pnpm install
```

### 3. Configure as variáveis de ambiente

Copie o arquivo de exemplo e preencha com seus dados:

```bash
cp .env.example .env
```

```env
DATABASE_URL=mysql://root:SUA_SENHA@localhost:3306/financas_pessoais
JWT_SECRET=gere_com_openssl_rand_base64_32
```

Para gerar um JWT_SECRET seguro:

```bash
openssl rand -base64 32
```

### 4. Crie o banco de dados

```sql
CREATE DATABASE financas_pessoais;
```

### 5. Crie as tabelas

```bash
pnpm db:push
```

### 6. Rode o projeto

```bash
pnpm dev
```

Acesse em [http://localhost:3000](http://localhost:3000)

---

## 📁 Estrutura do projeto

```
financas-pessoais/
├── client/
│   └── src/
│       ├── pages/          # Dashboard, Transações, Metas...
│       ├── components/     # Componentes UI (shadcn/ui)
│       ├── _core/hooks/    # useAuth
│       └── lib/            # trpc, format, utils
├── server/
│   ├── _core/              # context, trpc, env, vite
│   ├── routers.ts          # Todos os endpoints da API
│   └── db.ts               # Funções de acesso ao banco
├── drizzle/
│   └── schema.ts           # Schema do banco de dados
└── shared/
    └── const.ts            # Constantes compartilhadas
```

## 📄 Licença

MIT © [William Alves](https://github.com/seu-usuario)
