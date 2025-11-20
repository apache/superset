# Quick Start: Build and Run Custom Superset Image

## 🚀 One-Command Setup

### Windows:
```cmd
build-and-run-custom.bat
```

### Linux/Mac:
```bash
./build-and-run-custom.sh
```

This script will:
1. ✅ Build your custom Docker image
2. ✅ Create `.env` file if needed
3. ✅ Start all services with Docker Compose
4. ✅ Show you how to access Superset

---

## 📋 Manual Steps

### 1. Build Image

**Windows:**
```cmd
docker build --target lean --tag superset-custom:latest --build-arg BUILD_TRANSLATIONS=false --build-arg DEV_MODE=false --progress=plain .
```

**Linux/Mac:**
```bash
docker build \
  --target lean \
  --tag superset-custom:latest \
  --build-arg BUILD_TRANSLATIONS=false \
  --build-arg DEV_MODE=false \
  --progress=plain \
  .
```

### 2. Run with Docker Compose

```bash
docker-compose -f docker-compose.custom.yml up -d
```

### 3. Access Superset

- **URL:** http://localhost:8088
- **Username:** `admin`
- **Password:** `admin` (change immediately!)

---

## 📝 What's Included

The updated `docker-compose.custom.yml` includes:

- ✅ **PostgreSQL** - Metadata database
- ✅ **Redis** - Cache and message broker
- ✅ **Superset Init** - Database initialization
- ✅ **Superset App** - Main application (Gunicorn)
- ✅ **Superset Worker** - Celery worker for async tasks
- ✅ **Superset Worker Beat** - Scheduler for reports/alerts

All services use your custom `superset-custom:latest` image!

---

## 🔧 Useful Commands

```bash
# View logs
docker-compose -f docker-compose.custom.yml logs -f

# Stop services
docker-compose -f docker-compose.custom.yml down

# Restart services
docker-compose -f docker-compose.custom.yml restart

# Check status
docker-compose -f docker-compose.custom.yml ps

# Rebuild and restart
docker build --target lean --tag superset-custom:latest --build-arg BUILD_TRANSLATIONS=false --build-arg DEV_MODE=false .
docker-compose -f docker-compose.custom.yml restart
```

---

## 📚 Full Documentation

See `BUILD_AND_RUN_CUSTOM_IMAGE.md` for complete documentation.

