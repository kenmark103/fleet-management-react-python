# Fleet Management System — Frontend

React frontend for the Fleet Management System. Handles fleet tracking, fuel management, driver management, notifications, and settings.

---

## Tech Stack

- **Framework**: React + TanStack Start
- **Routing**: TanStack Router (file-based)
- **Styling**: Tailwind CSS
- **Testing**: Vitest
- **Build tool**: Vite
- **Runtime**: Node 20

---

## Project Structure

```
frontend/web/
├── src/
│   ├── routes/                 # File-based routes (TanStack Router)
│   │   ├── __root.tsx          # Root layout (nav, shell)
│   │   ├── _auth/              # Authenticated route group
│   │   │   ├── fleet/          # Fleet management pages
│   │   │   ├── fuel/           # Fuel & expenses pages
│   │   │   ├── drivers/        # Driver management pages
│   │   │   ├── notifications/  # Notifications pages
│   │   │   └── settings/       # Settings pages
│   │   └── index.tsx           # Public landing / login page
│   ├── components/             # Shared UI components
│   ├── hooks/                  # Custom React hooks
│   ├── services/               # API call functions
│   ├── styles.css              # Global styles + Tailwind import
│   └── main.tsx                # App entry point
├── public/                     # Static assets
├── .env.example                # Environment variable template
├── Dockerfile                  # Docker image definition
├── vite.config.ts              # Vite + TanStack plugin config
├── tailwind.config.ts          # Tailwind config
├── tsconfig.json
└── package.json
```

---

## Getting Started

### Prerequisites
- Node 20+
- Backend API running (see `/backend/README.md`)

### Local Setup

```bash
# 1. Navigate to frontend
cd fms/frontend/web

# 2. Install dependencies
npm install

# 3. Set up environment
cp .env.example .env.local
# Edit .env.local — set VITE_API_URL to your backend URL

# 4. Start the dev server
npm run dev
```

App runs at: `http://localhost:3000`

---

## Running with Docker

```bash
# From the project root (fms/)
docker-compose up --build

# Frontend will be available at http://localhost:3000
```

The Docker setup uses the Vite dev server with hot reload enabled inside the container.

---

## Environment Variables

Copy `.env.example` to `.env.local` and fill in values:

```env
VITE_API_URL=http://localhost:8000     # Backend API base URL
```

---

## Routing

Routes are file-based under `src/routes/`. TanStack Router auto-generates the route tree.

**Adding a new route:**
1. Create a file in `src/routes/` — the file path becomes the URL
2. Export a `Route` using `createFileRoute`
3. The route tree updates automatically on next dev server start

**Route file conventions:**
- `index.tsx` → `/`
- `about.tsx` → `/about`
- `$id.tsx` → `/:<id>` (dynamic param)
- `-filename.tsx` → excluded from routing (prefix with `-`)

**Authenticated routes** live under `_auth/` — this layout group wraps all pages that require a logged-in user.

---

## Available Scripts

```bash
npm run dev        # Start dev server
npm run build      # Build for production
npm run preview    # Preview production build locally
npm run test       # Run tests with Vitest
```

---

## Testing

Tests use [Vitest](https://vitest.dev/).

```bash
npm run test               # Run all tests
npm run test -- --coverage # Run with coverage
```