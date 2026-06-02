# ILLIC — Sistema de Reabilitação Baseada em Evidências

## Visão geral
Sistema interno para propor, monitorar e ajustar planos de reabilitação.
**NÃO é prontuário oficial** — gera texto para copiar no Zenfisio.

## Stack
- React + TypeScript + Vite
- Tailwind CSS v4 (`@tailwindcss/vite`)
- Supabase (Postgres + Auth + RLS) — região SA
- React Router v6
- TanStack Query v5
- lucide-react para ícones

## Papéis (RBAC)
- `fisioterapeuta` — vê apenas seus pacientes
- `coordenador` — vê todos; painel, reunião, ranking
- `admin` — tudo + gestão de usuários e catálogos

## Estrutura de pastas
```
src/
  lib/           → supabase.ts, auth.ts, AuthContext.tsx, auditoria.ts, cn.ts
  types/         → database.ts (tipos TypeScript de todas as tabelas)
  features/
    pacientes/
    planos/      → fases, microciclos, motor de critérios
    sessoes/     → builder, execução, copiar-evolução
    avaliacoes/
    coordenacao/ → painel, reunião, notas, notificações
    performance/ → ranking/scorecard
  components/ui/ → componentes shadcn reutilizáveis
  routes/        → App.tsx, Layout.tsx, Login.tsx, ProtectedRoute.tsx
supabase/
  migrations/    → SQL numerado (0001_, 0002_, …)
```

## Convenções
- Aliases: `@/` → `src/`
- Sem comentários óbvios; sem `console.log` em produção
- Registros clínicos (sessão, evolução) **não se editam** — corrige por aditamento
- Log de auditoria é **imutável** (sem UPDATE/DELETE)
- RLS imposta no banco, não só na UI

## Fases de build
- **Fase 0** ✅ — Schema, Auth, RLS, log de auditoria (migration 0001)
- **Fase 1** — Cadastro paciente, avaliação, plano + fases + critérios, motor
- **Fase 2** — Catálogo exercícios, builder de sessão, progressão, copiar evolução
- **Fase 3** — Painel coordenador, check-in semanal, modo reunião, notificações
- **Fase 4** — Ranking/scorecard, relatórios PDF

## Supabase
- URL: https://bqdqozzotuxdmadxpbko.supabase.co
- Migrations: executar no SQL Editor do Supabase Dashboard ou via `supabase db push`
- Para rodar migrations: copiar conteúdo de `supabase/migrations/0001_fase0_schema.sql` no SQL Editor
