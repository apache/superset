# Apache Superset Development Environment Setup Guide

This guide walks through setting up Apache Superset for local development with both backend (Flask/Python) and frontend (React/TypeScript) running in development mode.

## Prerequisites

- **Python**: 3.8 or higher
- **Node.js**: v20.18.1 or higher (recommend using nvm)
- **npm**: v10.8.1 or higher
- **OS**: Linux/macOS (Ubuntu/Debian instructions provided)

## System Dependencies

Install required system packages:

```bash
sudo apt-get update
sudo apt-get install -y \
    build-essential \
    pkg-config \
    default-libmysqlclient-dev \
    libpq-dev \
    libldap2-dev \
    libsasl2-dev \
    python3-dev
```

## Part 1: Backend Setup (Flask/Python)

### Step 1: Create Python Virtual Environment

```bash
# Navigate to superset directory
cd /path/to/superset

# Create virtual environment
python3 -m venv venv

# Activate virtual environment
source venv/bin/activate
```

### Step 2: Set Environment Variables

```bash
export FLASK_ENV=development
export SUPERSET_CONFIG_PATH=superset/config.py
```

**Optional**: Add these to your `~/.bashrc` or `~/.zshrc` for persistence:

```bash
echo 'export FLASK_ENV=development' >> ~/.bashrc
echo 'export SUPERSET_CONFIG_PATH=superset/config.py' >> ~/.bashrc
```

### Step 3: Upgrade Packaging Tools

```bash
pip install --upgrade pip setuptools wheel
```

### Step 4: Install Superset and Dependencies

```bash
# Install Superset in editable mode
pip install -e .

# Install base requirements
pip install -r requirements/base.txt

# Install development requirements
pip install -r requirements/development.txt

# Install development extras
pip install -e ".[dev]"
```

### Step 5: Verify Flask-AppBuilder Installation

```bash
python3 -c 'import flask_appbuilder; print(flask_appbuilder.__version__)'
```

Expected output: `5.0.0` or higher

### Step 6: Initialize Database

```bash
# Run database migrations
superset db upgrade

# Initialize Superset (create roles, permissions, themes)
superset init
```

### Step 7: Create Admin User (Optional)

```bash
superset fab create-admin
```

You'll be prompted for:
- Username
- First Name
- Last Name
- Email
- Password
- Confirm Password

### Step 8: Start Backend Development Server

```bash
# Start Flask dev server with auto-reload and debugger
superset run -p 8088 --reload --debugger
```

**Run in background** (optional):

```bash
nohup superset run -p 8088 --reload --debugger > superset.log 2>&1 &
echo $! > superset.pid
```

**Verify backend is running**:

```bash
# Check if server is listening
ss -ltnp | grep 8088

# Health check
curl http://localhost:8088/health
```

Expected output: `OK`

## Part 2: Frontend Setup (React/TypeScript)

### Step 1: Install Node.js (Using nvm)

```bash
# Install nvm if not already installed
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Reload shell configuration
source ~/.bashrc

# Install Node.js v20
nvm install 20

# Use Node.js v20
nvm use 20

# Verify versions
node -v   # Should show v20.x.x
npm -v    # Should show v10.x.x
```

### Step 2: Navigate to Frontend Directory

```bash
cd superset-frontend
```

### Step 3: Install Frontend Dependencies

```bash
# Install all npm packages (this may take 5-10 minutes)
npm install
```

**Note**: If you see warnings about vulnerabilities, they are expected in development mode. You can run `npm audit` to review them.

### Step 4: Start Frontend Development Build

**Option A: Webpack Watch Mode (Recommended)**

Automatically rebuilds when files change:

```bash
npm run dev
```

**Run in background**:

```bash
nohup npm run dev > ../superset-frontend.log 2>&1 &
echo $! > ../superset-frontend.pid
```

The webpack watch mode will:
- Watch all frontend source files
- Automatically rebuild on changes
- Output assets to `../superset/static/assets/`
- Assets are served by the Flask backend at `http://localhost:8088`

**Option B: Webpack Dev Server (Alternative)**

Includes hot module replacement (no page refresh needed):

```bash
npm run dev-server
```

This runs on port `9000` and requires proxy configuration to connect to the backend.

### Step 5: Verify Frontend Build

```bash
# Check webpack process is running
ps aux | grep webpack

# Monitor build logs
tail -f ../superset-frontend.log
```

Expected output on successful build:
```
webpack 5.x.x compiled successfully in xxxxx ms
```

## Accessing Your Development Environment

### Backend + Frontend (Recommended)
- **URL**: http://localhost:8088
- **Description**: Full application served by Flask with auto-reloading assets

### Frontend Dev Server Only (If using dev-server)
- **URL**: http://localhost:9000
- **Description**: Hot reload enabled, proxies API calls to backend

