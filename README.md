# POC - Design Tokens Manager

Scaffold de POC com **React 19 + Vite + TypeScript**, **Tailwind CSS v4** e **Shadcn/UI**, gerenciado com **pnpm**.

## Pré-requisitos

- Node.js >= 20
- pnpm >= 9 (`npm i -g pnpm`)

## Instalação

```bash
pnpm install
```

## Scripts

| Comando             | Descrição                                |
| ------------------- | ---------------------------------------- |
| `pnpm dev`          | Inicia o servidor de desenvolvimento     |
| `pnpm build`        | Type-check + build de produção           |
| `pnpm preview`      | Preview do build de produção             |
| `pnpm lint`         | Roda o ESLint                            |
| `pnpm lint:fix`     | Corrige problemas de lint automaticamente|
| `pnpm format`       | Formata o código com Prettier            |
| `pnpm format:check` | Verifica formatação sem alterar arquivos |

## Estrutura

```
src/
├── components/
│   └── ui/          # Componentes Shadcn (Button, Card, Input...)
├── hooks/           # Custom hooks
├── lib/             # Utils (cn, clients, configs de libs)
├── pages/           # Componentes de tela/rota
├── services/        # API calls, mocks, integrações
├── App.tsx
├── main.tsx
└── index.css        # Tokens do Tailwind v4 + tema Shadcn
```

## Adicionando novos componentes Shadcn

```bash
pnpm dlx shadcn@latest add <componente>
```

Exemplo:

```bash
pnpm dlx shadcn@latest add dialog dropdown-menu
```

## Stack

- **Framework:** React 19 + Vite 6
- **Linguagem:** TypeScript 5
- **Estilização:** Tailwind CSS v4 (`@tailwindcss/vite`)
- **Componentes:** Shadcn/UI (style `new-york`, baseColor `neutral`)
- **Ícones:** lucide-react
- **Lint/Format:** ESLint 9 (flat config) + Prettier 3
