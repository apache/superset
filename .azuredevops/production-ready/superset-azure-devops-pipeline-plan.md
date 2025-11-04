# Azure DevOps Pipeline Plan for Superset Fork

## Project Overview

This document outlines the plan for implementing an Azure DevOps pipeline for deploying a custom fork of Apache Superset. The pipeline will reuse the existing DevOps patterns from the oee-intellisuite monorepo while addressing the unique requirements of deploying Superset's multi-container architecture.

## Architecture Analysis

### Superset Container Components

Based on the analysis of the Superset docker-compose.yml, the following containers are required:

1. **superset-app**: Main web application (gunicorn)
2. **superset-worker**: Celery worker for async tasks
3. **superset-worker-beat**: Celery beat scheduler
4. **superset-init**: Initialization container (runs once)
5. **redis**: Cache and message broker
6. **db**: PostgreSQL database

### Container Entrypoints

The containers use the [`docker-bootstrap.sh`](docker/docker-bootstrap.sh:1) script with different parameters:

- `app-gunicorn`: Main web application
- `worker`: Celery worker
- `beat`: Celery beat scheduler
- `app`: Development server (not used in production)

## Pipeline Design

### Reusing oee-intellisuite Templates

The pipeline will leverage the existing template structure from `/home/jessman789/repos/oee-intellisuite/.azuredevops/templates/`:

1. **Stages**: [`client-deploy.yml`](/home/jessman789/repos/oee-intellisuite/.azuredevops/templates/stages/client-deploy.yml:1)
2. **Jobs**: [`build-docker.yml`](/home/jessman789/repos/oee-intellisuite/.azuredevops/templates/jobs/build-docker.yml:1), [`deploy-docker.yml`](/home/jessman789/repos/oee-intellisuite/.azuredevops/templates/jobs/deploy-docker.yml:1)
3. **Steps**: [`get-client-config.yml`](/home/jessman789/repos/oee-intellisuite/.azuredevops/templates/steps/get-client-config.yml:1)

### Pipeline Structure

```
superset-server/
├── .azuredevops/
│   ├── superset-deploy.yml          # Main pipeline file
│   └── templates/
│       └── superset/
│           ├── build-superset.yml   # Superset-specific build job
│           └── deploy-superset.yml  # Superset-specific deployment job
```

## Container Build Strategy

### Base Image Strategy

Given the complexity of the Superset [`Dockerfile`](Dockerfile:1), we'll use a multi-stage build approach:

1. **Single Base Image**: Build one comprehensive Superset image that can run different components based on command parameters
2. **Build Optimization**: Cache the base image in ACR to avoid rebuilding for every deployment
3. **Tagging Strategy**: Use semantic versioning with environment tags (e.g., `v1.2.3-prod`, `v1.2.3-staging`)

### Build Process

1. **Frontend Build**: Node.js stage builds React assets
2. **Python Dependencies**: Install all required Python packages
3. **Application Code**: Copy Superset source code
4. **Final Image**: Combine all components into a production-ready image

## Client Configuration Integration

### Secret Management

Following the oee-intellisuite pattern, secrets will be managed through:

1. **Variable Groups**: Environment-specific variable groups (e.g., `Production-Secret`, `Staging-Secret`)
2. **Client Config JSON**: Structured configuration containing database credentials and other secrets
3. **PowerShell Scripts**: [`Get-ClientDbUrls.ps1`](/home/jessman789/repos/oee-intellisuite/.azuredevops/scripts/Get-ClientDbUrls.ps1:1) for parsing configuration

### Required Configuration

The client configuration will need to include:

```json
{
  "client": {
    "name": "client-name"
  },
  "app-suite": [
    {
      "postgres": {
        "host": "postgres-host",
        "port": 5432,
        "database": "superset",
        "admin": { "user": "admin", "password": "password" },
        "owner": { "user": "owner", "password": "password" },
        "writer": { "user": "writer", "password": "password" },
        "reader": { "user": "reader", "password": "password" }
      },
      "redis": {
        "host": "redis-host",
        "port": 6379,
        "password": "redis-password"
      },
      "superset": {
        "secretKey": "flask-secret-key",
        "adminPassword": "admin-password"
      }
    }
  ]
}
```

## Deployment Strategy

### Multi-Container Deployment

The deployment will orchestrate all Superset components:

1. **Database Initialization**: Run superset-init container once
2. **Core Services**: Deploy Redis and PostgreSQL containers
3. **Application Services**: Deploy superset-app, superset-worker, and superset-worker-beat
4. **Networking**: Configure Docker network for inter-container communication
5. **Health Checks**: Implement container health monitoring

### Container Orchestration

The deployment will use Docker Compose-style orchestration but implemented through PowerShell scripts in the Azure DevOps pipeline:

