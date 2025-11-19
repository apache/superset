# Quick Start: Deploy to Ubuntu Server

## TL;DR - Fastest Way

### On Windows (Build Machine):

```cmd
# 1. Build the image
build-production-docker.bat superset-custom:latest

# 2. Save the image
save-image-for-ubuntu.bat

# 3. Transfer to Ubuntu (using SCP or WinSCP)
scp superset-custom-latest.tar ubuntu@your-server:/home/ubuntu/
```

### On Ubuntu Server:

```bash
# 1. Load the image
docker load -i superset-custom-latest.tar

# 2. Copy deployment script
# (Copy deploy-to-ubuntu.sh to server, or create manually)

# 3. Run deployment script
chmod +x deploy-to-ubuntu.sh
./deploy-to-ubuntu.sh superset-custom-latest.tar

# 4. Access Superset
# http://your-server-ip:8088
```

## Detailed Steps

See [BUILD_AND_DEPLOY_UBUNTU.md](BUILD_AND_DEPLOY_UBUNTU.md) for complete instructions.

## File Sizes

- Docker image: ~2-4GB
- Transfer time: Depends on your connection speed
- Build time: 15-30 minutes on Windows

## Common Issues

**"Image not found"**
- Make sure you built the image first: `build-production-docker.bat`

**"Permission denied" on Ubuntu**
- Add your user to docker group: `sudo usermod -aG docker $USER`
- Log out and back in

**"Port 8088 already in use"**
- Change port in docker-compose.yml: `"8089:8088"` instead of `"8088:8088"`

**"Cannot connect to database"**
- Wait 30 seconds after starting services
- Check logs: `docker compose logs db`

## Need Help?

1. Check logs: `docker compose logs -f`
2. Verify containers: `docker compose ps`
3. Check Docker: `docker ps -a`
4. See full guide: [BUILD_AND_DEPLOY_UBUNTU.md](BUILD_AND_DEPLOY_UBUNTU.md)

