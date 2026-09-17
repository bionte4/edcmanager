# EDC Manager — User Guide

Panduan untuk **pengguna operasional** (NOC, Supervisor, Ops, Liaison, Teknisi, Admin, GM).  
Bahasa sederhana — fokus *apa yang diklik* dan *kapan*, bukan teknis server.

Dokumen teknis: [Manual](./MANUAL.md) · [Deploy](./DEPLOY-VPS.md) · [ERD](./ERD.md)

---

## 1. Apa itu EDC Manager?

Aplikasi internal untuk proyek EDC agar tim operasi:

- Menangani tiket perbaikan (Incident / CM) tanpa melewatkan **SLA**
- Mengatur shift NOC & Liaison (LO)
- Memantau stok buffer EDC per kantor wilayah (RO)
- Menjalankan PM bulanan & playbook musim ramai (Natal / Tahun Baru / Lebaran)
- Menyaranakan teknisi lapangan (rasio 1 teknisi : 25 merchant)

**Tujuan utama:** hindari penalti SLA (terutama VIP Dalam Kota peak → resolusi **2 jam**).

---

## 2. Login

1. Buka alamat aplikasi yang diberikan Admin (contoh: `https://edc.…/login`)
2. Masukkan **email** + **password**
3. Menu yang muncul mengikuti **peran** Anda

| Demo (lingkungan uji) | Peran |
|------------------------|--------|
| `andi.noc@edc.local` | NOC |
| `dewi.supervisor@edc.local` | Supervisor |
| `rudi.ops@edc.local` | Ops Manager |
| `farah.lo@edc.local` | Liaison LO |
| `eko.tech@edc.local` | Vendor Tech |
| `admin@edc.local` | Admin |
| `hendra.gm@edc.local` | GM |

Password demo: `edc123` — **ganti** di production.

Keluar: tombol **Logout** di kanan atas.

---

## 3. Navigasi cepat

| Elemen | Fungsi |
|--------|--------|
| Strip menu atas | Modul utama (Dasbor, Tiket, Near-breach, …) |
| **Lainnya** | Modul tambahan (Vendor, Config, PM/Peak, Dispatch, …) |
| **Ikon lonceng** | Log notifikasi email (`/notifications`) |
| Toggle tema | Mode gelap / terang |
| Nama + peran | Di sebelah lonceng (desktop) |

Di HP: menu bawah + drawer.

---

## 4. Arti badge penting

### SLA (kontrak / penalti)

| Badge | Artinya |
|-------|---------|
| **On Track** | Masih aman |
| **Warning** | Sudah ≥ **80%** waktu SLA terpakai — prioritaskan |
| **Breached** | Lewat deadline — eskalasi segera |
| **Achieved** | Selesai dalam SLA |

VIP **Dalam Kota** jam peak (**06.01–21.00 WIB**): target resolusi **2 jam**.

### OLA (jam internal)

- **Ack** — waktu Acknowledge NOC  
- **Disp** — waktu Dispatch ke vendor/teknisi  

### Clock-stop

Timer SLA di-pause (mis. tunggu BRI / force majeure).  
Alasan bertanda ★ butuh **persetujuan Supervisor** dulu baru timer berhenti.

---

## 5. Panduan per peran

### 5.1 NOC (L1)

**Fokus harian:** buka → acknowledge → dispatch → pantau SLA.

1. **Dasbor** — lihat tiket warning/breach & ringkasan  
2. **Tiket** (`/ticketing`)
   - Filter Incident / CM yang OPEN  
   - **Acknowledge** lalu **Dispatch**  
   - Pakai chip **saran teknisi** jika muncul (skor beban + home RO)  
   - Jika hold BRI: **Clock-stop** (pilih alasan; ★ tunggu approval)  
3. Jam **16:00** buka **Near-breach** — review antrian WARNING/BREACHED  
4. **Workforce** → tab NOC: cek roster shift Anda  
5. Bila perlu LO: di tiket / Inbox, aksi **Eskalasi LO**

### 5.2 Supervisor

**Fokus:** approval + pengawasan SLA.

1. Approve **clock-stop ★** yang PENDING (Tiket / Near-breach)  
2. Approve **swap shift** di Workforce → WFM  
3. Pantau **Near-breach** & digest email  
4. Peak season: bantu Ops jalankan intensifikasi jika diminta  

### 5.3 Ops Manager

**Fokus:** kampanye, kapasitas, master operasi.

1. **PM / Peak** (`/ops/campaigns` — menu Lainnya)
   - **Settings PM:** set hari generate + RO yang ikut  
   - **Generate PM bulan ini** bila belum jalan  
   - **Master peak:** tambah/edit tanggal Natal / TB / Lebaran (2028–2031+)  
   - **Jalankan intensifikasi** saat window aktif / mendekati  
2. **Dispatch** — cek RO understaffed / overload  
3. **Pelaporan** / **Executive** — ekspor & review uptime  
4. **Config** — OLA, kategori, lokasi (bila berwenang)  

### 5.4 Liaison LO

