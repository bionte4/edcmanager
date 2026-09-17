# Deploy EDC Manager di VPS

Panduan step-by-step deploy produksi dengan **Docker Compose** + **Nginx** + **HTTPS (Let's Encrypt)**.

Asumsi OS: **Ubuntu 22.04 / 24.04 LTS**. Pola serupa untuk Debian.

---

## 0. Yang perlu disiapkan

| Item | Rekomendasi |
|------|-------------|
| VPS | 2 vCPU · 2–4 GB RAM · 20+ GB SSD |
| OS | Ubuntu 22.04/24.04 |
| Domain | mis. `edc.perusahaan.com` → A record ke IP VPS |
| Akses | SSH key (jangan root password saja) |
| Port publik | **80**, **443** (dan **22** untuk SSH) |

> **Catatan penting:** UI demo masih memakai banyak data **in-memory**. Restart container app bisa mengosongkan tiket/roster/OLA runtime. Schema Postgres sudah di-push, tapi persistensi penuh ke DB masih bertahap. Untuk demo internal / UAT ini sudah cukup; untuk produksi penuh nanti data harus lewat Prisma store.

---

## 1. Siapkan VPS

```bash
# Login
ssh user@IP_VPS

# Update
sudo apt update && sudo apt upgrade -y

# Firewall
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status
```

### Install Docker

```bash
# Resmi Docker (ringkas)
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
# logout / login ulang agar group docker aktif
docker --version
docker compose version
```

### Install Nginx + Certbot

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
```

---

## 2. Clone repo & env produksi

```bash
sudo mkdir -p /opt/edcmanager
sudo chown $USER:$USER /opt/edcmanager
cd /opt/edcmanager

git clone https://github.com/bionte4/edcmanager.git .
# atau: git clone ... edcmanager && cd edcmanager
```

Buat file `.env` (jangan commit):

```bash
cp .env.docker.example .env
nano .env
```

Isi minimal yang **wajib diganti**:

```env
# Generate: openssl rand -base64 48
AUTH_SECRET=GANTI_DENGAN_SECRET_PANJANG_ACAK

# Password Postgres kuat
POSTGRES_PASSWORD=GANTI_PASSWORD_DB_KUAT

# Opsional SMTP
SMTP_HOST=smtp.contoh.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=...
SMTP_PASS=...
SMTP_FROM=EDC Manager <noreply@domain.com>

# AI (opsional)
AI_INSIGHTS_ENABLED=true
AI_PROVIDER=heuristic
# AI_PROVIDER=openai
# AI_API_KEY=sk-...
# AI_MODEL=gpt-4o-mini
```

---

## 3. Hardening Docker untuk VPS

Edit `docker-compose.yml` (atau buat override) agar:

1. **Postgres tidak terbuka ke internet** (hanya jaringan internal Docker / localhost)
2. **Password DB** dari `.env`
3. App tetap di port 3000 **hanya lokal** (Nginx yang expose 443)

Contoh override — simpan sebagai `docker-compose.prod.yml`:

```yaml
services:
  db:
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?set POSTGRES_PASSWORD in .env}
      POSTGRES_DB: edcmanager
    # Jangan publish 5432 ke 0.0.0.0 — hapus mapping publik
    ports: []
    # Jika butuh akses admin dari VPS saja, ganti jadi:
    # ports:
    #   - "127.0.0.1:5432:5432"

  app:
    ports:
      - "127.0.0.1:3000:3000"
    environment:
      AUTH_SECRET: ${AUTH_SECRET:?set AUTH_SECRET in .env}
      DATABASE_URL: postgresql://postgres:${POSTGRES_PASSWORD}@db:5432/edcmanager?schema=public
      SMTP_HOST: ${SMTP_HOST:-}
      SMTP_PORT: ${SMTP_PORT:-587}
      SMTP_SECURE: ${SMTP_SECURE:-false}
      SMTP_USER: ${SMTP_USER:-}
      SMTP_PASS: ${SMTP_PASS:-}
      SMTP_FROM: ${SMTP_FROM:-EDC Manager <noreply@edc.local>}
      AI_INSIGHTS_ENABLED: ${AI_INSIGHTS_ENABLED:-true}
      AI_PROVIDER: ${AI_PROVIDER:-heuristic}
      AI_API_KEY: ${AI_API_KEY:-}
      AI_MODEL: ${AI_MODEL:-gpt-4o-mini}
