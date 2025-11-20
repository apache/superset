# docker/.env File Template

## Required Configuration

Create `docker/.env` file with these settings to use external PostgreSQL and Redis:

```bash
# ============================================
# PostgreSQL Configuration (External on Host)
# ============================================
DATABASE_DIALECT=postgresql+psycopg2
DATABASE_USER=superset
DATABASE_PASSWORD=your_postgres_password_here
DATABASE_HOST=host.docker.internal
DATABASE_PORT=5432
DATABASE_DB=superset

# Alternative: Use POSTGRES_* variables (also supported)
POSTGRES_USER=superset
POSTGRES_PASSWORD=your_postgres_password_here
POSTGRES_DB=superset

# ============================================
# Redis Configuration (External on Host)
# ============================================
REDIS_HOST=host.docker.internal
REDIS_PORT=6379
REDIS_CELERY_DB=0
REDIS_RESULTS_DB=1

# ============================================
# Superset Configuration
# ============================================
SECRET_KEY=your-secret-key-here-change-this

# Optional: Skip loading examples (faster startup)
SUPERSET_LOAD_EXAMPLES=no
```

## Quick Setup

1. **Create the file:**
   ```bash
   mkdir -p docker
   nano docker/.env
   ```

2. **Copy the template above** and replace:
   - `your_postgres_password_here` - Your PostgreSQL password
   - `your-secret-key-here-change-this` - Generate a secure random key

3. **Generate SECRET_KEY:**
   ```bash
   # Linux/Mac:
   python3 -c "import secrets; print(secrets.token_urlsafe(32))"
   
   # Or use openssl:
   openssl rand -base64 32
   ```

4. **Create Superset database** (if not exists):
   ```bash
   sudo -u postgres psql
   
   CREATE DATABASE superset;
   CREATE USER superset WITH PASSWORD 'your_password';
   GRANT ALL PRIVILEGES ON DATABASE superset TO superset;
   \q
   ```

## Important Notes

- **DATABASE_HOST** must be `host.docker.internal` to access host PostgreSQL
- **REDIS_HOST** must be `host.docker.internal` to access host Redis
- The `docker/.env` file is loaded by all Superset services
- You can override values in `docker/.env-local` (git-ignored)

## Verification

After creating `docker/.env`, test the connection:

```bash
# Test PostgreSQL connection from host
psql -h localhost -U superset -d superset -c "SELECT 1;"

# Test Redis connection from host
redis-cli ping
```

Then run:
```bash
docker compose up
```

