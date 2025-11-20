#!/bin/bash
#
# Fix Docker authentication issues
# Usage: ./fix-docker-auth.sh
#

set -e

echo "=========================================="
echo "Docker Authentication Fix"
echo "=========================================="
echo ""

# Check if Docker is running
if ! docker info &> /dev/null; then
    echo "Error: Docker is not running"
    echo "Start Docker with: sudo systemctl start docker"
    exit 1
fi

echo "Step 1: Testing Docker connection..."
if docker pull hello-world &> /dev/null; then
    echo "✅ Docker connection works"
    docker rmi hello-world &> /dev/null || true
else
    echo "❌ Docker connection failed"
    echo ""
    echo "Trying to fix..."
    
    # Check if logged in
    if ! docker info | grep -q "Username"; then
        echo ""
        echo "You're not logged into Docker Hub"
        echo "Logging in will help avoid rate limits and auth errors"
        echo ""
        read -p "Do you want to login to Docker Hub? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            docker login
        else
            echo ""
            echo "You can login later with: docker login"
            echo "Or create a free account at: https://hub.docker.com"
        fi
    fi
fi

echo ""
echo "Step 2: Checking Docker Hub connectivity..."
if curl -s https://hub.docker.com > /dev/null; then
    echo "✅ Can reach Docker Hub"
else
    echo "❌ Cannot reach Docker Hub"
    echo "Check your internet connection or firewall"
fi

echo ""
echo "Step 3: Testing image pull..."
echo "Attempting to pull a small test image..."
if docker pull alpine:latest &> /dev/null; then
    echo "✅ Image pull works"
    docker rmi alpine:latest &> /dev/null || true
else
    echo "❌ Image pull failed"
    echo ""
    echo "Possible issues:"
    echo "1. Not logged into Docker Hub (rate limiting)"
    echo "2. Network/firewall blocking Docker Hub"
    echo "3. Docker Hub service issues"
    echo ""
    echo "Solutions:"
    echo "1. Login: docker login"
    echo "2. Check network: curl https://hub.docker.com"
    echo "3. Wait if rate limited (100 pulls/6hrs for anonymous)"
fi

echo ""
echo "=========================================="
echo "Next Steps"
echo "=========================================="
echo ""
echo "If you're still getting 401 errors:"
echo ""
echo "1. Login to Docker Hub (recommended):"
echo "   docker login"
echo ""
echo "2. Create free Docker Hub account if needed:"
echo "   https://hub.docker.com/signup"
echo ""
echo "3. Then try building again:"
echo "   docker build --target lean --tag superset-custom:latest ."
echo ""

