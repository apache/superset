# Azure DevOps Pipeline - Multi-OS Deployment

## Overview

The Superset deployment pipeline supports both Windows Server and Linux client environments using PowerShell Core (pwsh). This cross-platform capability allows a single pipeline definition to deploy to heterogeneous infrastructure.

## Cross-Platform Support

### Pipeline Technology

The deployment pipeline uses **PowerShell Core (pwsh)** for all deployment tasks. PowerShell Core is a cross-platform edition of PowerShell that runs on:

- **Windows Server 2019+** - Native PowerShell 5+ support
- **Linux (Ubuntu, Debian, RHEL, Fedora, etc.)** - PowerShell Core 7+ required
- **macOS** - PowerShell Core 7+ supported (for testing)

### Why PowerShell Core?

Previously, the pipeline used Bash tasks which failed on Windows Server deployment agents with:
```
Bash/WSL_E_LOCAL_SYSTEM_NOT_SUPPORTED
```

Bash on Windows requires Windows Subsystem for Linux (WSL), which cannot run under the Local System account used by Azure DevOps agents. PowerShell Core solves this by:

- Native Windows support without WSL
- Cross-platform syntax for Docker commands
- Consistent scripting across all operating systems
- Full integration with Azure DevOps task system

## Agent Requirements

### Windows Server Deployment Agents

**Requirements:**
- PowerShell 5.1+ (native on Windows Server 2016+)
- Docker Desktop or Docker Engine
- Azure DevOps agent (self-hosted or Microsoft-hosted)

**No additional installation required** - PowerShell is included with Windows Server.

### Linux Deployment Agents

**Requirements:**
- PowerShell Core 7+ (pwsh)
- Docker Engine
- Azure DevOps agent (self-hosted)

**Installing PowerShell Core on Linux:**

```bash
# Install PowerShell Core 7+
curl -sSL https://aka.ms/install-powershell.sh | bash -s -- -mt

# Verify installation
pwsh --version
```

**Distribution-specific instructions:**

- **Ubuntu/Debian:**
  ```bash
  # Update package list
  sudo apt-get update
  # Install PowerShell
  sudo apt-get install -y wget apt-transport-https software-properties-common
  wget -q https://packages.microsoft.com/config/ubuntu/22.04/packages-microsoft-prod.deb
  sudo dpkg -i packages-microsoft-prod.deb
  sudo apt-get update
  sudo apt-get install -y powershell
  ```

- **RHEL/CentOS/Fedora:**
  ```bash
  # Register Microsoft RedHat repository
  sudo rpm -Uvh https://packages.microsoft.com/config/rhel/9/packages-microsoft-prod.rpm
  # Install PowerShell
  sudo dnf install -y powershell
  ```

## Supported Environments

| Environment | OS | Deployment Agents | Pool |
|-------------|-------|-------------------|------|
| blue-dev | Linux (Ubuntu) | Linux agents with pwsh | Linux-Hosted |
| lat360foods | Windows Server 2019+ | Windows agents | Windows-Hosted |
| Other clients | Windows Server | Windows agents | Windows-Hosted |

## Pipeline Parameters

When running the pipeline, configure these parameters:

### Required Parameters

- **targetEnvironment**: The client environment to deploy to
  - Examples: `blue-dev`, `lat360foods`
  - Default: `blue-dev`

### Optional Parameters

- **dockerPool**: Build agent pool for Docker image build stage
  - Default: `Linux-Hosted`
  - Recommended: Use Linux agents for builds (faster, more efficient)

- **cleanBuild**: Disable caching for fresh builds
  - Default: `false`
  - Set to `true` when troubleshooting build issues

## Pipeline Stages

### Build Stage

- **Agent Pool**: Linux-Hosted (recommended) or any pool with Docker
- **Tasks**: Bash (for cross-platform compatibility during build)
- **Output**: Docker image pushed to Azure Container Registry

### Deploy Stage

- **Agent Pool**: Matches target environment (Windows or Linux)
- **Tasks**: PowerShell Core (pwsh)
- **Operations**: Docker Compose deployment, health checks

## Task Conversions

The pipeline has been converted from Bash to PowerShell Core. Key conversions:

