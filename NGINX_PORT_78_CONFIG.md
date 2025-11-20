# Nginx Configuration for Port 78

## Quick Setup

Yes, you can absolutely run Nginx on port 78! Here's how to configure it:

### Nginx Configuration File

Create or update your Nginx configuration (e.g., `/etc/nginx/sites-available/superset`):

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
    listen 78;  # Custom port 78
    server_name _;  # Accept all domains, or specify your domain

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

    # Static files (development only - if using superset-node)
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

## Enable and Test

```bash
# Enable the site (if using sites-available/sites-enabled)
sudo ln -s /etc/nginx/sites-available/superset /etc/nginx/sites-enabled/

# Test Nginx configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

## Access Superset

After starting Superset with `docker compose up`, access it via:

- **Via Nginx (port 78)**: `http://your-server-ip:78` or `http://localhost:78`
- **Direct access (port 8088)**: `http://localhost:8088`

## Important Notes

1. **Port in URL**: When using a custom port like 78, you must include it in the URL:
   - ✅ `http://your-domain.com:78`
   - ✅ `http://localhost:78`
   - ❌ `http://your-domain.com` (won't work - defaults to port 80)

2. **Firewall**: Make sure port 78 is open in your firewall:
   ```bash
   sudo ufw allow 78/tcp
   # OR
   sudo firewall-cmd --add-port=78/tcp --permanent
   sudo firewall-cmd --reload
   ```

3. **SELinux** (if enabled): You may need to allow Nginx to bind to port 78:
   ```bash
   sudo semanage port -a -t http_port_t -p tcp 78
   ```

## How It Works

```
User Request → Nginx (port 78) → Superset (port 8088)
                ↓
         WebSocket (port 8080)
```

1. User accesses `http://your-server:78`
2. Nginx receives the request on port 78
3. Nginx proxies the request to Superset on `localhost:8088`
4. Superset processes the request and returns the response
5. Nginx sends the response back to the user

## Testing

```bash
# Test Nginx is listening on port 78
sudo netstat -tuln | grep 78
# OR
sudo ss -tuln | grep 78

# Test connection
curl http://localhost:78
# Should return HTML or redirect

# Test from browser
# Open: http://your-server-ip:78
```

## Troubleshooting

### Port 78 already in use

```bash
# Check what's using port 78
sudo lsof -i :78
# OR
sudo netstat -tuln | grep 78

# Stop the conflicting service or use a different port
```

### Nginx can't bind to port 78

If you get "permission denied" for port 78:

1. **Check if port is privileged** (ports < 1024 require root):
   - Port 78 is fine - it's above 1024, so no special permissions needed

2. **Check SELinux** (if enabled):
   ```bash
   sudo semanage port -a -t http_port_t -p tcp 78
   ```

3. **Check Nginx user permissions**:
   ```bash
   # Nginx should run as nginx user (default)
   ps aux | grep nginx
   ```

### Connection refused

1. **Check Superset is running**:
   ```bash
   docker compose ps
   # Should show superset_app as "Up"
   ```

2. **Test Superset directly**:
   ```bash
   curl http://localhost:8088
   ```

3. **Check Nginx error logs**:
   ```bash
   sudo tail -f /var/log/nginx/error.log
   ```

## Summary

✅ **Yes, port 78 works perfectly!**  
✅ **Nginx proxies to Superset on port 8088**  
✅ **Access via**: `http://your-server:78`  
✅ **All Superset features work** (including WebSocket on `/ws`)

Just make sure:
1. Nginx is configured to listen on port 78
2. Nginx proxies to `localhost:8088`
3. Port 78 is open in firewall
4. Superset is running (`docker compose up`)

