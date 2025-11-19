# Fix Docker Authentication Error

You're getting `401 Unauthorized` when pulling Docker images. Here are solutions:

## Solution 1: Login to Docker Hub (Recommended)

Even with a free Docker Hub account, logging in helps avoid rate limits:

```bash
# Login to Docker Hub (create free account at hub.docker.com if needed)
docker login

# Enter your Docker Hub username and password
# Or use access token: https://hub.docker.com/settings/security
```

Then try building again:
```bash
docker build --target lean --tag superset-custom:latest .
```

## Solution 2: Use Docker Hub Access Token

If you don't want to use password:

1. Go to https://hub.docker.com/settings/security
2. Create an access token
3. Login with token:

```bash
docker login -u YOUR_USERNAME
# When prompted for password, paste your access token
```

## Solution 3: Check Network/Firewall

If you're behind a corporate firewall or proxy:

```bash
# Set proxy (if needed)
export HTTP_PROXY=http://your-proxy:port
export HTTPS_PROXY=http://your-proxy:port

# Or configure Docker daemon
sudo mkdir -p /etc/systemd/system/docker.service.d
sudo nano /etc/systemd/system/docker.service.d/http-proxy.conf
```

Add:
```ini
[Service]
Environment="HTTP_PROXY=http://proxy.example.com:80"
Environment="HTTPS_PROXY=http://proxy.example.com:80"
```

Then:
```bash
sudo systemctl daemon-reload
sudo systemctl restart docker
```

## Solution 4: Wait and Retry (Rate Limitting)

Docker Hub has rate limits for anonymous users:
- **Anonymous:** 100 pulls per 6 hours
- **Free account:** 200 pulls per 6 hours

If you hit the limit, wait a few hours or login with a free account.

## Solution 5: Use Alternative Base Images (Advanced)

If Docker Hub is completely blocked, you can modify the Dockerfile to use alternative registries, but this requires more changes.

## Solution 6: Check Docker Service

Make sure Docker is running properly:

```bash
# Check Docker status
sudo systemctl status docker

# Restart Docker if needed
sudo systemctl restart docker

# Test Docker connection
docker pull hello-world
```

## Quick Fix Script

Run this to diagnose and fix:

```bash
#!/bin/bash
echo "Checking Docker connection..."
docker pull hello-world

if [ $? -eq 0 ]; then
    echo "Docker is working. Try logging in:"
    echo "docker login"
else
    echo "Docker connection issue. Checking service..."
    sudo systemctl status docker
    echo "Try: sudo systemctl restart docker"
fi
```

## Most Common Solution

**Just login to Docker Hub:**

```bash
docker login
# Enter username and password (or access token)
```

Then rebuild:
```bash
docker build --target lean --tag superset-custom:latest .
```

This usually fixes the 401 error immediately.

