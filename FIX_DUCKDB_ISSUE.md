# Fix: DuckDB Module Error During Initialization

## Problem

You're seeing this error:
```
sqlalchemy.exc.NoSuchModuleError: Can't load plugin: sqlalchemy.dialects:duckdb
```

This happens because:
- The `lean` Docker image doesn't include DuckDB by default
- Superset tries to load examples which require DuckDB
- The DuckDB SQLAlchemy driver is missing

## Solutions

You have **3 options** to fix this:

---

## Solution 1: Skip Loading Examples (Quickest Fix) ⚡

**Best for:** Production deployments where you don't need example data

### Option A: Set Environment Variable

Add to `docker/.env` or `docker/.env-local`:
```bash
SUPERSET_LOAD_EXAMPLES=no
```

Then restart:
```bash
docker-compose -f docker-compose.custom.yml down
docker-compose -f docker-compose.custom.yml up -d
```

### Option B: Update docker-compose.custom.yml

The compose file already supports this. Just set the environment variable:

```bash
# In your shell
export SUPERSET_LOAD_EXAMPLES=no
docker-compose -f docker-compose.custom.yml up -d
```

Or update `docker/.env-local`:
```bash
SUPERSET_LOAD_EXAMPLES=no
```

---

## Solution 2: Install DuckDB in Your Image (Recommended for Examples) 🦆

**Best for:** When you want example data included

### Update Your Docker Build

Rebuild your image with DuckDB support:

**Windows:**
```cmd
docker build ^
  --target lean ^
  --tag superset-custom:latest ^
  --build-arg BUILD_TRANSLATIONS=false ^
  --build-arg DEV_MODE=false ^
  --build-arg INCLUDE_DUCKDB=true ^
  .
```

**Linux/Mac:**
```bash
docker build \
  --target lean \
  --tag superset-custom:latest \
  --build-arg BUILD_TRANSLATIONS=false \
  --build-arg DEV_MODE=false \
  --build-arg INCLUDE_DUCKDB=true \
  .
```

### Create Custom Dockerfile (Better Approach)

Create a `Dockerfile.custom` that extends the lean image:

```dockerfile
# Dockerfile.custom
FROM python-common AS lean

# Install Python dependencies
COPY requirements/base.txt requirements/
COPY superset-core superset-core

RUN --mount=type=cache,target=${SUPERSET_HOME}/.cache/uv \
    /app/docker/pip-install.sh --requires-build-essential -r requirements/base.txt

# Install the superset package
RUN --mount=type=cache,target=${SUPERSET_HOME}/.cache/uv \
    uv pip install -e .

# Install DuckDB support
RUN uv pip install .[duckdb]

RUN python -m compileall /app/superset

USER superset
```

Then build with:
```bash
docker build -f Dockerfile.custom --target lean --tag superset-custom:latest .
```

**Note:** You'll need to copy the full Dockerfile and modify it, or use a multi-stage approach.

### Simpler: Install DuckDB After Build

If you've already built the image, you can install DuckDB at runtime by modifying the init script, but it's better to rebuild.

---

## Solution 3: Use PostgreSQL for Examples (Alternative)

**Best for:** When you want examples but prefer PostgreSQL

### Update docker-compose.custom.yml

Change the examples URI to use PostgreSQL instead:

```yaml
superset-init:
  environment:
    # Use PostgreSQL instead of DuckDB for examples
    SUPERSET__SQLALCHEMY_EXAMPLES_URI: "postgresql+psycopg2://superset:superset@db:5432/superset_examples"
    SUPERSET_LOAD_EXAMPLES: yes
```

Then create the examples database:

```yaml
db:
  environment:
    POSTGRES_USER: superset
    POSTGRES_PASSWORD: superset
    POSTGRES_DB: superset
    # This will create the examples database on startup
    POSTGRES_MULTIPLE_DATABASES: superset_examples
```

**Note:** This requires additional PostgreSQL setup. Simpler to use Solution 1 or 2.

---

## Recommended: Solution 1 (Skip Examples)

For production deployments, **Solution 1 is recommended** because:
- ✅ No additional dependencies needed
- ✅ Faster initialization
- ✅ Smaller image size
- ✅ Examples aren't needed for production

### Quick Fix Steps:

1. **Create or update `docker/.env-local`:**
   ```bash
   SUPERSET_LOAD_EXAMPLES=no
   ```

2. **Restart services:**
   ```bash
   docker-compose -f docker-compose.custom.yml down
   docker-compose -f docker-compose.custom.yml up -d
   ```

3. **Verify:**
   ```bash
   docker-compose -f docker-compose.custom.yml logs superset-init
   ```
   
   You should see:
   ```
   Init Step 4/4 [Skipped] -- Loading examples (SUPERSET_LOAD_EXAMPLES=no)
   ```

---

## If You Need Examples: Solution 2 (Install DuckDB)

If you want example data, rebuild with DuckDB:

### Step 1: Create Dockerfile.custom

```dockerfile
# Dockerfile.custom
# Extends the base Dockerfile but adds DuckDB to lean target

# Copy the entire Dockerfile content, then modify the lean target:

FROM python-common AS lean

# Install Python dependencies
COPY requirements/base.txt requirements/
COPY superset-core superset-core

RUN --mount=type=cache,target=${SUPERSET_HOME}/.cache/uv \
    /app/docker/pip-install.sh --requires-build-essential -r requirements/base.txt

# Install the superset package
RUN --mount=type=cache,target=${SUPERSET_HOME}/.cache/uv \
    uv pip install -e .

# ADD THIS LINE: Install DuckDB support
USER root
RUN uv pip install .[duckdb]
USER superset

RUN python -m compileall /app/superset
```

### Step 2: Rebuild Image

```bash
docker build -f Dockerfile.custom --target lean --tag superset-custom:latest .
```

### Step 3: Restart

```bash
docker-compose -f docker-compose.custom.yml down
docker-compose -f docker-compose.custom.yml up -d
```

---

## Verification

After applying a solution, check the logs:

```bash
# Check initialization completed successfully
docker-compose -f docker-compose.custom.yml logs superset-init | grep -i "complete\|error"

# Check Superset is running
docker-compose -f docker-compose.custom.yml ps

# Access Superset
# http://localhost:8088
```

---

## Summary

| Solution | Pros | Cons | Best For |
|----------|------|------|----------|
| **1. Skip Examples** | ✅ Quick, no rebuild needed<br>✅ Smaller image<br>✅ Faster init | ❌ No example data | Production |
| **2. Install DuckDB** | ✅ Full functionality<br>✅ Example data included | ❌ Requires rebuild<br>✅ Larger image | Development/Testing |
| **3. Use PostgreSQL** | ✅ No new dependencies | ❌ More complex setup | Special cases |

**Recommendation:** Use **Solution 1** (skip examples) for production. Use **Solution 2** (install DuckDB) if you need example data.

---

## Quick Commands (Linux Server)

### Skip Examples (Recommended)
```bash
# Option 1: Use the fix script
chmod +x fix-duckdb-issue.sh
./fix-duckdb-issue.sh

# Option 2: Manual
echo "SUPERSET_LOAD_EXAMPLES=no" >> docker/.env-local
docker-compose -f docker-compose.custom.yml down
docker-compose -f docker-compose.custom.yml up -d
```

### Check Current Status
```bash
docker-compose -f docker-compose.custom.yml logs superset-init | tail -20

# Or watch in real-time
docker-compose -f docker-compose.custom.yml logs -f superset-init | grep -E 'Step|Complete|Error'
```

