# Complete docker/.env File - Copy and Paste

## Quick Copy-Paste Version

Copy this entire block to your `docker/.env` file:

```bash
# ============================================
# Apache Superset Docker Environment Configuration
# ============================================

# ============================================
# PostgreSQL Database Configuration
# Using external PostgreSQL on host via host.docker.internal
# ============================================
DATABASE_DIALECT=postgresql+psycopg2
DATABASE_USER=superset
DATABASE_PASSWORD=superset
DATABASE_HOST=host.docker.internal
DATABASE_PORT=5432
DATABASE_DB=superset

# Alternative PostgreSQL variables (also supported)
POSTGRES_USER=superset
POSTGRES_PASSWORD=superset
POSTGRES_DB=superset

# ============================================
# Redis Configuration
# Using external Redis on host via host.docker.internal
# ============================================
REDIS_HOST=host.docker.internal
REDIS_PORT=6379
REDIS_CELERY_DB=0
REDIS_RESULTS_DB=1

# ============================================
# Superset Secret Key
# Generate a secure random key: openssl rand -base64 32
# ============================================
SECRET_KEY=CHANGE_THIS_TO_A_SECURE_RANDOM_KEY

# ============================================
# Superset Configuration
# ============================================
# Skip loading examples (faster startup, avoids DuckDB requirement)
SUPERSET_LOAD_EXAMPLES=no

# ============================================
# Optional: Additional Connect Sources for CSP
# ============================================
# SUPERSET_ADDITIONAL_CONNECT_SOURCES=https://app.idtcities.com,https://home.idtcities.com
```

## Steps to Use

1. **On your server, create/edit the file:**
   ```bash
   cd ~/Snap4IdtCities/superset-dev/superset
   nano docker/.env
   ```

2. **Paste the configuration above**

3. **Update these values:**
   - `DATABASE_PASSWORD=superset` → Change to your PostgreSQL password
   - `POSTGRES_PASSWORD=superset` → Change to your PostgreSQL password
   - `SECRET_KEY=CHANGE_THIS_TO_A_SECURE_RANDOM_KEY` → Generate a secure key

4. **Generate SECRET_KEY:**
   ```bash
   openssl rand -base64 32
   ```
   Copy the output and replace `CHANGE_THIS_TO_A_SECURE_RANDOM_KEY`

5. **Save and exit** (Ctrl+X, Y, Enter in nano)

## Important Values

✅ **DATABASE_HOST=host.docker.internal** - Must be this to access host PostgreSQL  
✅ **REDIS_HOST=host.docker.internal** - Must be this to access host Redis  
✅ **SUPERSET_LOAD_EXAMPLES=no** - Skips examples (avoids DuckDB requirement)

## After Creating .env

```bash
# Restart services
docker compose down
docker compose up
```

That's it! Your Superset will now connect to your external PostgreSQL and Redis.

