# EDC Manager

Sistem operasional internal untuk proyek **EDC** (Electronic Data Capture): monitoring SLA corrective maintenance, buffer stock logistik, evaluasi vendor, serta ticketing NOC command center.

Repo: [github.com/bionte4/edcmanager](https://github.com/bionte4/edcmanager)

## Fitur utama

| Modul | Deskripsi |
|--------|-----------|
| **Dashboard** | KPI tiket aktif, uptime vs 99.9%, mendekati breach SLA, status buffer stock RO |
| **Ticketing** | ITSM: Incident / Request / Problem / Change + lifecycle + SLA per tipe |
| **NOC Roster** | Standby on-duty per shift (pagi/siang/malam) + directory personil |
| **Buffer Stock** | Distribusi cadangan EDC ≥10% per RO + mutasi/pooling |
| **Evaluasi Vendor** | Vendor 1 vs Vendor 2: SLA compliance, resolusi, kendala operasional |
| **SLA Engine** | Aturan SLA (Dalam Kota VIP peak 2 jam, warning 80%, laporan uptime) |
| **Auth + RBAC** | Login session, role/permission matrix, Admin Users CRUD |

## Tech stack

- **Frontend:** Next.js 15 (App Router), React 19, Tailwind CSS, Shadcn-style UI, Lucide Icons
- **Backend logic:** TypeScript (SLA engine, inventory, ticketing workflow)
- **Auth:** Signed HTTP-only session cookie (`jose`) + RBAC permissions
- **Database:** PostgreSQL + Prisma ORM

## Prasyarat

- Node.js 20+
- PostgreSQL (untuk migrasi schema; UI demo saat ini memakai mock data)

## Setup

```bash
git clone https://github.com/bionte4/edcmanager.git
cd edcmanager
npm install
cp .env.example .env
# Edit DATABASE_URL dan AUTH_SECRET di .env
```

Generate Prisma Client & (opsional) push schema:

```bash
npm run db:generate
npm run db:push
```

## Menjalankan aplikasi

```bash
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000) — akan diarahkan ke `/login`.

### Demo login

| Email | Role | Password |
|--------|------|----------|
| `admin@edc.local` | Administrator | `edc123` |
| `andi.noc@edc.local` | NOC | `edc123` |
| `dewi.supervisor@edc.local` | Supervisor | `edc123` |
| `rudi.ops@edc.local` | Ops Manager | `edc123` |

| Route | Halaman |
|--------|---------|
| `/login` | Sign in |
| `/` | Dashboard operasional |
| `/ticketing` | Ticketing system |
| `/noc` | NOC standby roster |
| `/buffer-stock` | Buffer stock logistik |
| `/evaluasi-vendor` | Evaluasi performa vendor |
| `/integration` | Dokumentasi Integration API v1 |
| `/admin/users` | Admin Users CRUD + RBAC matrix |

### Integration API (external systems)

Base: `/api/v1/tickets`  
Auth: `Authorization: Bearer <apiKey>` atau `X-Api-Key`

Demo key (Service Desk): `edc_sk_demo_servicedesk_change_me`

## Script berguna

```bash
npm run build      # production build
npm run sla:demo   # smoke test engine SLA
npm run db:studio  # Prisma Studio
npm run db:validate
```

## Aturan bisnis (ringkas)

Konfigurasi ada di `src/config/` (jangan hardcode di UI):

- **SLA Dalam Kota + VIP + jam sibuk (06.01–21.00 WIB):** batas resolusi **2 jam**
- **Warning** saat elapsed ≥ **80%** limit; **Breached** jika melewati deadline
- **Uptime target:** **99.9%**
- **Buffer stock:** minimum **10%** per Regional Office

## Struktur folder

```text
prisma/                 # schema PostgreSQL
src/
  app/                  # Next.js App Router pages
  components/           # UI dashboard, NOC, ticketing, buffer, vendors
  config/               # SLA, inventory, NOC shift windows
  data/                 # mock data demo
  lib/                  # inventory + ticketing helpers
  sla/                  # SLA calculation engine
```

## Catatan

- Data ticket/vendor/buffer di UI masih **mock** agar bisa didemo tanpa DB.
- Schema Prisma sudah mencakup `Vendor`, `EdcUnit`, `Ticket`, `MetricLog`, `User`, `NocShift`, `TicketActivity`.
- Jangan commit file `.env` (sudah di `.gitignore`).

## Lisensi

Private / internal use — proyek operasional EDC.
