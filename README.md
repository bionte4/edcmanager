# EDC Manager

Sistem operasional internal untuk proyek **EDC** (Electronic Data Capture): monitoring SLA corrective maintenance, buffer stock logistik, evaluasi vendor, ticketing NOC/LO, serta integrasi monitoring & kampanye PM/peak season.

Repo: [github.com/bionte4/edcmanager](https://github.com/bionte4/edcmanager)

## Dokumentasi

| Dokumen | Isi |
|---------|-----|
| [User Guide](docs/USER-GUIDE.md) | Panduan pengguna operasional (per peran + checklist) |
| [Manual Guide](docs/MANUAL.md) | Detail modul, RBAC, config, troubleshooting |
| [ERD](docs/ERD.md) | Entity Relationship Diagram (Prisma) |
| [Deploy VPS](docs/DEPLOY-VPS.md) | Docker Compose + Nginx + HTTPS + cron |
| [Prompted.md](Prompted.md) | Riwayat prompt build + roadmap ops |

## Fitur utama

| Modul | Deskripsi |
|--------|-----------|
| **Dashboard / Executive** | KPI tiket, uptime 99.9%, near-breach, buffer RO, tren MetricLog |
| **Ticketing ITSM** | Incident / Request / Problem / Change + lifecycle + SLA/OLA |
| **Clock-stop SLA** | Pause timer (alasan BRI); alasan sensitif butuh approval Supervisor |
| **Near-breach 16:00** | Antrian WARNING/BREACHED + digest email harian |
| **Workforce** | NOC roster 3 shift, WFM absensi/swap, **Liaison LO** (DOG 2 shift + handover + inbox eskalasi) |
| **PM / Peak** | Settings PM (hari + RO) + master peak season di DB (CRUD multi-tahun) |
| **Dispatch cerdas** | Saran 1:25 (beban + home RO + standby dari profil User) |
| **Inventori** | Assets EDC, buffer ≥10%, peripherals |
| **Vendor** | Master + evaluasi SLA/uptime/alokasi |
| **Integrasi** | SMTP, AI Insight, API clients, **monitoring → auto Incident** |
| **Auth + RBAC** | Session JWT cookie + role/permission (termasuk `LIAISON`) |

## Tech stack

- **Frontend:** Next.js 15 (App Router), React 19, Tailwind CSS, Lucide Icons
- **Backend:** TypeScript + Prisma ORM → **PostgreSQL** (store operasional)
- **Auth:** HTTP-only signed cookie (`jose`) + RBAC
- **Notifikasi / cron:** SMTP + endpoint `/api/cron/*` (`CRON_SECRET`)

## Setup lokal

```bash
git clone https://github.com/bionte4/edcmanager.git
cd edcmanager
npm install
cp .env.example .env
# Set DATABASE_URL, AUTH_SECRET, opsional SMTP + CRON_SECRET

npm run db:generate
npm run db:push
npm run db:seed
npm run dev
```

Buka http://localhost:3000

### Akun demo (password `edc123`)

| Email | Role |
|--------|------|
| `admin@edc.local` | ADMIN |
| `andi.noc@edc.local` | NOC |
| `dewi.supervisor@edc.local` | SUPERVISOR |
| `rudi.ops@edc.local` | OPS_MANAGER |
| `farah.lo@edc.local` | LIAISON |
| `eko.tech@edc.local` | VENDOR_TECH |
| `hendra.gm@edc.local` | GM |

## Docker

```bash
cp .env.docker.example .env
docker compose up --build -d
```

App: http://localhost:3000 · Postgres: `localhost:5432`

## Routes penting

| Route | Modul |
|--------|--------|
| `/` | Dashboard |
| `/ticketing` | Ticketing + clock-stop + saran dispatch |
| `/ops/near-breach` | Antrian near-breach 16:00 |
| `/ops/campaigns` | PM settings + peak season CRUD + generate |
| `/ops/dispatch` | Kapasitas RO + saran teknisi |
| `/workforce` | NOC · LO/DOG · Handover · Inbox · WFM |
| `/inventory` | Assets / buffer / peripherals |
| `/vendors` | Master + evaluasi |
| `/integration` | SMTP / AI / API / monitoring ingest |
| `/admin/users` | User CRUD + home RO / standby (VENDOR_TECH) |

## Integration & cron API

**Tickets:** `GET/POST /api/v1/tickets` — scope `tickets:read|write`  
Demo Service Desk: `edc_sk_demo_servicedesk_change_me`

**Monitoring ingest:** `POST /api/v1/monitoring/events` — scope `monitoring:ingest`  
Demo: `edc_sk_demo_monitoring_change_me`  
→ CRITICAL/MAJOR auto-create INCIDENT (dedup SN:alert:hari)

**Cron** (header `Authorization: Bearer $CRON_SECRET`):

| Endpoint | Fungsi |
|----------|--------|
| `/api/cron/near-breach-digest` | Digest near-breach (≥16:00 WIB) |
| `/api/cron/pm-monthly` | Generate PM per RO aktif (hari = `PmSettings`) |
| `/api/cron/peak-intensify` | Intensifikasi peak season + email |

**Ops masters (session):**

| Endpoint | Fungsi |
|----------|--------|
| `/api/ops/peak-seasons` | CRUD window Natal/TB/Lebaran |
| `/api/ops/pm-settings` | Hari generate + RO aktif PM |

## Aturan bisnis (config + DB)

Sumber: `src/config/` + tabel master (jangan hardcode tanggal/RO di UI).

- **SLA Dalam Kota + VIP + peak 06.01–21.00 WIB:** resolusi **2 jam**
- **Warning** ≥ **80%** elapsed; **Breached** lewat deadline
- **Clock-stop** mengurangi elapsed efektif; alasan ★ butuh approval
- **Uptime target:** **99.9%**
- **Buffer:** ≥ **10%** per RO (peak window di DB bisa set floor 12–15%)
- **Dispatch:** **1 : 25** (`dispatch.config.ts`); home RO / standby di **User**
- **Peak dates / PM day+RO:** Postgres (`PeakSeasonWindow`, `PmSettings`)

## Struktur folder

```text
prisma/                 # schema + seed PostgreSQL
src/
  app/                  # App Router + API routes
  components/           # UI modul
  config/               # SLA, pause, liaison, PM, peak, dispatch, …
  data/                 # Prisma-backed stores
  lib/                  # auth, rbac, notifications, …
  sla/                  # engine SLA (pause-aware)
  ola/                  # engine OLA
docs/                   # MANUAL, ERD, DEPLOY-VPS
```

## Script

```bash
npm run build
npm run db:seed
npm run db:studio
npm run sla:demo
```

## Catatan

- Data operasional dijalankan lewat **Prisma/Postgres** (+ seed demo).
- Jangan commit `.env`.
- Setelah pull production: `prisma db push` (atau migrate) + seed bila perlu + set `CRON_SECRET`.

## Lisensi

Private / internal use — proyek operasional EDC.