```powershell
# Example deployment script structure
docker network create superset-network
docker run -d --name superset-db --network superset-network postgres:16
docker run -d --name superset-redis --network superset-network redis:7
docker run -d --name superset-app --network superset-network superset:latest app-gunicorn
docker run -d --name superset-worker --network superset-network superset:latest worker
docker run -d --name superset-beat --network superset-network superset:latest beat
```

## Pipeline Implementation

### Main Pipeline File: `.azuredevops/superset-deploy.yml`

```yaml
trigger:
  branches:
    include:
      - main
      - release/*

pr: none

parameters:
  - name: targetEnvironment
    displayName: Target Environment
    type: string
  - name: supersetVersion
    displayName: Superset Version Tag
    type: string
    default: "latest"

variables:
  appName: superset
  containerRegistry: "IntelliSuite Container Registry"
  acrDomain: "intellisuite.azurecr.io"
  dockerNetwork: "superset-network"

stages:
  - stage: Build
    displayName: Build Superset Images
    jobs:
      - template: templates/superset/build-superset.yml
        parameters:
          targetEnvironment: ${{ parameters.targetEnvironment }}
          supersetVersion: ${{ parameters.supersetVersion }}

  - stage: Deploy
    displayName: Deploy Superset Stack
    dependsOn: Build
    jobs:
      - template: templates/superset/deploy-superset.yml
        parameters:
          targetEnvironment: ${{ parameters.targetEnvironment }}
          supersetVersion: ${{ parameters.supersetVersion }}
```

### Build Job Template: `.azuredevops/templates/superset/build-superset.yml`

```yaml
parameters:
  - name: targetEnvironment
    type: string
  - name: supersetVersion
    type: string
    default: "latest"

jobs:
  - job: BuildSuperset
    displayName: Build Superset Docker Image
    variables:
      - group: ${{ format('{0}-Secret', parameters.targetEnvironment) }}
    pool:
      vmImage: "ubuntu-latest"
    steps:
      - checkout: self
        clean: true

      - task: Docker@2
        displayName: Login to Azure Container Registry
        inputs:
          command: login
          containerRegistry: "$(containerRegistry)"

      - task: Docker@2
        displayName: Build Superset Image
        inputs:
          command: build
          containerRegistry: "$(containerRegistry)"
          repository: "superset"
          Dockerfile: "Dockerfile"
          buildContext: "."
          tags: |
            ${{ parameters.supersetVersion }}
            latest
          arguments: |
            --target lean
            --build-arg BUILD_TRANSLATIONS=false

      - task: Docker@2
        displayName: Push Superset Image
        inputs:
          command: push
          containerRegistry: "$(containerRegistry)"
          repository: "superset"
          tags: |
            ${{ parameters.supersetVersion }}
            latest

      - task: PublishPipelineArtifact@1
        inputs:
          targetPath: ".azuredevops/scripts"
          artifact: tools
```

### Deployment Job Template: `.azuredevops/templates/superset/deploy-superset.yml`

