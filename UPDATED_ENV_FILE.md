# Updated docker/.env File with Your PostgreSQL Credentials

## Complete Updated .env File

```bash
#
# Licensed to the Apache Software Foundation (ASF) under one or more
# contributor license agreements.  See the NOTICE file distributed with
# this work for additional information regarding copyright ownership.
# The ASF licenses this file to You under the Apache License, Version 2.0
# (the "License"); you may not use this file except in compliance with
# the License.  You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#

# Allowing python to print() in docker
PYTHONUNBUFFERED=1

COMPOSE_PROJECT_NAME=superset

DEV_MODE=true

# database configurations (do not modify)
DATABASE_DB=superset
DATABASE_HOST=host.docker.internal
# Make sure you set this to a unique secure random value on production
DATABASE_PASSWORD=idtcities123
DATABASE_USER=superset

EXAMPLES_DB=examples
EXAMPLES_HOST=host.docker.internal
EXAMPLES_USER=examples
# Make sure you set this to a unique secure random value on production
EXAMPLES_PASSWORD=examples
EXAMPLES_PORT=5432

# database engine specific environment variables
# change the below if you prefer another database engine
DATABASE_PORT=5432
DATABASE_DIALECT=postgresql+psycopg2

POSTGRES_DB=superset
POSTGRES_USER=superset
# Make sure you set this to a unique secure random value on production
POSTGRES_PASSWORD=idtcities123

#MYSQL_DATABASE=superset
#MYSQL_USER=superset
#MYSQL_PASSWORD=superset
#MYSQL_RANDOM_ROOT_PASSWORD=yes

# Add the mapped in /app/pythonpath_docker which allows devs to override stuff
PYTHONPATH=/app/pythonpath:/app/docker/pythonpath_dev

REDIS_HOST=host.docker.internal
REDIS_PORT=6379
REDIS_CELERY_DB=0
REDIS_RESULTS_DB=1

# Development and logging configuration
# FLASK_DEBUG: Enables Flask dev features (auto-reload, better error pages) - keep 'true' for development
FLASK_DEBUG=true

# SUPERSET_LOG_LEVEL: Controls Superset application logging verbosity (debug, info, warning, error, critical)
SUPERSET_LOG_LEVEL=info

SUPERSET_APP_ROOT="/"

SUPERSET_ENV=development

SUPERSET_LOAD_EXAMPLES=no

CYPRESS_CONFIG=false

SUPERSET_PORT=8088

MAPBOX_API_KEY=''

# Make sure you set this to a unique secure random value on production
SUPERSET_SECRET_KEY=TEST_NON_DEV_SECRET

ENABLE_PLAYWRIGHT=false

PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

BUILD_SUPERSET_FRONTEND_IN_DOCKER=true
```

## Important Notes

Since `keycloak_postgres` is a Docker container, you have two options:

### Option 1: Use host.docker.internal (if port is exposed)

If `keycloak_postgres` exposes port 5432 to the host, use:
- `DATABASE_HOST=host.docker.internal`
- `DATABASE_PORT=5432` (or whatever port is exposed)

### Option 2: Use Docker network (if containers are on same network)

If both Superset and `keycloak_postgres` are on the same Docker network, you can use:
- `DATABASE_HOST=keycloak_postgres`
- `DATABASE_PORT=5432`

**Check which port keycloak_postgres exposes:**
```bash
docker ps | grep keycloak_postgres
# Look for the port mapping, e.g., 0.0.0.0:5444->5432/tcp
```

If you see a port mapping like `5444->5432`, then:
- Use `DATABASE_HOST=host.docker.internal`
- Use `DATABASE_PORT=5444` (the host port)

## Updated Values

✅ `DATABASE_PASSWORD=idtcities123`  
✅ `POSTGRES_PASSWORD=idtcities123`  
✅ `DATABASE_HOST=host.docker.internal` (or `keycloak_postgres` if on same network)  
✅ `REDIS_HOST=host.docker.internal`  
✅ `SUPERSET_LOAD_EXAMPLES=no`