**Fokus:** shift DOG + eskalasi + serah terima.

1. **Workforce** → tab **LO / DOG**
   - Set **On duty** di shift Anda (siang 07–19 / malam 19–07)  
2. Tab **Inbox Eskalasi** — kerjakan tiket yang diarahkan ke LO  
3. Akhir shift: tab **Handover** — isi ringkasan; penerima **ACK**  
4. Pantau **Near-breach** & Tiket VIP bila di-escalate  

### 5.5 Vendor Tech (teknisi lapangan)

**Fokus:** update progress tiket yang ditugaskan.

1. **Tiket** — filter tiket Anda / update status (In Progress → Resolved)  
2. **Inventori** — lihat stok (biasanya read-only)  
3. Home RO & standby diatur **Admin** di profil Anda — memengaruhi saran dispatch  

### 5.6 Admin

**Fokus:** user & integrasi.

1. **Admin Users** — buat/edit user, role, aktif/nonaktif  
2. Untuk teknisi (`VENDOR_TECH`): centang **Home RO** + **Field standby**  
3. **Integrasi** — SMTP, API key, monitoring  
4. Pastikan password demo diganti di production  

### 5.7 GM / BOD

**Fokus:** baca, tidak operasi harian.

1. **Executive** — KPI & tren  
2. **Pelaporan** / **Vendor** — evaluasi performa  

---

## 6. Ritual operasional (checklist)

### Setiap shift NOC
- [ ] Login + cek roster  
- [ ] Clear tiket OPEN / WARNING  
- [ ] Ack + Dispatch tepat waktu (OLA)  
- [ ] Clock-stop hanya jika ada hold resmi  

### Setiap hari ~16:00
- [ ] Buka **Near-breach**  
- [ ] Clock-stop / realokasi / eskalasi LO  
- [ ] Pastikan digest terkirim (atau klik Kirim digest)  

### Awal bulan
- [ ] Ops: cek Settings PM → **Generate PM** (atau biarkan cron)  
- [ ] Pastikan tiket PM muncul per RO aktif  

### Menjelang Natal / Tahun Baru / Lebaran
- [ ] Ops: pastikan tanggal window di master peak sudah benar  
- [ ] Jalankan intensifikasi + naikkan perhatian buffer / VIP  

### Ganti teknisi / RO coverage
- [ ] Admin: edit user → Home RO + Standby  
- [ ] Ops: cek board **Dispatch** understaffed  

---

## 7. Modul ringkas (peta layar)

| Menu | Untuk apa |
|------|-----------|
| Dasbor | Ringkasan KPI hari ini |
| Executive | Pandangan manajemen |
| Tiket | Semua tiket ITSM + SLA/OLA + clock-stop |
| Near-breach | Antrian kritis jam 16:00 |
| Workforce | Roster NOC, LO DOG, handover, WFM |
| Inventori | Assets, buffer ≥10%, peripherals |
| Pelaporan | Laporan & export |
| PM / Peak (Lainnya) | Settings PM, generate, kalender peak |
| Dispatch (Lainnya) | Kapasitas RO + saran teknisi |
| Vendor | Master & skor vendor |
| Konfigurasi | OLA, kategori, lokasi |
| Lonceng | Log email notifikasi |
| Admin Users | User + home RO teknisi |
| Integrasi | SMTP / API / monitoring (Admin) |

---

## 8. FAQ pengguna

**Q: Kenapa timer SLA tidak berhenti setelah Clock-stop?**  
A: Alasan ★ masih menunggu approval Supervisor. Cek status pause = PENDING.

**Q: Kenapa saya tidak melihat menu tertentu?**  
A: Peran Anda tidak punya akses. Hubungi Admin / Ops.

**Q: Di mana notifikasi?**  
A: Ikon **lonceng** di header (bukan di strip menu).

**Q: Generate PM tidak membuat tiket baru?**  
A: Periode itu mungkin sudah digenerate. Cek juga Settings PM — RO harus dicentang aktif.

**Q: Saran dispatch kosong / salah RO?**  
A: Admin harus mengisi Home RO di profil VENDOR_TECH.

**Q: Near-breach kosong padahal ada warning?**  
A: Tiket yang sedang clock-stop (efektif) tidak masuk antrian.

---

## 9. Kontak & eskalasi internal

| Masalah | Hubungi |
|---------|---------|
| Akses login / user baru | Admin |
| Aturan SLA / OLA / lokasi | Ops Manager |
| Approval clock-stop / swap | Supervisor |
| Koordinasi lapangan VIP / peak | Liaison LO |
| Bug aplikasi / server | Admin / IT internal |

---

## 10. Catatan keamanan

- Jangan bagikan password  
- Logout di komputer bersama  
- Jangan kirim API key / data merchant ke luar kanal resmi  
- Gunakan alasan clock-stop yang benar — mempengaruhi perhitungan penalti  

---

*User Guide EDC Manager · untuk pengguna operasional. Untuk detail teknis & RBAC lengkap lihat [MANUAL.md](./MANUAL.md).*