```yaml
parameters:
  - name: targetEnvironment
    type: string
  - name: supersetVersion
    type: string
    default: "latest"

jobs:
  - deployment: DeploySuperset
    displayName: Deploy Superset Stack
    variables:
      - group: ${{ format('{0}-Secret', parameters.targetEnvironment) }}
    environment:
      name: ${{ parameters.targetEnvironment }}
      resourceType: VirtualMachine
    strategy:
      runOnce:
        deploy:
          steps:
            - checkout: none

            - task: DownloadPipelineArtifact@2
              inputs:
                artifact: tools
                path: $(Agent.TempDirectory)/tools

            - template: ../../steps/get-client-config.yml
              parameters:
                targetEnvironment: ${{ parameters.targetEnvironment }}

            - task: PowerShell@2
              displayName: Parse client-config
              inputs:
                pwsh: true
                targetType: inline
                script: |
                  $parser = "$(Agent.TempDirectory)/tools/Get-ClientDbUrls.ps1"
                  $cfg = "$(cfgPath)"
                  $urls = & $parser -ConfigPath $cfg -App "superset" -Docker
                  if ($urls.PgDbUrl) { Write-Host "##vso[task.setvariable variable=PG_DB_URL;issecret=true]$($urls.PgDbUrl)" }
                  if ($urls.RedisUrl) { Write-Host "##vso[task.setvariable variable=REDIS_URL;issecret=true]$($urls.RedisUrl)" }

            - task: Docker@2
              displayName: Login to Azure Container Registry
              inputs:
                command: login
                containerRegistry: "$(containerRegistry)"

            - task: PowerShell@2
              displayName: Deploy Superset Stack
              env:
                PG_DB_URL: $(PG_DB_URL)
                REDIS_URL: $(REDIS_URL)
                SUPERSET_SECRET_KEY: $(SUPERSET_SECRET_KEY)
                ADMIN_PASSWORD: $(ADMIN_PASSWORD)
              inputs:
                pwsh: true
                targetType: inline
                script: |
                  # Create network
                  docker network create superset-network 2>$null || Write-Host "Network already exists"

                  # Deploy PostgreSQL
                  docker run -d --name superset-db --network superset-network `
                    -e POSTGRES_DB=superset `
                    -e POSTGRES_USER=superset `
                    -e POSTGRES_PASSWORD=$(POSTGRES_PASSWORD) `
                    postgres:16

                  # Deploy Redis
                  docker run -d --name superset-redis --network superset-network `
                    redis:7

                  # Wait for database to be ready
                  Start-Sleep -Seconds 30

                  # Run initialization
                  docker run --rm --network superset-network `
                    -e DATABASE_URL="$(PG_DB_URL)" `
                    -e REDIS_URL="$(REDIS_URL)" `
                    -e ADMIN_PASSWORD="$(ADMIN_PASSWORD)" `
                    $(acrDomain)/superset:${{ parameters.supersetVersion }} `
                    /app/docker/docker-init.sh

                  # Deploy main application
                  docker run -d --name superset-app --network superset-network `
                    -p 8088:8088 `
                    -e DATABASE_URL="$(PG_DB_URL)" `
                    -e REDIS_URL="$(REDIS_URL)" `
                    -e SECRET_KEY="$(SUPERSET_SECRET_KEY)" `
                    $(acrDomain)/superset:${{ parameters.supersetVersion }} `
                    /app/docker/docker-bootstrap.sh app-gunicorn

                  # Deploy worker
                  docker run -d --name superset-worker --network superset-network `
                    -e DATABASE_URL="$(PG_DB_URL)" `
                    -e REDIS_URL="$(REDIS_URL)" `
                    $(acrDomain)/superset:${{ parameters.supersetVersion }} `
                    /app/docker/docker-bootstrap.sh worker

                  # Deploy beat
                  docker run -d --name superset-beat --network superset-network `
                    -e DATABASE_URL="$(PG_DB_URL)" `
                    -e REDIS_URL="$(REDIS_URL)" `
                    $(acrDomain)/superset:${{ parameters.supersetVersion }} `
                    /app/docker/docker-bootstrap.sh beat

            - task: PowerShell@2
              displayName: Verify Deployment
              inputs:
                pwsh: true
                targetType: inline
                script: |
                  Start-Sleep -Seconds 30

                  # Check container health
                  $containers = @("superset-db", "superset-redis", "superset-app", "superset-worker", "superset-beat")
                  foreach ($container in $containers) {
                    $status = docker inspect --format '{{.State.Status}}' $container
                    if ($status -ne "running") {
                      Write-Error "Container $container is not running (status: $status)"
                      docker logs $container | Write-Host
                      exit 1
                    }
                    Write-Host "Container $container is running"
                  }

                  # Check application health
                  try {
                    $response = Invoke-WebRequest -Uri "http://localhost:8088/health" -TimeoutSec 60
                    if ($response.StatusCode -eq 200) {
                      Write-Host "Superset application is healthy"
                    } else {
                      Write-Error "Superset health check failed with status: $($response.StatusCode)"
                      exit 1
                    }
                  } catch {
                    Write-Error "Failed to connect to Superset: $($_.Exception.Message)"
                    exit 1
                  }
```

## Repository Import Strategy

To reuse the oee-intellisuite templates without copying:

1. **Repository Resource**: Add oee-intellisuite as a repository resource in Azure DevOps
2. **Template Reference**: Use relative paths to reference templates across repositories
3. **Checkout Strategy**: Checkout both repositories during pipeline execution

```yaml
resources:
  repositories:
    - repository: oee-intellisuite
      type: git
      name: oee-intellisuite
      ref: main

steps:
  - checkout: self
  - checkout: oee-intellisuite
```

## Implementation Steps

1. **Create Pipeline Structure**: Set up the `.azuredevops` directory structure in the superset-server repository
2. **Implement Pipeline Files**: Create the main pipeline and template files
3. **Configure Repository Resources**: Set up oee-intellisuite as a repository resource
4. **Test Build Process**: Verify the Superset image builds correctly
5. **Test Deployment**: Validate the multi-container deployment
6. **Configure Client Secrets**: Set up variable groups with client configurations
7. **Documentation**: Create comprehensive documentation for maintenance

## Benefits of This Approach

1. **Reusability**: Leverages existing DevOps patterns and templates
2. **Consistency**: Maintains consistency with other application deployments
3. **Scalability**: Supports multiple environments and clients
4. **Security**: Properly manages secrets through client configuration
5. **Efficiency**: Optimizes Docker builds with caching and ACR storage
6. **Maintainability**: Clear separation of concerns and modular design

## Future Enhancements

1. **Automated Testing**: Add integration tests to the pipeline
2. **Rollback Strategy**: Implement automated rollback capabilities
3. **Monitoring**: Integrate application monitoring and alerting
4. **Blue-Green Deployment**: Implement zero-downtime deployments
5. **Auto-scaling**: Add container auto-scaling based on load
