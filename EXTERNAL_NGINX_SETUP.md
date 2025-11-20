# Using External Nginx with Superset Docker Compose

## Configuration Summary

The `docker-compose.yml` has been configured to use an **existing Nginx instance** running on your host machine instead of creating a new Nginx container.

## Changes Made

1. **Nginx service commented out** - No new Nginx container will be created
2. **Superset still exposes port 8088** - Your external Nginx can proxy to `localhost:8088`

## Configure Your External Nginx

Since Superset will be running on `localhost:8088`, configure your external Nginx to proxy requests to it.

### Basic Nginx Configuration

Create or update your Nginx configuration file (e.g., `/etc/nginx/sites-available/superset`):

```nginx
upstream superset_app {
    server localhost:8088;
    keepalive 100;
}

upstream superset_websocket {
    server localhost:8080;
    keepalive 100;
}

server {
    listen 78;  # Custom port - change to your preferred port
    server_name your-domain.com;  # Change to your domain or use _ for default

    # WebSocket support
    location /ws {
        proxy_pass http://superset_websocket;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Static files (if using superset-node for development)
    # For production, this may not be needed
    location /static {
        proxy_pass http://localhost:9000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Main Superset application
    location / {
        proxy_pass http://superset_app;
        proxy_set_header Host $http_host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;
        proxy_redirect off;
        proxy_buffering off;
        proxy_connect_timeout 300;
        proxy_send_timeout 300;
        proxy_read_timeout 300;
        send_timeout 300;
    }
}
```

### For HTTPS/SSL (Recommended for Production)

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /path/to/your/certificate.crt;
    ssl_certificate_key /path/to/your/private.key;

    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # WebSocket support
    location /ws {
        proxy_pass http://superset_websocket;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Main Superset application
    location / {
        proxy_pass http://superset_app;
        proxy_set_header Host $http_host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;
        proxy_redirect off;
        proxy_buffering off;
        proxy_connect_timeout 300;
        proxy_send_timeout 300;
        proxy_read_timeout 300;
        send_timeout 300;
    }
}
```

## Enable the Configuration

```bash
# Create symbolic link (if using sites-available/sites-enabled)
sudo ln -s /etc/nginx/sites-available/superset /etc/nginx/sites-enabled/

# Test Nginx configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

## Ports Used by Superset

When running `docker compose up`, Superset exposes these ports:

- **8088** - Main Superset application (HTTP)
- **8080** - WebSocket server (for real-time features)
- **9000** - Frontend dev server (only in development mode with superset-node)

## Access Superset

After configuring Nginx:

- **Via Nginx**: `http://your-domain.com:78` or `http://localhost:78` (if using port 78)
- **Direct access** (if port 8088 is accessible): `http://localhost:8088`

**Note**: If using a custom port like 78, you must include the port in the URL: `http://your-domain.com:78`

## Troubleshooting

### Nginx can't connect to Superset

1. **Check Superset is running:**
   ```bash
   docker compose ps
   # Should show superset_app as "Up"
   ```

2. **Test connection from host:**
   ```bash
   curl http://localhost:8088
   # Should return HTML or redirect
   ```

3. **Check Nginx error logs:**
   ```bash
   sudo tail -f /var/log/nginx/error.log
   ```

4. **Verify port 8088 is accessible:**
   ```bash
   sudo netstat -tuln | grep 8088
   # Should show: 0.0.0.0:8088 or 127.0.0.1:8088
   ```

### WebSocket connection fails

Make sure your Nginx configuration includes the `/ws` location block with proper WebSocket headers.

### Static files not loading

If you're using `superset-node` for development, make sure port 9000 is accessible and the `/static` location is configured.

For production builds, static files are served directly by Superset, so you may not need the `/static` proxy.

## Summary

✅ **Current Setup**: Using external Nginx on host  
✅ **No Nginx container**: Commented out to avoid conflicts  
✅ **Superset accessible**: Via `localhost:8088` for Nginx to proxy  
✅ **Ready to configure**: Set up your Nginx to proxy to Superset

## Quick Reference

**Superset endpoints:**
- Main app: `http://localhost:8088`
- WebSocket: `http://localhost:8080`
- Dev frontend: `http://localhost:9000` (development only)

**Nginx should proxy:**
- `/` → `http://localhost:8088`
- `/ws` → `http://localhost:8080`
- `/static` → `http://localhost:9000` (development only)

