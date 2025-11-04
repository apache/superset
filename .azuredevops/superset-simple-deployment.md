# Superset Simple Deployment Guide

## Overview

This guide provides a straightforward Docker Compose deployment for Apache Superset, perfect for getting started quickly without complex orchestration.

## Prerequisites

- Docker and Docker Compose installed
- Git repository access
- Basic understanding of environment variables

## Quick Start

### 1. Project Structure

```
superset-deployment/
├── docker-compose.yml
├── .env.example
├── .env
├── docker/
│   ├── Dockerfile
│   └── superset_config.py
└── data/
    ├── postgres/
    └── redis/
```

### 2. Docker Compose Configuration

```yaml
# docker-compose.yml
version: "3.8"

services:
  superset:
    build:
      context: ./docker
      dockerfile: Dockerfile
    container_name: superset-app
    ports:
      - "8088:8088"
    environment:
      - SUPERSET_CONFIG_PATH=/app/superset_config.py
      - SUPERSET_ENV=production
      - DATABASE_URL=postgresql://superset:superset@postgres:5432/superset
      - REDIS_URL=redis://redis:6379/0
      - SECRET_KEY=${SECRET_KEY}
      - FLASK_ENV=production
    volumes:
      - ./docker/superset_config.py:/app/superset_config.py
      - superset_home:/app/superset_home
    depends_on:
      - postgres
      - redis
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8088/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  postgres:
    image: postgres:13
    container_name: superset-postgres
    environment:
      - POSTGRES_DB=superset
      - POSTGRES_USER=superset
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./data/postgres:/docker-entrypoint-initdb.d
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U superset"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:6-alpine
    container_name: superset-redis
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 3

volumes:
  superset_home:
  postgres_data:
  redis_data:
```

### 3. Environment Variables Template

```bash
# .env.example
# Copy this to .env and fill in your values

# Security
SECRET_KEY=your-super-secret-key-here
POSTGRES_PASSWORD=your-secure-postgres-password

# Optional: External Database (if not using postgres container)
# DATABASE_URL=postgresql://user:password@external-host:5432/database

# Optional: External Redis (if not using redis container)
# REDIS_URL=redis://external-host:6379/0

# Optional: Email Configuration
# SMTP_HOST=smtp.gmail.com
# SMTP_PORT=587
# SMTP_USER=your-email@gmail.com
# SMTP_PASSWORD=your-app-password

# Optional: OAuth Configuration
# OAUTH_PROVIDERS=google,github
# GOOGLE_CLIENT_ID=your-google-client-id
# GOOGLE_CLIENT_SECRET=your-google-client-secret
```

### 4. Superset Dockerfile

```dockerfile
# docker/Dockerfile
FROM apache/superset:latest

# Install additional dependencies if needed
USER root
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Switch back to superset user
USER superset

# Create custom config directory
WORKDIR /app

# Copy custom configuration
COPY superset_config.py /app/superset_config.py

# Expose port
EXPOSE 8088

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8088/health || exit 1

# Default command
CMD ["superset", "run", "--host", "0.0.0.0", "--port", "8088"]
```

### 5. Superset Configuration

```python
# docker/superset_config.py
import os

# Basic configuration
SECRET_KEY = os.environ.get('SECRET_KEY', 'change-this-default-key')
SUPERSET_ENV = os.environ.get('SUPERSET_ENV', 'production')

# Database configuration
DATABASE_URL = os.environ.get('DATABASE_URL',
    'postgresql://superset:superset@postgres:5432/superset')

# Redis configuration
REDIS_URL = os.environ.get('REDIS_URL', 'redis://redis:6379/0')

# Security settings
ENABLE_PROXY_FIX = True
ENABLE_CORS = True
CORS_ALLOW_ORIGINS = ["http://localhost:8088", "http://localhost:3000"]

# Logging
LOG_LEVEL = os.environ.get('LOG_LEVEL', 'INFO')
LOG_FORMAT = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"

# Feature flags
FEATURE_FLAGS = os.environ.get('FEATURE_FLAGS', 'ENABLE_TEMPLATE_PROCESSING').split(',')

# Email configuration (optional)
SMTP_HOST = os.environ.get('SMTP_HOST')
SMTP_PORT = int(os.environ.get('SMTP_PORT', 587))
SMTP_USER = os.environ.get('SMTP_USER')
SMTP_PASSWORD = os.environ.get('SMTP_PASSWORD')
SMTP_MAIL_FROM = os.environ.get('SMTP_MAIL_FROM')

# OAuth configuration (optional)
OAUTH_PROVIDERS = os.environ.get('OAUTH_PROVIDERS', '').split(',')

if 'google' in OAUTH_PROVIDERS:
    OAUTH_PROVIDERS.append({
        'name': 'google',
        'icon': 'fa-google',
        'token_key': 'access_token',
        'remote_app': {
            'client_id': os.environ.get('GOOGLE_CLIENT_ID'),
            'client_secret': os.environ.get('GOOGLE_CLIENT_SECRET'),
            'api_base_url': 'https://www.googleapis.com/oauth2/v2/',
            'client_kwargs': {
                'scope': 'email profile'
            },
            'access_token_url': 'https://accounts.google.com/o/oauth2/token',
            'authorize_url': 'https://accounts.google.com/o/oauth2/auth',
        }
    })
```

