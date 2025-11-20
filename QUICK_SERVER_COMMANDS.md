# Quick Server Commands Reference

## First Time Setup

```bash
# 1. Pull code
git pull

# 2. Make scripts executable
chmod +x build-and-run-custom.sh fix-duckdb-issue.sh update-superset.sh

# 3. Build and run
./build-and-run-custom.sh

# 4. Fix DuckDB issue
./fix-duckdb-issue.sh

# 5. Check logs
docker-compose -f docker-compose.custom.yml logs -f superset-init
```

---

## After Code Changes

```bash
# Quick update (rebuilds and restarts)
./update-superset.sh

# Or manual:
git pull
docker build --target lean --tag superset-custom:latest --build-arg BUILD_TRANSLATIONS=false --build-arg DEV_MODE=false .
docker-compose -f docker-compose.custom.yml restart
```

---

## Fix DuckDB Error

```bash
# Quick fix
./fix-duckdb-issue.sh

# Or manual:
echo "SUPERSET_LOAD_EXAMPLES=no" >> docker/.env-local
docker-compose -f docker-compose.custom.yml restart superset-init
```

---

## Common Commands

```bash
# Start services
docker-compose -f docker-compose.custom.yml up -d

# Stop services
docker-compose -f docker-compose.custom.yml down

# View logs
docker-compose -f docker-compose.custom.yml logs -f

# Check status
docker-compose -f docker-compose.custom.yml ps

# Restart specific service
docker-compose -f docker-compose.custom.yml restart superset

# Shell access
docker-compose -f docker-compose.custom.yml exec superset bash
```

---

## Monitoring

```bash
# Watch all logs
docker-compose -f docker-compose.custom.yml logs -f

# Watch initialization
docker-compose -f docker-compose.custom.yml logs -f superset-init | grep -E 'Step|Complete|Error'

# Check resource usage
docker stats

# Check disk space
docker system df
```

