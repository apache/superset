# Using External Redis with Superset Docker Compose

## Configuration Summary

The `docker-compose.yml` has been configured to use an **existing Redis instance** running on your host machine instead of creating a new Redis container.

## Changes Made

1. **Redis service commented out** - No new Redis container will be created
2. **All services configured to use host Redis** via `host.docker.internal`
3. **Redis volume removed** - Not needed for external Redis

## Requirements

### 1. Redis must be running on your host

Check if Redis is running:
```bash
# Check if Redis is running
redis-cli ping
# Should return: PONG

# Or check the service
sudo systemctl status redis
sudo systemctl status redis-server
```

### 2. Redis must be accessible from Docker

Redis should be listening on:
- **Host**: `localhost` or `0.0.0.0`
- **Port**: `6379` (default)

If Redis is only listening on `127.0.0.1`, Docker containers can still access it via `host.docker.internal`.

### 3. Configure docker/.env

Make sure your `docker/.env` file includes:

```bash
# Redis Configuration (using host Redis)
REDIS_HOST=host.docker.internal
REDIS_PORT=6379
```

**Note**: The services are already configured with `REDIS_HOST=host.docker.internal` in the docker-compose.yml, but you can override it in `docker/.env` if needed.

## Services Using External Redis

All Superset services have been configured with:
- `extra_hosts: - "host.docker.internal:host-gateway"` (to access host services)
- `REDIS_HOST=host.docker.internal` (for services that need explicit config)

Services using Redis:
- ✅ `superset` (main app)
- ✅ `superset-init` (initialization)
- ✅ `superset-worker` (Celery worker)
- ✅ `superset-worker-beat` (Celery beat scheduler)
- ✅ `superset-websocket` (WebSocket server)

## Testing Connection

After starting services, test Redis connection from a container:

```bash
# Enter a Superset container
docker compose exec superset bash

# Test Redis connection (if redis-cli is installed)
redis-cli -h host.docker.internal -p 6379 ping
# Should return: PONG
```

## Troubleshooting

### Redis connection fails

1. **Check Redis is running on host:**
   ```bash
   redis-cli ping
   ```

2. **Check Redis is listening on correct interface:**
   ```bash
   sudo netstat -tuln | grep 6379
   # Should show: 0.0.0.0:6379 or 127.0.0.1:6379
   ```

3. **Check Redis bind configuration:**
   ```bash
   # Check Redis config
   redis-cli CONFIG GET bind
   # Should allow connections (0.0.0.0 or 127.0.0.1)
   ```

4. **Test from container:**
   ```bash
   docker compose exec superset ping -c 1 host.docker.internal
   ```

### If Redis is in another Docker container

If your Redis is running in another Docker container (not on the host), you have two options:

**Option 1: Use Docker network**
```yaml
# In docker-compose.yml, add to each service:
networks:
  - default
  - external_network  # Your Redis container's network

# Then use the Redis container name as REDIS_HOST
```

**Option 2: Expose Redis port and use host.docker.internal**
- Make sure the Redis container exposes port 6379 to host
- Use `REDIS_HOST=host.docker.internal` (current setup)

## Reverting to Internal Redis

If you want to use a Redis container instead, uncomment the Redis service in `docker-compose.yml`:

```yaml
redis:
  image: redis:7
  container_name: superset_cache
  restart: unless-stopped
  volumes:
    - redis:/data
```

And change `REDIS_HOST` back to `redis` in all services.

## Summary

✅ **Current Setup**: Using external Redis on host via `host.docker.internal`  
✅ **No Redis container**: Commented out to avoid conflicts  
✅ **All services configured**: Can access host Redis  
✅ **Ready to run**: `docker compose up`

