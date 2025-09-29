---
title: Development Environment Setup
sidebar_position: 2
---

<!--
Licensed to the Apache Software Foundation (ASF) under one
or more contributor license agreements.  See the NOTICE file
distributed with this work for additional information
regarding copyright ownership.  The ASF licenses this file
to you under the Apache License, Version 2.0 (the
"License"); you may not use this file except in compliance
with the License.  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing,
software distributed under the License is distributed on an
"AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, either express or implied.  See the License for the
specific language governing permissions and limitations
under the License.
-->

# Development Environment Setup

Get your Apache Superset development environment up and running.

## System Requirements

### Minimum Requirements
- **Python**: 3.9, 3.10, or 3.11
- **Node.js**: 18.x or 20.x
- **npm**: 9.x or 10.x
- **Memory**: 8GB RAM minimum (16GB recommended)
- **Storage**: 10GB free space

### Operating Systems
- macOS (Intel or Apple Silicon)
- Linux (Ubuntu, Debian, CentOS, etc.)
- Windows (via WSL2 recommended)

## Quick Start

### 1. Fork and Clone

```bash
# Fork the repository on GitHub first
# Then clone your fork
git clone https://github.com/YOUR_USERNAME/superset.git
cd superset

# Add upstream remote
git remote add upstream https://github.com/apache/superset.git
```

### 2. Python Setup

```bash
# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Upgrade pip and setuptools
pip install --upgrade pip setuptools wheel

# Install Python dependencies
pip install -r requirements/development.txt
pip install -e .

# Install pre-commit hooks
pre-commit install
```

### 3. Initialize Database

```bash
# Create and initialize SQLite database (for development)
superset db upgrade
superset fab create-admin  # Create admin user
superset init              # Initialize default roles and permissions
```

### 4. Frontend Setup

```bash
# Navigate to frontend directory
cd superset-frontend

# Install dependencies
npm ci

# Return to root
cd ..
```

### 5. Start Development Servers

```bash
# Terminal 1: Start Flask backend (port 8088)
superset run -p 8088 --with-threads --reload --debugger

# Terminal 2: Start Webpack dev server (port 9000)
cd superset-frontend
npm run dev
```

Access Superset at http://localhost:9000

## Detailed Setup

### Database Options

#### SQLite (Default - Development Only)
```bash
# Automatically configured, no additional setup needed
```

#### PostgreSQL (Recommended for testing)
```bash
# Install PostgreSQL
# macOS: brew install postgresql
# Ubuntu: sudo apt-get install postgresql

# Create database
createdb superset

# Set environment variable
export SUPERSET_CONFIG_PATH=superset_config.py

# In superset_config.py:
SQLALCHEMY_DATABASE_URI = 'postgresql://username:password@localhost/superset'
```

#### MySQL
```bash
# Install MySQL client
pip install mysqlclient

# In superset_config.py:
SQLALCHEMY_DATABASE_URI = 'mysql://username:password@localhost/superset'
```

### Redis Setup (for caching and Celery)

```bash
# Install Redis
# macOS: brew install redis
# Ubuntu: sudo apt-get install redis-server

# Start Redis
redis-server

# In superset_config.py:
CACHE_CONFIG = {
    'CACHE_TYPE': 'RedisCache',
    'CACHE_DEFAULT_TIMEOUT': 86400,
    'CACHE_REDIS_URL': 'redis://localhost:6379/0'
}
```

### Celery Setup (for async queries)

```bash
# Install Celery dependencies
pip install celery redis

# Start Celery worker (Terminal 3)
celery --app=superset.tasks.celery_app:app worker --pool=prefork -O fair -c 4

# Start Celery beat (Terminal 4)
celery --app=superset.tasks.celery_app:app beat

# In superset_config.py:
class CeleryConfig:
    broker_url = 'redis://localhost:6379/0'
    result_backend = 'redis://localhost:6379/1'

CELERY_CONFIG = CeleryConfig
```

## Docker Development

### Using Docker Compose

```bash
# Quick start with Docker
docker compose up

# Or for development with hot reloading
docker compose -f docker-compose-non-dev.yml up
```

### Custom Docker Development

```bash
# Build development image
docker build -t superset-dev .

# Run with mounted volumes for hot reloading
docker run -d -p 8088:8088 \
  -v $(pwd)/superset:/app/superset \
  -v $(pwd)/superset-frontend:/app/superset-frontend \
  superset-dev
```

## IDE Configuration

### VS Code

`.vscode/settings.json`:
```json
{
  "python.linting.enabled": true,
  "python.linting.pylintEnabled": false,
  "python.linting.flake8Enabled": true,
  "python.formatting.provider": "black",
  "python.linting.mypyEnabled": true,
  "editor.formatOnSave": true,
  "[python]": {
    "editor.codeActionsOnSave": {
      "source.organizeImports": true
    }
  },
  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[typescriptreact]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  }
}
```

Recommended extensions:
- Python (ms-python.python)
- Pylance (ms-python.vscode-pylance)
- ESLint (dbaeumer.vscode-eslint)
- Prettier (esbenp.prettier-vscode)

### PyCharm

1. Open project root
2. Configure Python interpreter to use virtual environment
3. Enable Black formatter: Settings → Tools → Black
4. Configure ESLint: Settings → Languages → JavaScript → Code Quality Tools
5. Set Node interpreter: Settings → Languages → Node.js

## Common Issues

### Issue: `npm ci` fails
```bash
# Clear npm cache
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

### Issue: Database migration errors
```bash
# Reset database
superset db downgrade
superset db upgrade
```

### Issue: Port already in use
```bash
# Find and kill process
lsof -i :8088  # or :9000
kill -9 <PID>
```

### Issue: Import errors
```bash
# Reinstall in development mode
pip install -e .
```

### Issue: Frontend build errors
```bash
# Clean and rebuild
cd superset-frontend
rm -rf node_modules
npm ci
npm run build
```

## Verification

### Backend Health Check
```bash
curl http://localhost:8088/health
# Should return: {"status": "OK"}
```

### Frontend Build
```bash
cd superset-frontend
npm run build
# Should complete without errors
```

### Run Tests
```bash
# Backend tests
pytest tests/unit_tests/

# Frontend tests
cd superset-frontend
npm run test
```

### Linting
```bash
# Python linting
pre-commit run --all-files

# JavaScript/TypeScript linting
cd superset-frontend
npm run lint
```

## Next Steps

✅ Environment is set up! Now:

1. **[Learn the codebase](../architecture/overview)** - Understand the architecture
2. **[Follow coding guidelines](../coding-guidelines/overview)** - Write quality code
3. **[Run tests](../testing/overview)** - Ensure your changes work
4. **[Submit a PR](./submitting-pr)** - Share your contribution

Need help? Ask in [Slack #beginners](https://apache-superset.slack.com) or [GitHub Discussions](https://github.com/apache/superset/discussions).
