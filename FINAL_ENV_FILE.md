# Final Updated docker/.env File - Use Port 5444

## Complete .env File (Copy and Paste)

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
EXAMPLES_PORT=5444

# database engine specific environment variables
# change the below if you prefer another database engine
DATABASE_PORT=5444
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

## Key Changes Made

✅ **DATABASE_PORT=5444** (changed from 5432 - this is the host port for keycloak_postgres)  
✅ **EXAMPLES_PORT=5444** (changed from 5432)  
✅ **DATABASE_PASSWORD=idtcities123**  
✅ **POSTGRES_PASSWORD=idtcities123**  
✅ **DATABASE_HOST=host.docker.internal**  
✅ **REDIS_HOST=host.docker.internal**  
✅ **DATABASE_DIALECT=postgresql+psycopg2** (full dialect name)  
✅ **SUPERSET_LOAD_EXAMPLES=no** (avoids DuckDB requirement)

## Why Port 5444?

The `keycloak_postgres` container exposes PostgreSQL on port **5444** on the host (mapped from container's port 5432). So we need to use port **5444** to connect from Superset containers.

## After Updating

1. **Update your `docker/.env` file** with the content above
2. **Restart services:**
   ```bash
   docker compose down
   docker compose up
   ```

The connection should now work: `postgresql+psycopg2://superset:idtcities123@host.docker.internal:5444/superset`

