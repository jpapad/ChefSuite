# ChefSuite

A full-featured restaurant management platform built for modern kitchens. ChefSuite centralises recipes, menus, inventory, team scheduling, and kitchen operations into a single, fast web app.

---

## Features

### Recipes & Menus
- **Recipe library** — create and manage recipes with ingredients, allergens, tags, cost analysis, and photo uploads
- **Recipe versioning** — full history of every change with diff view
- **AI recipe import** — paste text or describe a dish; Gemini AI structures it automatically
- **Menu builder** — multi-section menus with items linked to recipes, drag-and-drop ordering
- **Buffet label printing** — generate print-ready labels (small/medium/large/custom mm) with logo, allergens, dietary tags, price, and bilingual (EN/EL) support
- **Public menu page** — shareable QR-code menu link, no login required
- **Menu engineering** — star/plow-horse/puzzle/dog quadrant analysis
- **Food cost & profit/loss** — automatic food-cost % per recipe and per menu

### Kitchen Operations
- **Prep tasks** — daily prep checklist with templates, steps, and completion tracking
- **Kitchen Display System (KDS)** — real-time order display per workstation
- **Kitchen Pulse** — live status board for active workstations
- **Waste log** — record and report food waste by item and reason
- **HACCP log** — temperature checks, corrective actions, compliance records
- **Chef's Journal** — personal notes and kitchen diary

### Inventory & Suppliers
- **Inventory management** — multi-location stock with unit tracking
- **Inventory movements** — in/out history with reason codes
- **QR-code inventory** — scan items with mobile for quick updates
- **Suppliers** — supplier directory with contact info and logo
- **Purchase orders** — create and track POs per supplier
- **Price tracking** — ingredient price history over time

### Team & HR
- **Team management** — invite members, assign roles and permissions
- **Shift scheduling** — weekly calendar view with per-member colour coding and printable A4 schedule
- **Time clock** — punch-in / punch-out with daily summaries
- **Staff performance** — hours and task completion per member
- **Walkie-talkie** — real-time push-to-talk voice messaging between staff
- **Team chat** — persistent in-app messaging

### Business Intelligence
- **Analytics dashboard** — sales, covers, and operational KPIs
- **Reservations** — table booking management with public booking page
- **Online orders** — incoming order tracking
- **Notifications** — in-app alerts for expiry, low stock, and task deadlines

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| Backend | Supabase (Postgres, Auth, Realtime, Storage) |
| Edge Functions | Deno (Supabase Functions) |
| AI | Google Gemini API |
| i18n | i18next (English / Greek) |
| PWA | vite-plugin-pwa |

---

## Getting Started

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project
- A [Google Gemini](https://aistudio.google.com) API key (optional — for AI features)

### 1. Clone & install

```bash
git clone https://github.com/jpapad/ChefSuite.git
cd ChefSuite
npm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
VITE_GEMINI_API_KEY=your-gemini-api-key
```

### 3. Apply database migrations

Using the [Supabase CLI](https://supabase.com/docs/guides/cli):

```bash
supabase link --project-ref your-project-ref
supabase db push
```

All 39 migrations are in `supabase/migrations/`.

### 4. Deploy Edge Functions (optional)

```bash
supabase functions deploy create-team-member
supabase functions deploy parse-invoice
supabase functions deploy profitability-ai
```

### 5. Run the dev server

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

---

## Project Structure

```
src/
├── components/       # Reusable UI components
│   ├── ui/           # Base components (Button, Drawer, Input…)
│   ├── layout/       # AppShell, Sidebar, TopBar
│   ├── recipes/      # Recipe-specific components
│   ├── menus/        # Menu builder, label printing
│   ├── inventory/    # Inventory forms and lists
│   └── …
├── pages/            # Route-level page components
├── hooks/            # Data hooks (one per domain, wraps Supabase)
├── contexts/         # Auth, Recipes, Inventory contexts
├── lib/              # Supabase client, print utilities, AI helpers
├── i18n/             # Translation files (en, el)
└── types/            # Generated Supabase database types

supabase/
├── migrations/       # 39 incremental SQL migrations
└── functions/        # Deno edge functions
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `VITE_SUPABASE_URL` | Yes | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Yes | Supabase anon/public key |
| `VITE_GEMINI_API_KEY` | No | Enables AI recipe import and profitability analysis |

---

## License

MIT