## Development Workflow

### Making Changes

#### Backend (Python) Changes:
1. Edit any `.py` file in `superset/` directory
2. Save the file (Ctrl+S)
3. Flask dev server automatically restarts (~2-3 seconds)
4. Refresh browser (F5) to see changes

#### Frontend (JavaScript/TypeScript) Changes:
1. Edit any file in `superset-frontend/src/`
2. Save the file (Ctrl+S)
3. Webpack automatically rebuilds (~1-5 seconds for incremental)
4. Refresh browser (F5) to see changes

### Monitoring Logs

```bash
# Backend logs
tail -f superset.log

# Frontend webpack logs
tail -f superset-frontend.log
```

### Stopping Services

```bash
# Stop backend (if using PID file)
kill $(cat superset.pid)

# Stop frontend (if using PID file)
kill $(cat superset-frontend.pid)

# Or find and kill processes manually
ps aux | grep superset
ps aux | grep webpack
kill <PID>
```

## Troubleshooting

### Backend Issues

**Issue**: `ModuleNotFoundError` or import errors
```bash
# Ensure virtual environment is activated
source venv/bin/activate

# Reinstall requirements
pip install -r requirements/development.txt
```

**Issue**: Database errors
```bash
# Reset database and reinitialize
superset db upgrade
superset init
```

**Issue**: Port 8088 already in use
```bash
# Find and kill process using the port
sudo lsof -ti:8088 | xargs kill -9

# Or use a different port
superset run -p 8089 --reload --debugger
```

### Frontend Issues

**Issue**: `yarn: command not found` or Yarn workspace errors
```bash
# Use npm instead of Yarn
npm install
```

**Issue**: Node version mismatch
```bash
# Switch to Node v20
nvm use 20
```

**Issue**: Build fails or slow performance
```bash
# Clear npm cache and rebuild
rm -rf node_modules package-lock.json
npm install
```

**Issue**: Out of memory during build
```bash
# Increase Node memory limit
export NODE_OPTIONS="--max-old-space-size=8192"
npm run dev
```

## Testing Your Setup

### Backend Test
```bash
# Run Python tests
pytest tests/unit_tests/

# Or run specific test file
pytest tests/unit_tests/db_engine_specs/test_base.py
```

### Frontend Test
```bash
cd superset-frontend

# Run all frontend tests
npm test

# Run specific test file
npm test -- src/components/Button/Button.test.tsx
```

### End-to-End Test (Playwright)
```bash
cd superset-frontend

# Run Playwright tests
npm run playwright:test

# Run in UI mode
npm run playwright:ui
```

## Useful Commands Reference

### Backend Commands
```bash
# Activate virtual environment
source venv/bin/activate

# Database migration
superset db upgrade

# Initialize Superset
superset init

# Create admin user
superset fab create-admin

# Run dev server
superset run -p 8088 --reload --debugger

# Run tests
pytest
```

### Frontend Commands
```bash
# Install dependencies
npm install

# Development build (watch mode)
npm run dev

# Development server (with HMR)
npm run dev-server

# Production build
npm run build

# Run tests
npm test

# Lint code
npm run lint

# Fix lint issues
npm run lint-fix

# Type checking
npm run type
```

## Additional Resources

- **Official Documentation**: https://superset.apache.org/docs/contributing/development
- **Contributing Guide**: [CONTRIBUTING.md](CONTRIBUTING.md)
- **API Documentation**: http://localhost:8088/swagger/v1
- **Storybook** (UI Components): `npm run storybook`

## Project Structure

```
superset/
├── superset/                    # Python backend (Flask, SQLAlchemy)
│   ├── views/api/              # REST API endpoints
│   ├── models/                 # Database models
│   ├── connectors/             # Database connections
│   └── config.py               # Configuration file
│
├── superset-frontend/          # React TypeScript frontend
│   ├── src/                    # Main source code
│   │   ├── components/         # Reusable components
│   │   ├── explore/            # Chart builder
│   │   ├── dashboard/          # Dashboard interface
│   │   └── SqlLab/             # SQL editor
│   ├── packages/               # Local packages (monorepo)
│   └── plugins/                # Chart plugins
│
├── tests/                      # Python/integration tests
├── requirements/               # Python dependencies
│   ├── base.txt
│   └── development.txt
└── docs/                       # Documentation
```

## Next Steps

1. **Explore the UI**: Visit http://localhost:8088 and login with admin credentials
2. **Make a change**: Edit a frontend component and see it rebuild automatically
3. **Read the docs**: Check out the [Contributing Guide](CONTRIBUTING.md)
4. **Join the community**: Visit https://superset.apache.org/community

---

**Setup Complete!** 🎉 You now have a fully functional Superset development environment with live reloading for both backend and frontend.
