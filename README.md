# Used Car Inspector AI — Production Codebase

AI-powered used car inspection and risk scoring platform. Built with Next.js 14, TypeScript, Prisma, Zustand, and Stripe.

---

## Architecture Overview

```
src/
├── app/                    # Next.js App Router — pages + API routes
│   ├── (auth)/             # Login / Register (unauthenticated routes)
│   ├── dashboard/          # Main dashboard
│   ├── vehicle/[id]/       # Vehicle detail
│   ├── inspection/         # Checklist inspection flow
│   ├── report/             # Final BUY/DON'T BUY report
│   ├── premium/            # CarVertical premium payment portal
│   ├── messages/           # Messaging / chat
│   ├── community/          # Community posts feed
│   ├── profile/            # User profile + purchase history
│   └── api/                # Route handlers (REST API)
│
├── components/             # React components (UI only — no business logic)
│   ├── ui/                 # Design system: Button, Card, Badge, ScoreRing…
│   ├── inspection/         # Checklist, PhotoUpload, InspectionProgress…
│   ├── scoring/            # RiskScoreBreakdown, VerdictCard…
│   ├── ai/                 # AIFindingCard, PhotoGrid…
│   ├── payment/            # PremiumLockedState, PaymentStates…
│   ├── community/          # PostCard, CommentList, CreatePostModal…
│   ├── messaging/          # ConversationList, MessageThread…
│   └── layout/             # AppShell, Sidebar, Topbar, DashboardStats…
│
├── modules/                # Business logic — pure, testable, no UI
│   ├── scoring/            # Risk score calculation engine
│   ├── ai-analysis/        # AI analysis pipeline + result parsing
│   ├── inspection/         # Inspection session management
│   ├── integrations/
│   │   ├── base/           # VehicleHistoryProviderInterface
│   │   └── carvertical/    # CarVertical provider, mapper, mock, config
│   ├── payments/           # Payment lifecycle, access grants
│   │   └── providers/
│   │       └── stripe/     # Stripe adapter
│   ├── messaging/          # Conversation + message management
│   ├── posts/              # Community posts + comments
│   └── users/              # User management
│
├── services/api/           # Frontend HTTP service layer (no business logic)
│   ├── client.ts           # Axios instance with auth interceptors
│   ├── auth.api.ts
│   ├── vehicle.api.ts
│   ├── inspection.api.ts
│   ├── ai.api.ts
│   ├── payment.api.ts
│   └── messaging.api.ts
│
├── store/                  # Zustand global state
│   ├── useUserStore.ts     # Auth + session
│   ├── useVehicleStore.ts  # Active vehicle + vehicle list
│   ├── useInspectionStore.ts # Inspection session + checklists + AI results
│   ├── usePaymentStore.ts  # Purchase state + access grants
│   └── useChatStore.ts     # Conversations + messages
│
├── types/                  # All shared TypeScript types (index.ts barrel)
├── utils/                  # Shared utilities (auth.middleware, formatters…)
├── hooks/                  # Custom React hooks (useRiskScore, useAuth…)
├── config/                 # prisma.ts singleton, env.ts validation
└── mocks/                  # Seed data for dev/Storybook

prisma/
└── schema.prisma           # Full database schema

tests/
├── unit/                   # Pure logic tests (no DB required)
└── integration/            # Service tests (require TEST_DATABASE_URL)
```

---

## Key Architectural Decisions

### 1. Module Separation
Every feature lives in `src/modules/`. Modules contain service + logic + types. **No module imports from another module's internals** — only from each other's barrel exports (`index.ts`).

### 2. CarVertical is 100% Abstracted
The rest of the app never imports from `carvertical/` directly. It uses `VehicleHistoryProviderInterface`. To swap to a different provider: create a new folder in `integrations/`, implement the interface, and change one line in `carvertical.service.ts`.

### 3. Payment Provider is Swappable
`PaymentService` accepts any `PaymentProviderInterface`. To swap Stripe for Adyen: create `src/modules/payments/providers/adyen/adyen.adapter.ts`, implement the interface, pass it to `PaymentService`.

### 4. Services vs Stores
- `src/services/api/` — HTTP calls only. No state. No logic.
- `src/store/` — State only. Calls services for data. No direct DB access.
- `src/modules/` — Business logic only. No HTTP. No UI. Directly testable.

### 5. Premium Access is Enforced at Multiple Layers
- **Database**: `AccessGrant` table with `isActive` + expiry
- **API route**: `paymentService.verifyAccess()` check before returning data
- **UI**: `usePaymentStore().hasAccess()` controls what the user sees
- **Score engine**: `hasPremiumHistory` flag changes scoring behaviour

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Set up environment
cp .env.example .env.local
# Edit .env.local with your values

# 3. Set up database
npm run db:migrate
npm run db:generate
npm run db:seed    # optional seed data

# 4. Start development server
npm run dev
```

## Running Tests

```bash
npm test                          # all tests
npx jest tests/unit/              # unit tests only (no DB)
npx jest tests/integration/       # integration tests (needs TEST_DATABASE_URL)
```

## Stripe Webhook (local dev)

```bash
# Install Stripe CLI and forward webhooks to localhost
stripe listen --forward-to localhost:3000/api/payment/webhook
```

---

## Adding a New Payment Provider

1. Create `src/modules/payments/providers/adyen/adyen.adapter.ts`
2. Implement `PaymentProviderInterface`
3. In `payment.service.ts`, change `new StripeAdapter()` to `new AdyenAdapter()`
4. Add `ADYEN_*` env vars to `.env.example`

## Adding a New VIN History Provider

1. Create `src/modules/integrations/hpi/hpi.provider.ts`
2. Extend `BaseVehicleHistoryProvider`
3. Create `hpi.mapper.ts` — transform raw HPI data to `VehicleHistoryResult`
4. In `carvertical.service.ts` (or a new `vin-history.service.ts`), swap the provider

---

## Team Conventions

- **Never** put business logic in components
- **Never** call `prisma` from a store or service — only from modules
- **Never** import CarVertical types outside `src/modules/integrations/carvertical/`
- **Always** add types to `src/types/index.ts` before implementing
- **Always** write a unit test alongside any new scoring/logic function