| Operation | Bash Syntax | PowerShell Syntax |
|-----------|-------------|-------------------|
| Directory listing | `ls -la` | `Get-ChildItem -Force` |
| Change directory | `cd /path` | `Set-Location /path` |
| File existence test | `[ -f "$FILE" ]` | `Test-Path $FILE` |
| Environment variables | `source file.env` | `Get-Content file.env \| ForEach-Object { ... }` |
| HTTP request | `curl -fs URL` | `Invoke-WebRequest -Uri URL -UseBasicParsing` |
| Suppress errors | `2>/dev/null` | `2>$null` |
| Sleep | `sleep 10` | `Start-Sleep -Seconds 10` |
| Loop | `for i in {1..60}` | `for ($i = 1; $i -le 60; $i++)` |

**Docker Commands:** Remain identical across both shells.

## Deployment Workflow

### 1. Build Stage (Linux Agents)

```yaml
1. Validate workspace structure
2. Set build variables (date, commit SHA, tags)
3. Build Docker image (with optional --no-cache)
4. Push to Azure Container Registry
5. Publish deployment artifacts
```

### 2. Deploy Stage (Windows or Linux Agents)

```yaml
1. Download artifacts
2. Set working directory
3. Validate deployment workspace
4. Load deployment variables from artifact
5. Set Docker InitDB directory path
6. Create .env.deploy file with secrets
7. Cleanup old containers
8. Deploy with docker-compose
9. Verify health (up to 10 minute wait)
```

## Troubleshooting

### "pwsh: command not found" on Linux

**Problem:** Linux agent doesn't have PowerShell Core installed.

**Solution:** Install PowerShell Core 7+:
```bash
curl -sSL https://aka.ms/install-powershell.sh | bash -s -- -mt
```

### "Running WSL as local system is not supported"

**Problem:** This error should no longer occur with pwsh tasks.

**If it appears:**
1. Verify the task is using `pwsh` not `bash`
2. Check `.azuredevops/superset-pipeline.yml` for any remaining `bash:` tasks in the Deploy stage
3. Replace with `pwsh:` tasks

### Docker Commands Fail

**Problem:** Docker not available on deployment agent.

**Solution:**
1. Verify Docker is installed: `docker --version`
2. Verify Docker service is running: `docker ps`
3. Check Azure DevOps agent has Docker permissions

### Health Check Timeout

**Problem:** Deployment succeeds but health check fails after 10 minutes.

**Solution:**
1. Check container logs: `docker compose logs`
2. Verify environment variables in `.env.deploy`
3. Check database connectivity
4. Review Superset logs for startup errors

## Security Considerations

### Secret Management

- **SUPERSET_SECRET_KEY**: Sourced from client-config (Azure DevOps secret variable)
- **SUPERSET_ADMIN_PASSWORD**: Generated and passed via pipeline variables
- Never hardcode secrets in pipeline YAML

### Agent Security

- Windows agents run under Local System account
- Linux agents run under the agent service account
- Ensure proper permissions for Docker operations

## Development and Testing

### Local Testing with pwsh

To test deployment scripts locally:

```powershell
# On Windows
powershell -File ./test-deploy.ps1

# On Linux
pwsh -File ./test-deploy.ps1
```

### Pipeline Validation

Before committing changes:

```bash
# Validate YAML syntax
# Use Azure DevOps CLI or web UI validation
```

## Migration Notes

### From Bash to PowerShell Core

This pipeline was converted from Bash to PowerShell Core in February 2026. All deployment tasks in the Deploy stage now use `pwsh` instead of `bash`.

**Key changes:**
- All `bash:` tasks replaced with `pwsh:` tasks
- Shell syntax converted to PowerShell equivalents
- Docker commands remain identical
- Error handling uses PowerShell conventions

### Backward Compatibility

- Build stage continues to use Bash (Linux-only agents)
- Deploy stage now supports both Windows and Linux agents
- Pipeline parameters remain unchanged

## Related Documentation

- [Simple Deployment Guide](./superset-simple-deployment.md) - Basic Docker Compose deployment
- [Deployment Architecture](./production-ready/superset-deployment-architecture.md) - Production architecture
- [Pipeline Plan](./production-ready/superset-azure-devops-pipeline-plan.md) - Implementation details

## Support

For issues or questions:
1. Check this documentation
2. Review pipeline run logs in Azure DevOps
3. Consult Azure DevOps pipeline documentation
4. Check Superset deployment troubleshooting guides

---

**Last Updated:** 2026-02-04
**Pipeline Version:** Multi-OS Support (PowerShell Core)
