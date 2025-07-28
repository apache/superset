# Superset GitHub Codespaces Development

This configuration uses `docker-compose-light.yml` for lightweight, multi-instance development in GitHub Codespaces.

## Quick Start

1. **Create a Codespace** from this repo (click "Code" → "Codespaces" → "Create codespace")
2. **Wait for setup** (~3-5 minutes first time)
3. **Start Superset**:
   ```bash
   docker-compose -p ${CODESPACE_NAME} -f docker-compose-light.yml up
   ```
4. **Access Superset** at the forwarded port 9001 URL (auto-opens)

## Connecting to Your Codespace

### VS Code Desktop
1. Install [GitHub Codespaces extension](https://marketplace.visualstudio.com/items?itemName=GitHub.codespaces)
2. Open Command Palette (`Cmd/Ctrl+Shift+P`)
3. Run "Codespaces: Connect to Codespace"
4. Select your Codespace

### SSH Access
```bash
# Install GitHub CLI if needed
brew install gh  # macOS
# or visit: https://cli.github.com/

# Login to GitHub
gh auth login

# List your Codespaces
gh cs list

# SSH into a Codespace
gh cs ssh -c <codespace-name>

# Or use the interactive selector
gh cs ssh
```

### Web Browser
- Go to https://github.com/codespaces
- Click on your Codespace to open in browser

## Running Multiple Instances

Perfect for testing different branches/features simultaneously:

```bash
# Instance 1 (in Codespace 1)
docker-compose -p feature1 -f docker-compose-light.yml up

# Instance 2 (in Codespace 2)
NODE_PORT=9002 docker-compose -p feature2 -f docker-compose-light.yml up
```

## Why docker-compose-light.yml?

- **Faster startup**: No Redis, nginx, or unnecessary services
- **Lower resources**: Important for Codespaces quotas
- **Isolated databases**: Each instance gets its own `superset_light` database
- **Simple access**: Single port (9001) with frontend proxy to backend

## Port Forwarding & URLs

When Superset starts, Codespaces automatically forwards port 9001:
- **Public URL**: `https://<codespace-name>-9001.app.github.dev`
- **Visibility**: Private by default (requires GitHub auth)
- **Make public**: Click port in "Ports" tab → Change visibility

To forward additional ports:
```bash
# From outside the Codespace
gh cs ports forward 5432:5432 -c <codespace-name>  # PostgreSQL
gh cs ports forward 8088:8088 -c <codespace-name>  # Backend API
```

## Tips for Claude Code Usage

When using `claude --yes` in Codespaces:
- All changes are isolated to your Codespace
- Database/volumes are separate from your local machine
- Can safely run destructive commands
- Easy to delete and recreate if needed

## Credentials

Default login (same as docker setup):
- Username: `admin`
- Password: `admin`

## Resource Usage

The light compose typically uses:
- ~2GB RAM (vs ~4GB for full stack)
- Minimal CPU when idle
- ~2GB disk for database + dependencies

## Troubleshooting

If services fail to start:
```bash
# Check logs
docker-compose -f docker-compose-light.yml logs

# Restart fresh
docker-compose -f docker-compose-light.yml down -v
docker-compose -f docker-compose-light.yml up
```
