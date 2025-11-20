# Install Docker Compose on Linux Server

## Check Current Installation

First, check which version you have:

```bash
# Check for newer plugin version
docker compose version

# Check for older standalone version
docker-compose version
```

---

## Option 1: Install Docker Compose Plugin (Recommended - Newer)

This is the newer method (Docker Compose V2):

```bash
# Update package index
sudo apt update

# Install Docker Compose plugin
sudo apt install docker-compose-plugin

# Verify installation
docker compose version
```

**Note:** With this version, use `docker compose` (with space) instead of `docker-compose` (with hyphen).

---

## Option 2: Install Standalone Docker Compose (Older)

If you prefer the standalone version:

```bash
# Download latest version
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose

# Make executable
sudo chmod +x /usr/local/bin/docker-compose

# Verify installation
docker-compose version
```

**Note:** With this version, use `docker-compose` (with hyphen).

---

## Option 3: Install via apt (Ubuntu/Debian)

```bash
# Update package index
sudo apt update

# Install Docker Compose
sudo apt install docker-compose

# Verify installation
docker-compose version
```

---

## After Installation

### Test the Installation

```bash
# For plugin version (newer)
docker compose version

# For standalone version (older)
docker-compose version
```

### Update Your Scripts

The scripts (`fix-duckdb-issue.sh`, `build-and-run-custom.sh`, `update-superset.sh`) now automatically detect which version you have and use the correct command.

### Manual Commands

**If you have plugin version:**
```bash
docker compose -f docker-compose.custom.yml up -d
docker compose -f docker-compose.custom.yml logs -f
docker compose -f docker-compose.custom.yml ps
```

**If you have standalone version:**
```bash
docker-compose -f docker-compose.custom.yml up -d
docker-compose -f docker-compose.custom.yml logs -f
docker-compose -f docker-compose.custom.yml ps
```

---

## Quick Fix for Your Current Issue

Since you're getting the error, install Docker Compose first:

```bash
# Install plugin version (recommended)
sudo apt update
sudo apt install docker-compose-plugin

# Then run the fix script again
./fix-duckdb-issue.sh
```

Or if you prefer standalone:

```bash
# Install standalone version
sudo apt update
sudo apt install docker-compose

# Then run the fix script again
./fix-duckdb-issue.sh
```

---

## Verify Everything Works

After installation, test:

```bash
# Check version
docker compose version  # or docker-compose version

# Test with a simple command
docker compose ps  # or docker-compose ps

# Run your fix script
./fix-duckdb-issue.sh
```

---

## Troubleshooting

### Permission Denied

If you get permission errors:

```bash
# Add your user to docker group
sudo usermod -aG docker $USER

# Log out and log back in, or:
newgrp docker

# Then try again
./fix-duckdb-issue.sh
```

### Command Not Found After Installation

```bash
# Check if it's in PATH
which docker-compose
which docker

# If docker-compose not found, check installation
ls -la /usr/local/bin/docker-compose
ls -la /usr/bin/docker-compose

# Add to PATH if needed (usually not necessary)
export PATH=$PATH:/usr/local/bin
```

---

## Summary

**Quick Install:**
```bash
sudo apt update
sudo apt install docker-compose-plugin
```

**Then run:**
```bash
./fix-duckdb-issue.sh
```

The scripts will automatically detect which version you have! 🚀