```

> Compose v2.24+: file `docker-compose.prod.yml` memakai `ports: !reset` agar DB tidak dipublish.  
> Jika perintah gagal (Compose lama), edit `docker-compose.yml` manual: hapus `ports` pada `db`, dan set app ke `"127.0.0.1:3000:3000"`.

### Build & jalankan

```bash
cd /opt/edcmanager

docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d

# Cek
docker compose ps
docker compose logs -f app
curl -I http://127.0.0.1:3000
```

Login demo: `admin@edc.local` / `edc123` — **ganti password user via Admin Users** setelah go-live.

---

## 4. Nginx reverse proxy

Buat site:

```bash
sudo nano /etc/nginx/sites-available/edcmanager
```

Isi (ganti domain):

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

Aktifkan:

```bash
sudo ln -sf /etc/nginx/sites-available/edcmanager /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### HTTPS (Let's Encrypt)

```bash
# Pastikan DNS A record sudah mengarah ke IP VPS
sudo certbot --nginx -d edc.perusahaan.com

# Auto-renew sudah biasanya terpasang:
sudo certbot renew --dry-run
```

Buka: `https://edc.perusahaan.com`

---

## 5. Update versi baru dari GitHub

```bash
cd /opt/edcmanager
git pull origin main
docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d
docker compose logs -f --tail=100 app
```

---

## 6. Backup & restore (Postgres)

```bash
# Backup
docker compose exec -T db pg_dump -U postgres edcmanager > backup-$(date +%F).sql

# Restore
cat backup-YYYY-MM-DD.sql | docker compose exec -T db psql -U postgres edcmanager
```

Volume data: `edcmanager_pgdata` (lihat `docker volume ls`).

---

## 7. Checklist keamanan go-live

- [ ] `AUTH_SECRET` unik & panjang  
- [ ] `POSTGRES_PASSWORD` kuat; port **5432 tidak publik**  
- [ ] App hanya di `127.0.0.1:3000`; publik lewat **443**  
- [ ] UFW: hanya 22 / 80 / 443  
- [ ] HTTPS aktif (Certbot)  
- [ ] Ganti password akun demo (`edc123`)  
- [ ] Rotasi Integration API key demo  
- [ ] SMTP produksi diuji (Integrations → test)  
- [ ] Monitor disk: `df -h` · log: `docker compose logs`

---

## 8. Troubleshooting

| Gejala | Tindakan |
|--------|----------|
| `curl 127.0.0.1:3000` gagal | `docker compose ps` · `logs app` · rebuild |
| 502 Bad Gateway | App belum ready; cek proxy_pass & container health |
| Certbot gagal | DNS belum propagate; port 80 terbuka; `server_name` benar |
| DB connection error | Password `.env` vs `DATABASE_URL`; `db` healthy? |
| Menu kosong setelah login | Cookie Secure di HTTPS — pastikan `X-Forwarded-Proto` di Nginx |
| Out of memory saat build | Naikkan RAM VPS / tambah swap 2GB |

Tambah swap (jika build OOM):

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

---

## 9. Arsitektur singkat

```text
Internet
   │
   ▼
 Nginx :443 (TLS)
   │
   ▼
 App container :3000  ──►  Postgres container :5432 (internal)
```

---

## 10. Perintah cepat

```bash
# Status
docker compose ps

# Log
docker compose logs -f app
docker compose logs -f db

# Stop / start
docker compose stop
docker compose start

# Hapus stack (HATI-HATI: -v menghapus volume DB)
docker compose down
# docker compose down -v
```

Dokumen terkait: [Manual](./MANUAL.md) · [ERD](./ERD.md) · [README](../README.md)
