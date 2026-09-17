# EDC Manager — Manual Guide

Panduan operasional **EDC Manager** (SLA/OLA, ticketing, LO DOG, logistik, WFM, PM/peak, dispatch).

Repo: [github.com/bionte4/edcmanager](https://github.com/bionte4/edcmanager)  
Terkait: [ERD](./ERD.md) · [Deploy VPS](./DEPLOY-VPS.md) · [README](../README.md)

---

## 1. Ringkasan

Aplikasi membantu tim operasi:

- Memantau **SLA** kontrak (warning 80%, breach, clock-stop BRI)
- Mengukur **OLA** internal (Acknowledge & Dispatch)
- Menjalankan **ticketing ITSM**, **NOC/WFM**, **Liaison LO**, **inventori**
- Ritual harian **near-breach 16:00**, kampanye **PM bulanan** & **peak season**
- **Dispatch cerdas** (rasio 1:25) + **monitoring webhook → Incident**
- **Reporting**, notifikasi SMTP, Integration API

Data operasional disimpan di **PostgreSQL** (Prisma). UI responsive / PWA-ready.

---

## 2. Login & akses

1. Buka `/login`
2. Email + password
3. Menu menyesuaikan **RBAC**

### Akun demo (password: `edc123`)

| Email | Role |
|--------|------|
| `admin@edc.local` | Administrator |
| `andi.noc@edc.local` | NOC / L1 |
| `siti.noc@edc.local` | NOC / L1 |
| `budi.noc@edc.local` | NOC / L1 |
| `dewi.supervisor@edc.local` | Supervisor |
| `rudi.ops@edc.local` | Ops Manager |
| `farah.lo@edc.local` | Liaison LO |
| `gilang.lo@edc.local` | Liaison LO |
| `eko.tech@edc.local` | Vendor Tech |
| `rina.tech@edc.local` | Vendor Tech |
| `hendra.gm@edc.local` | GM / BOD |

---

## 3. Matriks akses (ringkas)

| Modul | ADMIN | OPS | SUP | NOC | LIAISON | TECH |
|--------|:-----:|:---:|:---:|:---:|:-------:|:----:|
| Dashboard | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Ticketing / near-breach | ✓ | ✓ | ✓ | ✓ | ✓ | ✓* |
| Clock-stop | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| Approve clock-stop ★ | ✓ | ✓ | ✓ | — | — | — |
| Workforce NOC/WFM | ✓ | ✓ | ✓ | ✓/— | — | — |
| LO / Handover / Inbox | ✓ | ✓ | ✓ | escalate | ✓ | — |
| PM / Peak / Dispatch | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| Inventori | ✓ | ✓ | ✓ | — | — | read |
| Vendor / Reporting | ✓ | ✓ | ± | — | — | — |
| Integrations | ✓ | — | — | — | — | — |
| Admin Users | ✓ | — | — | — | — | — |

\* Vendor Tech: update tiket terbatas. Permission lengkap: `src/config/rbac.config.ts`.

---

## 4. Navigasi

- **Desktop:** strip primary + Lainnya (secondary)
- **Mobile:** bottom nav + drawer
- **Workforce** = hub tab: NOC · LO/DOG · Handover · Inbox Eskalasi · WFM
- **Inventory / Config / Vendors** = hub dengan sub-tab RBAC

---

## 5. Modul operasional

### 5.1 Dashboard (`/`) & Executive (`/executive`)
KPI tiket, uptime vs **99.9%**, near-breach, buffer RO (≥10%), tren dari MetricLog.

### 5.2 Ticketing (`/ticketing`)
1. Filter ITSM: Incident / Request / Problem / Change  
2. Buat / assign NOC / lifecycle status  
3. Badge **SLA** + **OLA Ack/Disp**  
4. **Clock-stop / Resume** (permission `ticket:sla_pause`)  
5. Alasan ★ (force majeure, BRI hold, mass outage, lainnya) → **PENDING** sampai Supervisor approve  
6. Chip **saran teknisi** (dispatch score) saat Dispatch  

**SLA:** Dalam Kota + VIP + peak **06.01–21.00 WIB** → **2 jam**. Warning **80%**. Elapsed = wall-clock − pause efektif.

### 5.3 Near-breach 16:00 (`/ops/near-breach`)
Antrian WARNING/BREACHED (exclude clock-stopped).  
Tombol **Kirim digest** → email Supervisor/Ops/NOC.  
Cron: `POST /api/cron/near-breach-digest` + `CRON_SECRET`.

### 5.4 Workforce (`/workforce`)
- **NOC Roster** — shift pagi/siang/malam  
- **LO / DOG** — 2 shift (07–19 / 19–07), on/off duty  
- **Handover** — ringkasan + ACK; mirror activity `HANDOVER` di tiket  
- **Inbox Eskalasi** — tiket SLA/OLA butuh perhatian; aksi **Eskalasi LO**  
- **WFM** — absensi login, swap, roster Excel  

### 5.5 PM & Peak Season (`/ops/campaigns`)
- **Generate PM bulan ini** → 1 tiket `REQUEST`+`PM` per Regional Office (idempotent)  
- Playbook **Tahun Baru / Lebaran / Natal** — checklist + buffer floor + **Jalankan intensifikasi** (email)  
- Cron: `/api/cron/pm-monthly`, `/api/cron/peak-intensify`  
- Tanggal peak: `src/config/peak-season.config.ts` (update tiap tahun)

### 5.6 Dispatch cerdas (`/ops/dispatch`)
Target **1 teknisi : 25 merchant**.  
Skor = beban open ticket + home RO + standby.  
Board kapasitas per RO (understaffed / overload).  
Home RO teknisi: `src/config/dispatch.config.ts`.

### 5.7 Inventori
- `/inventory` hub → Assets, Buffer Stock, Peripherals  
- Buffer alert &lt; **10%**; mutasi deploy/recall/transfer/pooling  

### 5.8 Vendor (`/vendors`)
Master vendor + evaluasi SLA %, uptime, alokasi.

### 5.9 Config (`/config`)
OLA policies, ticket categories, locations (zona SLA + site Level A).

### 5.10 Notifications (`/notifications`)
Log email: assign, SLA, DIGEST (near-breach / peak), test SMTP.

### 5.11 Integrations (`/integration`) — Admin
SMTP / AI / API clients + panel **Monitoring → Incident**.  
Webhook: `POST /api/v1/monitoring/events` (scope `monitoring:ingest`).  
Demo key: `edc_sk_demo_monitoring_change_me`.

### 5.12 Admin Users (`/admin/users`)
CRUD user + role (termasuk LIAISON).

---

## 6. Aturan bisnis (config)

| Aturan | Nilai / lokasi |
|--------|----------------|
| Peak Dalam Kota | 06.01–21.00 WIB · `sla.config.ts` |
| VIP peak resolution | 2 jam |
| Warning | 80% elapsed |
| Clock-stop sensitif | `sla-pause.config.ts` |
| Near-breach audit | jam 16 WIB |
| Uptime | 99.9% |
| Buffer min | 10% RO |
| Dispatch ratio | 1:25 · `dispatch.config.ts` |
| LO shifts | DAY_DOG / NIGHT_DOG · `liaison.config.ts` |

---

## 7. Alur tipikal

### NOC — tiket CM
1. Login (WFM punch jika ber-roster)  
2. Ticketing → Acknowledge → Dispatch (pilih saran teknisi)  
3. Jika hold BRI: Clock-stop (alasan biasa langsung; ★ tunggu approval)  
4. Jam 16:00 cek `/ops/near-breach` / digest  

### Liaison LO
1. Tab LO/DOG → On duty  
2. Inbox eskalasi → koordinasi / Eskalasi LO  
3. Akhir shift → Handover + ACK penerima  

### Supervisor
1. Approve clock-stop ★  
2. Approve swap WFM  
3. Intensifikasi peak / pantau kapasitas dispatch  

### Ops Manager
1. Generate PM bulanan  
2. Peak playbook + reporting export  
3. Tune OLA / lokasi / kategori  

---

## 8. Menjalankan

```bash
# Lokal
npm install && cp .env.example .env
npm run db:generate && npm run db:push && npm run db:seed
npm run dev

# Docker
cp .env.docker.example .env
docker compose up --build -d
```

Env penting: `DATABASE_URL`, `AUTH_SECRET`, SMTP opsional, `CRON_SECRET` untuk job terjadwal.

---

## 9. Troubleshooting

| Gejala | Cek |
|--------|-----|
| Menu kosong | Role/permission; refresh session |
| Clock-stop tidak menghentikan timer | Alasan ★ masih PENDING approval |
| Digest “already sent” | Idempotent per hari WIB; pakai Kirim ulang / `?force=1` |
| Monitoring tidak buat tiket | Severity harus CRITICAL/MAJOR; scope `monitoring:ingest` |
| PM generate 0 tiket baru | Sudah ada `externalTicketId` periode yang sama |
| Dispatch understaffed | Tambah VENDOR_TECH / sesuaikan `TECH_HOME_RO` |
| Cron 401 | Set `CRON_SECRET` + Bearer header |

---

## 10. Kepemilikan

Dokumen internal proyek EDC 3 tahun. Perubahan aturan bisnis lewat config/DB + Ops Manager/Admin — bukan hardcode UI.
