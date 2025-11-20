# Using External PostgreSQL and Redis with Superset Docker Compose

## Configuration Summary

The `docker-compose.yml` has been configured to use **existing PostgreSQL and Redis instances** running on your host machine instead of creating new containers.

## Changes Made

1. **PostgreSQL service commented out** - No new PostgreSQL container will be created
2. **Redis service commented out** - No new Redis container will be created
3. **All services configured to use host databases** via `host.docker.internal`
4. **Database dependencies removed** - Services no longer wait for database containers
5. **Database volumes removed** - Not needed for external databases

## Requirements

### 1. PostgreSQL must be running on your host

Check if PostgreSQL is running:
```bash
# Check if PostgreSQL is running
sudo systemctl status postgresql
# OR
sudo systemctl status postgres

# Test connection
psql -U postgres -h localhost -c "SELECT version();"
```

**Important**: PostgreSQL must be configured to accept connections from Docker containers.

### 2. Redis must be running on your host

Check if Redis is running:
```bash
# Check if Redis is running
redis-cli ping
# Should return: PONG

# Or check the service
sudo systemctl status redis
sudo systemctl status redis-server
```

### 3. Configure docker/.env

Make sure your `docker/.env` file includes:

```bash
# PostgreSQL Configuration (using host PostgreSQL)
DATABASE_HOST=host.docker.internal
DATABASE_PORT=5432
DATABASE_DB=superset
POSTGRES_USER=your_postgres_user
POSTGRES_PASSWORD=your_postgres_password
POSTGRES_DB=superset

# Redis Configuration (using host Redis)
REDIS_HOST=host.docker.internal
REDIS_PORT=6379
```

**Note**: The services are already configured with `host.docker.internal` in the docker-compose.yml, but you can override it in `docker/.env` if needed.

## PostgreSQL Configuration

### Allow connections from Docker

PostgreSQL needs to be configured to accept connections. Check your `pg_hba.conf`:

```bash
# Find pg_hba.conf location
sudo -u postgres psql -c "SHOW hba_file;"

# Edit pg_hba.conf (usually in /etc/postgresql/*/main/)
sudo nano /etc/postgresql/*/main/pg_hba.conf
```

Add or verify this line allows connections:
```
host    all             all             127.0.0.1/32            md5
# OR for all local connections:
host    all             all             0.0.0.0/0               md5
```

### Check PostgreSQL is listening on correct interface

```bash
# Check what interface PostgreSQL is listening on
sudo netstat -tuln | grep 5432
# Should show: 0.0.0.0:5432 or 127.0.0.1:5432

# Check PostgreSQL config
sudo -u postgres psql -c "SHOW listen_addresses;"
# Should be: * or localhost or 0.0.0.0
```

### Create Superset database (if needed)

```bash
# Connect to PostgreSQL
sudo -u postgres psql

# Create database and user
CREATE DATABASE superset;
CREATE USER superset WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE superset TO superset;
\q
```

## Services Using External Databases

All Superset services have been configured with:
- `extra_hosts: - "host.docker.internal:host-gateway"` (to access host services)
- Database connection via `host.docker.internal`

Services using databases:
- ✅ `superset` (main app) - PostgreSQL + Redis
- ✅ `superset-init` (initialization) - PostgreSQL + Redis
- ✅ `superset-worker` (Celery worker) - PostgreSQL + Redis
- ✅ `superset-worker-beat` (Celery beat scheduler) - PostgreSQL + Redis
- ✅ `superset-websocket` (WebSocket server) - Redis

## Testing Connection

After starting services, test database connections from a container:

```bash
# Enter a Superset container
docker compose exec superset bash

# Test PostgreSQL connection (if psql is installed)
psql -h host.docker.internal -U superset -d superset -c "SELECT 1;"

# Test Redis connection (if redis-cli is installed)
redis-cli -h host.docker.internal -p 6379 ping
# Should return: PONG
```

## Troubleshooting

### PostgreSQL connection fails

1. **Check PostgreSQL is running on host:**
   ```bash
   sudo systemctl status postgresql
   ```

2. **Check PostgreSQL is listening:**
   ```bash
   sudo netstat -tuln | grep 5432
   # Should show: 0.0.0.0:5432 or 127.0.0.1:5432
   ```

3. **Check PostgreSQL allows connections:**
   ```bash
   # Test from host
   psql -h localhost -U superset -d superset
   ```

4. **Check pg_hba.conf:**
   ```bash
   sudo cat /etc/postgresql/*/main/pg_hba.conf | grep -v "^#"
   ```

5. **Test from container:**
   ```bash
   docker compose exec superset ping -c 1 host.docker.internal
   ```

### Redis connection fails

1. **Check Redis is running on host:**
   ```bash
   redis-cli ping
   ```

2. **Check Redis is listening:**
   ```bash
   sudo netstat -tuln | grep 6379
   # Should show: 0.0.0.0:6379 or 127.0.0.1:6379
   ```

3. **Test from container:**
   ```bash
   docker compose exec superset ping -c 1 host.docker.internal
   ```

### If databases are in other Docker containers

If your PostgreSQL/Redis are running in other Docker containers (not on the host), you have two options:

**Option 1: Use Docker network**
```yaml
# In docker-compose.yml, add to each service:
networks:
  - default
  - external_network  # Your database container's network

# Then use the container name as DATABASE_HOST
```

**Option 2: Expose ports and use host.docker.internal**
- Make sure the database containers expose ports to host
- Use `DATABASE_HOST=host.docker.internal` (current setup)

## Reverting to Internal Databases

If you want to use database containers instead, uncomment the services in `docker-compose.yml`:

```yaml
db:
  image: postgres:16
  container_name: superset_db
  restart: unless-stopped
  ports:
    - "127.0.0.1:5432:5432"
  volumes:
    - db_home:/var/lib/postgresql/data

redis:
  image: redis:7
  container_name: superset_cache
  restart: unless-stopped
  volumes:
    - redis:/data
```

And change `DATABASE_HOST` and `REDIS_HOST` back to `db` and `redis` respectively.

## Summary

✅ **Current Setup**: Using external PostgreSQL and Redis on host via `host.docker.internal`  
✅ **No database containers**: Commented out to avoid conflicts  
✅ **All services configured**: Can access host databases  
✅ **Ready to run**: `docker compose up`

## Quick Start

1. **Ensure PostgreSQL and Redis are running on host**
2. **Create `docker/.env` with database credentials**
3. **Run**: `docker compose up`

That's it! Your Superset will use the existing databases. 🚀

