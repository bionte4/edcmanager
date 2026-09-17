# Deploy EDC Manager di VPS

Panduan deploy produksi: **Docker Compose** + **Nginx** + **HTTPS (Let's Encrypt)** + **cron jobs**.

Asumsi OS: **Ubuntu 22.04 / 24.04 LTS**.

---

## 0. Persiapan

| Item | Rekomendasi |
|------|-------------|
| VPS | 2 vCPU · 2–4 GB RAM · 20+ GB SSD |
| Domain | A record → IP VPS |
| Port publik | **80**, **443**, **22** |

Data operasional ada di **Postgres** (Prisma). Setelah update schema, jalankan `db push` / seed sesuai catatan rilis.

---

## 1. Siapkan VPS

```bash
ssh user@IP_VPS
sudo apt update && sudo apt upgrade -y
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable

curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
# re-login

sudo apt install -y nginx certbot python3-certbot-nginx
```

---

## 2. Clone & env

```bash
sudo mkdir -p /opt/edcmanager
sudo chown $USER:$USER /opt/edcmanager
cd /opt/edcmanager
git clone https://github.com/bionte4/edcmanager.git .
cp .env.docker.example .env
nano .env
```

Isi minimal:

```env
AUTH_SECRET=<openssl rand -base64 48>
POSTGRES_PASSWORD=<password kuat>
APP_URL=https://edc.perusahaan.com

# SMTP (opsional — tanpa ini email SIMULATED ke NotificationLog)
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=EDC Manager <noreply@domain.com>
NOTIFY_SUPERVISOR_EMAIL=...
NOTIFY_OPS_EMAIL=...
NOTIFY_NOC_EMAIL=...

# Cron jobs (wajib untuk digest / PM / peak)
CRON_SECRET=<openssl rand -hex 32>

AI_INSIGHTS_ENABLED=true
AI_PROVIDER=heuristic
```

Entrypoint image biasanya menjalankan `prisma db push` saat start. Setelah pull fitur baru:

```bash
docker compose exec app npx prisma db push
docker compose exec app npm run db:seed   # opsional / pertama kali
```

---

## 3. Docker Compose produksi

Gunakan override agar DB tidak publik dan app hanya di localhost:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d
docker compose ps
curl -I http://127.0.0.1:3000/login
```

Pastikan PORTS app: `127.0.0.1:3000->3000/tcp`.

Login awal: `admin@edc.local` / `edc123` — **ganti password** via Admin Users.

Pastikan `CRON_SECRET` ikut di environment service `app` (docker-compose / `.env`).

---

## 4. Nginx + HTTPS

```nginx
server {
    listen 80;
    server_name edc.perusahaan.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 60s;
    }
}
```

```bash
sudo ln -sf /etc/nginx/sites-available/edcmanager /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d edc.perusahaan.com
```

---

## 5. Cron (host atau container)

Jadwalkan dari **host** (curl ke app lokal) atau cron container. Contoh crontab host (WIB = UTC+7):

```cron
# Near-breach digest ~16:05 WIB = 09:05 UTC
5 9 * * * curl -sS -X POST -H "Authorization: Bearer $CRON_SECRET" \
  http://127.0.0.1:3000/api/cron/near-breach-digest >/dev/null

# PM bulanan — tanggal 1 jam 01:00 WIB = 18:00 UTC hari sebelumnya
0 18 28-31 * * [ "$(date -d tomorrow +\%d)" = "01" ] && \
  curl -sS -X POST -H "Authorization: Bearer $CRON_SECRET" \
  http://127.0.0.1:3000/api/cron/pm-monthly

# Peak intensify — setiap hari 08:00 WIB = 01:00 UTC
0 1 * * * curl -sS -X POST -H "Authorization: Bearer $CRON_SECRET" \
  http://127.0.0.1:3000/api/cron/peak-intensify >/dev/null
```

Export `CRON_SECRET` di environment cron user, atau hardcode sementara (kurang aman).

Uji manual:

```bash
curl -sS -X POST -H "Authorization: Bearer $CRON_SECRET" \
  "http://127.0.0.1:3000/api/cron/near-breach-digest?ignoreWindow=1&force=1"
```

---

## 6. Update dari GitHub

```bash
cd /opt/edcmanager
git pull origin main
docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d
docker compose exec app npx prisma db push
# docker compose exec app npm run db:seed   # hanya jika perlu data demo baru
docker compose logs -f --tail=100 app
```

---

## 7. Backup Postgres

```bash
docker compose exec -T db pg_dump -U postgres edcmanager > backup-$(date +%F).sql
cat backup-YYYY-MM-DD.sql | docker compose exec -T db psql -U postgres edcmanager
```

---

## 8. Checklist go-live

- [ ] `AUTH_SECRET` & `POSTGRES_PASSWORD` kuat  
- [ ] `CRON_SECRET` set + crontab aktif  
- [ ] Port 5432 tidak publik; app hanya `127.0.0.1:3000`  
- [ ] HTTPS + `X-Forwarded-Proto`  
- [ ] Password demo diganti  
- [ ] Rotasi API key Integration / monitoring  
- [ ] SMTP production diuji  
- [ ] `prisma db push` setelah rilis schema baru  

---

## 9. Troubleshooting

| Gejala | Tindakan |
|--------|----------|
| 502 | App belum ready; cek `docker compose logs app` |
| Menu kosong | Cookie Secure + `X-Forwarded-Proto` |
| Cron 401 | `CRON_SECRET` mismatch / tidak di-inject ke container |
| Schema error | `npx prisma db push` di dalam container app |
| Digest kosong | Di luar jendela 16:00 — pakai `?ignoreWindow=1` untuk uji |
| OOM build | Tambah swap 2G |

---

## 10. Arsitektur

```text
Internet → Nginx :443 → App :3000 → Postgres :5432 (internal)
                ↑
         host cron (curl + CRON_SECRET)
```

Dokumen: [Manual](./MANUAL.md) · [ERD](./ERD.md) · [README](../README.md)
