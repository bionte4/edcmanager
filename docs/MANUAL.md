# EDC Manager — Manual Guide

Panduan operasional untuk pengguna aplikasi **EDC Manager** (command center vendor, SLA/OLA, logistik, dan WFM).

Repo: [github.com/bionte4/edcmanager](https://github.com/bionte4/edcmanager)

Dokumentasi terkait: [ERD](./ERD.md) · [README](../README.md)

---

## 1. Ringkasan

EDC Manager membantu tim operasi:

- Memantau **SLA** kontrak (resolusi tiket, warning 80%, breach)
- Mengukur **OLA** internal (Acknowledge NOC & Dispatch vendor)
- Mengelola **ticketing ITSM**, **roster/WFM**, **assets**, **buffer stock**
- Mengevaluasi **vendor**, mengirim **notifikasi SMTP**, dan **Integration API**
- Melihat **reporting** operasional + export Excel

Aplikasi bersifat **responsive / PWA-ready**: desktop (wall monitor), tablet, dan HP.

> UI demo saat ini memakai data **in-memory / mock**. Schema PostgreSQL (Prisma) sudah disiapkan untuk produksi — lihat ERD.

---

## 2. Login & akses

1. Buka aplikasi → `/login`
2. Masukkan email + password
3. Setelah login, menu menyesuaikan **role (RBAC)**

### Akun demo (password: `edc123`)

| Email | Role |
|--------|------|
| `admin@edc.local` | Administrator |
| `andi.noc@edc.local` | NOC / L1 |
| `siti.noc@edc.local` | NOC / L1 |
| `budi.noc@edc.local` | NOC / L1 |
| `dewi.supervisor@edc.local` | Supervisor |
| `rudi.ops@edc.local` | Ops Manager |
| `eko.tech@edc.local` | Vendor Tech |

Logout: tombol **Logout** di header (HP: ikon keluar).

---

## 3. Matriks menu per role

| Modul | ADMIN | OPS_MANAGER | SUPERVISOR | NOC | VENDOR_TECH |
|--------|:-----:|:-----------:|:----------:|:---:|:-----------:|
| Dashboard | ✓ | ✓ | ✓ | ✓ | ✓ |
| Ticketing | ✓ | ✓ | ✓ | ✓ | ✓ (update terbatas) |
| NOC Roster | ✓ | — | ✓ | ✓ | — |
| WFM | ✓ | ✓ | ✓ | — | — |
| OLA | ✓ | ✓ CRUD | ✓ read | — | — |
| Reporting | ✓ | ✓ + export | ✓ + export | — | — |
| Assets | ✓ | ✓ | ✓ | — | ✓ read |
| Buffer Stock | ✓ | ✓ | ✓ | — | ✓ read |
| Evaluasi Vendor | ✓ | ✓ | — | — | — |
| Notifications | ✓ | ✓ | ✓ | ✓ | — |
| Integrations | ✓ | — | — | — | — |
| Admin Users | ✓ | — | — | — | — |

Permission keys lengkap ada di `src/config/rbac.config.ts`.

---

## 4. Navigasi perangkat

### Desktop / tablet (≥ md)
- Nav horizontal di header
- Tabel padat untuk antrian tiket & roster

### HP / mobile
- **Bottom nav:** Home · Tiket · WFM · Notif · More
- **Hamburger / More:** drawer semua menu sesuai RBAC
- **Ticketing:** antrian kartu → tap → bottom sheet aksi
- Safe-area untuk notch / home indicator
- Bisa **Add to Home Screen** (PWA manifest)

---

## 5. Modul operasional

### 5.1 Dashboard (`/`)
KPI: tiket aktif, uptime vs **99.9%**, mendekati breach SLA, kesehatan buffer RO (≥ **10%**).

### 5.2 Ticketing (`/ticketing`)
1. Filter ITSM: Incident / Request / Problem / Change  
2. Buat tiket (merchant, lokasi, VIP/Non-VIP, deskripsi)  
3. Assign NOC owner  
4. Transisi status: `OPEN → ACKNOWLEDGED → DISPATCHED → IN_PROGRESS → RESOLVED → CLOSED`  
5. Pantau badge **SLA** (kontrak) dan **OLA Ack / OLA Disp** (internal)  
6. Opsional: link Incident → Problem; AI Insight + notifikasi SMTP  

**SLA penting:** Dalam Kota + VIP + peak **06.01–21.00 WIB** → resolusi **2 jam**. Warning di **80%** elapsed.

### 5.3 NOC Roster (`/noc`)
Lihat personil & status duty shift pagi/siang/malam.

### 5.4 WFM (`/wfm`)
- Kehadiran otomatis saat **login** NOC/Supervisor yang ber-roster  
- Tukar shift + approval (Supervisor / Ops / Admin)  
- Roster **mingguan / bulanan** via Excel  

**Format Excel roster**

| Kolom | Contoh | Keterangan |
|--------|--------|------------|
| `shiftDate` | `2026-09-17` | YYYY-MM-DD |
| `email` | `andi.noc@edc.local` | User aktif NOC/SUPERVISOR |
| `shiftType` | `MORNING` | `MORNING` / `AFTERNOON` / `NIGHT` |
| `status` | `SCHEDULED` | opsional |
| `notes` | … | opsional |

Mode import: **Merge** (upsert) atau **Replace** (hapus dulu rentang tanggal file).  
Upload membutuhkan `noc:manage_shift` atau `wfm:approve`.

### 5.5 OLA (`/ola`)
Policy jam internal **Acknowledge** & **Dispatch**. Match paling spesifik + priority tertinggi menang. CRUD: Admin / Ops Manager.

### 5.6 Reporting (`/reporting`)
Snapshot SLA/OLA, vendor, buffer, WFM. Export Excel multi-sheet (`report:export`).

### 5.7 Assets (`/assets`)
Master unit EDC + mutasi status. Excel import/export: `serialNumber | brand | regionalOffice | status | merchantId | vendorName | notes`.

### 5.8 Buffer Stock (`/buffer-stock`)
Pantau % buffer per RO; alert jika &lt; 10%. Mutasi deploy / recall / transfer / pooling.

### 5.9 Evaluasi Vendor (`/evaluasi-vendor`)
Bandingkan Vendor 1 vs Vendor 2: SLA %, resolusi, breach, uptime, allocation.

### 5.10 Notifications (`/notifications`)
Log email assign / SLA warning / breach (mode simulasi atau SMTP nyata).

### 5.11 Integrations (`/integration`) — Admin
Kartu Email / SMTP / AI / API Clients. CRUD client + API key untuk sistem eksternal.

**Integration API v1:** `/api/v1/tickets`  
Auth: `Authorization: Bearer <apiKey>` atau `X-Api-Key`  
Demo key Service Desk: `edc_sk_demo_servicedesk_change_me`

### 5.12 Admin Users (`/admin/users`)
CRUD user, role, aktif/nonaktif. Hanya `admin:access`.

---

## 6. Aturan bisnis (sumber config)

Jangan hardcode di UI — ubah di `src/config/` atau DB:

| Aturan | Nilai |
|--------|--------|
| Peak Dalam Kota | 06.01–21.00 Asia/Jakarta |
| VIP peak resolution | 2 jam |
| Warning threshold | 80% elapsed |
| Uptime target | 99.9% |
| Buffer minimum | 10% per RO |
| OLA warning | 80% (per policy) |

---

## 7. Alur kerja tipikal

### NOC / L1 — tiket masuk
1. Login → absensi WFM tercatat jika ada roster hari ini  
2. Buka Ticketing → filter Incident  
3. Acknowledge (OLA Ack mulai dihitung dari `openedAt`)  
4. Assign teknisi / Dispatch (OLA Disp)  
5. Update sampai Resolved / Closed  

### Supervisor — eskalasi & swap
1. Pantau badge Warning/Breached (SLA & OLA)  
2. Approve/reject tukar shift di WFM  
3. Upload roster Excel mingguan/bulanan  

### Ops Manager — kontrol performa
1. Reporting + export  
2. OLA policy tune  
3. Buffer / Assets / Vendor review  

---

## 8. Menjalankan aplikasi

### Docker
```bash
cp .env.docker.example .env   # opsional
docker compose up --build -d
# http://localhost:3000
```

### Lokal (Node 20+)
```bash
npm install
cp .env.example .env
npm run dev
```

Detail env, Prisma, dan script: lihat [README](../README.md).

---

## 9. Troubleshooting singkat

| Gejala | Cek |
|--------|-----|
| Menu kosong setelah login | Refresh / pastikan cookie session; role punya permission |
| Logout kembali ke app | Pastikan cookie terhapus; gunakan tombol Logout resmi |
| Upload roster gagal | Email harus user NOC/SUPERVISOR; format tanggal YYYY-MM-DD |
| SMTP tidak terkirim | Mode simulasi di Integrations; isi SMTP di connector settings |
| Docker gagal | Pastikan Docker Desktop running (`docker.sock`) |

---

## 10. Kontak / kepemilikan

Dokumen internal proyek EDC 3 tahun. Perubahan aturan SLA/OLA melalui Ops Manager + Admin (config / policy CRUD), bukan hardcode di komponen UI.
