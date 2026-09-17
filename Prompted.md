### Prompt 1: Inisialisasi Struktur Database (Prisma & PostgreSQL)
Buatkan skema database menggunakan Prisma ORM (PostgreSQL) untuk aplikasi manajemen vendor dan SLA EDC BRI. 
Model yang harus dibuat meliputi:
1. Vendor: Menyimpan data vendor (Nama, Kontak, Tipe seperti Distributor/FMS, Alokasi kuota).
2. EDCUnit: Menyimpan inventaris perangkat EDC (Serial Number, Merek, Lokasi/RO, Status: Buffer/Deployed/Idle, Riwayat mutasi).
3. Ticket: Menyimpan data Corrective Maintenance & Uptime (Nomor Tiket, Merchant ID, Lokasi (Dalam Kota/Luar Kota/Luar Pulau), Kategori VIP/Non-VIP, Waktu Tiket Masuk, Waktu Selesai, Status SLA (Achieved/Breached)).
4. MetricLog: Untuk mencatat performa harian vendor terhadap target uptime 99,9%.
Pastikan relasi antar tabel terhubung dengan baik dan gunakan tipe data yang optimal.

### Step 2: Membuat Engine Penghitung SLA & Pencegah Penalti (Backend Logic)
Buatkan fungsi helper / business logic di backend (TypeScript/Node.js) untuk menghitung dan memvalidasi SLA berdasarkan Annex 3 proyek EDC BRI:
1. Hitung durasi penyelesaian tiket sejak "Tiket Masuk" hingga "Tiket Selesai".
2. Terapkan aturan waktu khusus untuk "Dalam Kota" kategori VIP pada jam sibuk (06.01 - 21.00) dengan batas maksimal resolusi tepat 2 jam.
3. Buat fungsi deteksi otomatis (Flagging): Jika waktu berjalan mencapai 80% dari batas SLA (misal: 1 jam 36 menit untuk limit 2 jam), berikan status "Warning", dan "Breached" jika melewati batas.
4. Buat fungsi untuk generate laporan persentase uptime bulanan terhadap standar 99,9% untuk menghindari penalti.

### Step 3: Membuat Dashboard Operasional (Frontend Next.js & Tailwind)
Buatkan halaman Dashboard Utama (Next.js App Router & Tailwind CSS dengan gaya Command Center / Dark-Light Mode) yang menampilkan:
1. Kartu Metrik Utama (KPI): Total Tiket Aktif, Persentase Uptime Real-time (Target 99,9%), Jumlah Tiket Mendekati SLA Breach, dan Status Buffer Stock (Minimal 10% per Regional Office).
2. Tabel Daftar Tiket Masuk (Corrective Maintenance) dengan indikator warna badge untuk status SLA (Aman, Warning, Breached).
3. Filter cepat berdasarkan lokasi (Dalam Kota, Luar Kota, Luar Pulau) dan kategori VIP/Non-VIP.
Gunakan komponen dari Shadcn UI dan ikon dari Lucide React agar tampilannya bersih, profesional, dan padat informasi.

### Step 4: Membuat Modul Manajemen Vendor & Buffer Stock Logistik
Buatkan halaman manajemen logistik dan vendor terpisah di aplikasi yang sama:
1. Modul Buffer Stock: Menampilkan tabel distribusi stok cadangan EDC (10%) di setiap Regional Office (RO) beserta tombol untuk melakukan mutasi/pooling unit jika stok menipis.
2. Modul Evaluasi Vendor: Menampilkan ringkasan performa vendor (Vendor 1 vs Vendor 2) berdasarkan kecepatan penyelesaian tiket (SLA Compliance Rate) dan jumlah kendala operasional per bulan.

### Step 5: Modul NOC Standby & Ticketing System
Buatkan modul operasional untuk command center:
1. Model User (NOC/Supervisor/Vendor Tech/Ops Manager), NocShift (roster standby), dan TicketActivity (audit trail); perluas lifecycle Ticket (Open → Acknowledged → Dispatched → In Progress → Resolved → Closed).
2. Halaman NOC Roster: siapa on-duty per shift (pagi/siang/malam) + directory personil.
3. Halaman Ticketing: create tiket, assign ke NOC owner, update status lifecycle, tampilkan activity log dan flag eskalasi SLA Warning/Breached.
