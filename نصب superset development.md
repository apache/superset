# راهنمای نصب Apache Superset برای توسعه

## مقدمه

Apache Superset یک پلتفرم مدرن و آماده برای سازمان‌ها جهت اکتشاف و تجسم داده‌ها است. این راهنما مراحل نصب Superset را برای محیط توسعه با استفاده از Docker Compose توضیح می‌دهد.

## پیش‌نیازها

### نرم‌افزارهای مورد نیاز:
- **Docker**: نسخه 20.10 یا بالاتر
- **Docker Compose**: نسخه 2.0 یا بالاتر
- **Git**: برای کلون کردن مخزن
- **مرورگر وب**: برای دسترسی به رابط کاربری

### بررسی نصب Docker:
```bash
docker --version
docker-compose --version
```

## مراحل نصب

### مرحله 1: کلون کردن مخزن Superset

```bash
git clone https://github.com/apache/superset.git
cd superset
```

### مرحله 2: بررسی ساختار پروژه

پس از کلون کردن، ساختار زیر را خواهید دید:
```
superset/
├── docker-compose.yml          # فایل اصلی Docker Compose
├── docker/                     # فایل‌های Docker
│   ├── .env                   # متغیرهای محیطی
│   ├── docker-bootstrap.sh    # اسکریپت راه‌اندازی
│   └── ...
├── superset/                  # کد اصلی Python
├── superset-frontend/         # کد Frontend
└── ...
```

### مرحله 3: راه‌اندازی Docker

#### الف) راه‌اندازی Docker Desktop
```bash
# در macOS
open -a Docker

# منتظر بمانید تا Docker آماده شود
sleep 10
```

#### ب) اجرای Superset با Docker Compose
```bash
docker compose up --build -d
```

### مرحله 4: بررسی وضعیت سرویس‌ها

```bash
docker ps
```

خروجی مورد انتظار:
```
CONTAINER ID   IMAGE                           COMMAND                  STATUS          PORTS
72852b3343ce   superset-superset-worker-beat   "/app/docker/docker-…"   Up 24 seconds   8088/tcp
4dacf59f6941   superset-superset-worker        "/app/docker/docker-…"   Up 24 seconds   8088/tcp
0ddc9c5ebccd   superset-superset               "/app/docker/docker-…"   Up 24 seconds   0.0.0.0:8088->8088/tcp
3cb5fc3c0f9f   superset-superset-websocket     "docker-entrypoint.s…"   Up 47 seconds   0.0.0.0:8080->8080/tcp
500f16e4594d   redis:7                         "docker-entrypoint.s…"   Up 47 seconds   127.0.0.1:6379->6379/tcp
55f3a631282d   nginx:latest                    "/docker-entrypoint.…"   Up 47 seconds   0.0.0.0:80->80/tcp
8b55cc402402   postgres:16                     "docker-entrypoint.s…"   Up 47 seconds   127.0.0.1:5432->5432/tcp
38b5f6a233d9   superset-superset-node          "docker-entrypoint.s…"   Up 47 seconds   127.0.0.1:9000->9000/tcp
```

## سرویس‌های Superset

### سرویس‌های اصلی:
- **superset_app**: سرویس اصلی Superset (پورت 8088)
- **superset_node**: سرویس Frontend Development (پورت 9000)
- **superset_websocket**: سرویس WebSocket (پورت 8080)
- **superset_worker**: پردازشگر پس‌زمینه
- **superset_worker_beat**: زمان‌بند کارها
- **superset_db**: پایگاه داده PostgreSQL (پورت 5432)
- **superset_cache**: Redis Cache (پورت 6379)
- **superset_nginx**: پروکسی معکوس (پورت 80)

## دسترسی به Superset

### آدرس‌های دسترسی:
- **رابط اصلی**: http://localhost:8088
- **Frontend Development**: http://localhost:9000
- **WebSocket**: ws://localhost:8080

### اطلاعات ورود پیش‌فرض:
- **نام کاربری**: admin
- **رمز عبور**: admin

## ویژگی‌های محیط توسعه

### Hot Reload:
- تغییرات در کد Python بلافاصله اعمال می‌شود
- تغییرات در Frontend با Webpack Dev Server مشاهده می‌شود

### Volume Mapping:
```yaml
volumes:
  - ./superset:/app/superset
  - ./superset-frontend:/app/superset-frontend
  - ./superset-core:/app/superset-core
```

### متغیرهای محیطی مهم:
```bash
DEV_MODE=true
FLASK_DEBUG=true
SUPERSET_LOG_LEVEL=info
BUILD_SUPERSET_FRONTEND_IN_DOCKER=true
```

## دستورات مفید

### مدیریت سرویس‌ها:
```bash
# شروع سرویس‌ها
docker compose up -d

# توقف سرویس‌ها
docker compose down

# مشاهده لاگ‌ها
docker compose logs -f

# بازسازی تصاویر
docker compose up --build -d
```

### دسترسی به Container:
```bash
# دسترسی به Container اصلی
docker exec -it superset_app bash

# دسترسی به Container Frontend
docker exec -it superset_node bash
```

### پاک کردن داده‌ها:
```bash
# پاک کردن تمام Containerها و Volumeها
docker compose down -v

# پاک کردن تصاویر
docker compose down --rmi all
```

## عیب‌یابی

### مشکلات رایج:

#### 1. Docker در حال اجرا نیست:
```bash
# بررسی وضعیت Docker
docker ps
# اگر خطا داد، Docker Desktop را راه‌اندازی کنید
```

#### 2. پورت‌ها در حال استفاده:
```bash
# بررسی پورت‌های استفاده شده
lsof -i :8088
lsof -i :5432
```

#### 3. مشکل در ساخت Frontend:
```bash
# بررسی لاگ‌های Node
docker compose logs superset_node
```

#### 4. مشکل در پایگاه داده:
```bash
# بررسی لاگ‌های پایگاه داده
docker compose logs superset_db
```

## توسعه و سفارشی‌سازی

### ساخت Custom Plugin:
1. ایجاد پوشه در `superset-frontend/src/plugins`
2. اضافه کردن به `superset-frontend/src/plugins/index.ts`
3. ساخت مجدد Frontend

### اضافه کردن Database Driver:
1. نصب package مورد نظر
2. اضافه کردن به `requirements/`
3. بازسازی Docker image

### تغییر تنظیمات:
1. ویرایش فایل `docker/.env-local`
2. راه‌اندازی مجدد سرویس‌ها

## نکات مهم

### امنیت:
- **هرگز** از تنظیمات پیش‌فرض در Production استفاده نکنید
- رمزهای عبور پیش‌فرض را تغییر دهید
- SECRET_KEY را به مقدار امن تغییر دهید

### عملکرد:
- برای بهبود عملکرد، `BUILD_SUPERSET_FRONTEND_IN_DOCKER=false` تنظیم کنید
- منابع سیستم را برای Containerها محدود کنید

### پشتیبان‌گیری:
- Volumeهای مهم: `superset_home`, `db_home`, `superset_data`
- تنظیمات در `docker/.env-local`

## منابع بیشتر

- [مستندات رسمی Superset](https://superset.apache.org/)
- [راهنمای توسعه](https://superset.apache.org/docs/development/)
- [GitHub Repository](https://github.com/apache/superset)
- [Docker Hub](https://hub.docker.com/r/apache/superset)

---

**تاریخ ایجاد**: 24 اکتبر 2025  
**نسخه Superset**: Latest (Master Branch)  
**محیط تست**: macOS 25.0.0, Docker 28.0.4