## Deployment Steps

### 1. Setup Environment

```bash
# Clone or create your project directory
mkdir superset-deployment
cd superset-deployment

# Create directory structure
mkdir -p docker data/postgres data/redis

# Create files
touch docker-compose.yml .env.example docker/Dockerfile docker/superset_config.py
```

### 2. Configure Secrets

```bash
# Copy environment template
cp .env.example .env

# Edit .env file with your secure values
nano .env
```

**Important**: Generate a secure SECRET_KEY:

```bash
# Generate a secure secret key
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```

### 3. Deploy Superset

```bash
# Build and start all services
docker-compose up -d

# Check service status
docker-compose ps

# View logs
docker-compose logs -f superset
```

### 4. Initialize Superset

```bash
# Run database migrations
docker-compose exec superset superset db upgrade

# Create an admin user
docker-compose exec superset superset fab create-admin \
    --username admin \
    --firstname Admin \
    --lastname User \
    --email admin@example.com \
    --password admin

# Load examples (optional)
docker-compose exec superset superset load_examples

# Initialize Superset
docker-compose exec superset superset init
```

### 5. Access Superset

- Open your browser and go to: `http://localhost:8088`
- Login with the admin credentials you created
- Default: username `admin`, password `admin`

## Management Commands

### Start Services

```bash
docker-compose up -d
```

### Stop Services

```bash
docker-compose down
```

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f superset
docker-compose logs -f postgres
docker-compose logs -f redis
```

### Update Superset

```bash
# Pull latest image
docker-compose pull superset

# Rebuild and restart
docker-compose up -d --build
```

### Backup Data

```bash
# Backup PostgreSQL
docker-compose exec postgres pg_dump -U superset superset > backup.sql

# Backup Redis
docker-compose exec redis redis-cli BGSAVE
```

### Restore Data

```bash
# Restore PostgreSQL
docker-compose exec -T postgres psql -U superset superset < backup.sql

# Restore Redis (copy redis dump file to data/redis directory first)
docker-compose restart redis
```

## Security Best Practices

### 1. Environment Variables

- Never commit `.env` file to version control
- Use strong, unique passwords
- Generate secure SECRET_KEY
- Consider using a secrets management tool for production

### 2. Network Security

```yaml
# Add to docker-compose.yml for production
networks:
  superset-network:
    driver: bridge
    internal: true

services:
  superset:
    networks:
      - superset-network
    # ... other config

  # Add nginx reverse proxy for external access
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - superset
    networks:
      - default
```

### 3. SSL/TLS Configuration

For production, add SSL termination using nginx or a load balancer.

## Troubleshooting

### Common Issues

#### 1. Database Connection Failed

```bash
# Check postgres status
docker-compose exec postgres pg_isready -U superset

# Check database URL in .env
echo $DATABASE_URL
```

#### 2. Redis Connection Failed

```bash
# Check redis status
docker-compose exec redis redis-cli ping

# Check redis URL in .env
echo $REDIS_URL
```

#### 3. Superset Won't Start

```bash
# Check logs for errors
docker-compose logs superset

# Check configuration
docker-compose exec superset python -c "from superset.config import *; print('Config OK')"
```

#### 4. Permission Issues

```bash
# Fix volume permissions
sudo chown -R $USER:$USER ./data
```

### Health Check Commands

```bash
# Check all services health
docker-compose ps

# Check specific service health
docker-compose exec superset curl -f http://localhost:8088/health
```

## Production Considerations

### 1. Open Telemtry Side Car Development

### 2. Backup Strategy

- Regular database backups
- Configuration backups
- Volume snapshots

### 3. Monitoring

- Add health checks
- Monitor resource usage
- Set up alerting

## Next Steps

Once you have Superset running, you can:

1. **Connect Data Sources**: Add your databases and data warehouses
2. **Create Dashboards**: Build visualizations and dashboards
3. **Set Up Users**: Configure user authentication and permissions
4. **Automate Backups**: Set up regular backup schedules
5. **Monitor Performance**: Set up monitoring and alerting

## Support

- **Superset Documentation**: https://superset.apache.org/docs/
- **Docker Compose Reference**: https://docs.docker.com/compose/
- **Troubleshooting Guide**: Check logs section above

---

**Note**: This simple deployment is great for development, testing, and small production environments. For larger scale or high-availability requirements, consider using Kubernetes or cloud-managed services.
