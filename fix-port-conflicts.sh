#!/bin/bash
#
# Script to check and fix port conflicts for Superset Docker Compose
#

echo "=========================================="
echo "Checking Port Conflicts"
echo "=========================================="
echo ""

# Check Redis port (6379)
echo "Checking Redis port (6379)..."
if lsof -i :6379 > /dev/null 2>&1 || netstat -tuln | grep -q ":6379" 2>/dev/null || ss -tuln | grep -q ":6379" 2>/dev/null; then
    echo "⚠️  Port 6379 is in use!"
    echo "   Finding what's using it..."
    if command -v lsof > /dev/null; then
        lsof -i :6379
    elif command -v netstat > /dev/null; then
        netstat -tuln | grep :6379
    elif command -v ss > /dev/null; then
        ss -tuln | grep :6379
    fi
    echo ""
    echo "Solutions:"
    echo "  1. Stop the conflicting service"
    echo "  2. Or change the port in docker-compose.yml"
else
    echo "✅ Port 6379 is free"
fi
echo ""

# Check PostgreSQL port (5432)
echo "Checking PostgreSQL port (5432)..."
if lsof -i :5432 > /dev/null 2>&1 || netstat -tuln | grep -q ":5432" 2>/dev/null || ss -tuln | grep -q ":5432" 2>/dev/null; then
    echo "⚠️  Port 5432 is in use!"
    echo "   Finding what's using it..."
    if command -v lsof > /dev/null; then
        lsof -i :5432
    elif command -v netstat > /dev/null; then
        netstat -tuln | grep :5432
    elif command -v ss > /dev/null; then
        ss -tuln | grep :5432
    fi
    echo ""
    echo "Solutions:"
    echo "  1. Stop the conflicting service"
    echo "  2. Or change the port in docker-compose.yml"
else
    echo "✅ Port 5432 is free"
fi
echo ""

# Check Superset port (8088)
echo "Checking Superset port (8088)..."
if lsof -i :8088 > /dev/null 2>&1 || netstat -tuln | grep -q ":8088" 2>/dev/null || ss -tuln | grep -q ":8088" 2>/dev/null; then
    echo "⚠️  Port 8088 is in use!"
    echo "   Finding what's using it..."
    if command -v lsof > /dev/null; then
        lsof -i :8088
    elif command -v netstat > /dev/null; then
        netstat -tuln | grep :8088
    elif command -v ss > /dev/null; then
        ss -tuln | grep :8088
    fi
    echo ""
    echo "Solutions:"
    echo "  1. Stop the conflicting service"
    echo "  2. Or change the port in docker-compose.yml"
else
    echo "✅ Port 8088 is free"
fi
echo ""

# Check for Docker containers using these ports
echo "Checking Docker containers..."
echo ""
echo "Redis containers:"
docker ps -a | grep redis || echo "  No Redis containers found"
echo ""
echo "PostgreSQL containers:"
docker ps -a | grep postgres || echo "  No PostgreSQL containers found"
echo ""
echo "Superset containers:"
docker ps -a | grep superset || echo "  No Superset containers found"
echo ""

echo "=========================================="
echo "Quick Fix Commands"
echo "=========================================="
echo ""
echo "If Redis is running on host:"
echo "  sudo systemctl stop redis"
echo "  sudo systemctl disable redis  # to prevent auto-start"
echo ""
echo "If it's a Docker container:"
echo "  docker ps -a | grep redis"
echo "  docker stop <container-id>"
echo "  docker rm <container-id>"
echo ""
echo "Or remove all stopped containers:"
echo "  docker container prune -f"
echo ""

