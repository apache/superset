---
title: Development How-tos
sidebar_position: 7
---

<!--
Licensed to the Apache Software Foundation (ASF) under one
or more contributor license agreements.  See the NOTICE file
distributed with this work for additional information
regarding copyright ownership.  The ASF licenses this file
to you under the Apache License, Version 2.0 (the
"License"); you may not use this file except in compliance
with the License.  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing,
software distributed under the License is distributed on an
"AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, either express or implied.  See the License for the
specific language governing permissions and limitations
under the License.
-->

# Development How-tos

This guide contains specific instructions for common development tasks in Superset.

## Contributing to Documentation

The documentation site is built using [Docusaurus](https://docusaurus.io/). All documentation lives in the `docs` folder, written in Markdown format.

### Local Development

To set up your local environment for documentation development:

```bash
cd docs
npm install
npm run start
```

The site will be available at http://localhost:3000

### Build

To create a production build:

```bash
npm run build
npm run serve  # Test the build locally
```

### Deployment

Documentation is automatically deployed when changes are merged to master.

## Creating Visualization Plugins

Visualization plugins allow you to add custom chart types to Superset. They are built as npm packages that integrate with the Superset frontend.

### Prerequisites

- Node.js 18+
- npm or yarn
- A local Superset development environment

### Creating a simple Hello World viz plugin

1. **Install the Superset Yeoman generator**:
```bash
npm install -g @superset-ui/generator-superset
```

2. **Create a new plugin**:
```bash
mkdir superset-plugin-chart-hello-world
cd superset-plugin-chart-hello-world
yo @superset-ui/superset
```

3. **Follow the prompts**:
- Package name: `superset-plugin-chart-hello-world`
- Chart type: Choose your preferred type
- Include storybook: Yes (recommended for development)

4. **Develop your plugin**:
The generator creates a complete plugin structure with TypeScript, React components, and build configuration.

5. **Test your plugin locally**:
```bash
npm run dev
```

6. **Link to your local Superset**:
```bash
npm link
# In your Superset frontend directory:
npm link superset-plugin-chart-hello-world
```

7. **Import and register in Superset**:
Edit `superset-frontend/src/visualizations/presets/MainPreset.ts` to include your plugin.

## Testing

### Python Testing

Run Python tests using pytest:

```bash
# Run all tests
pytest

# Run specific test file
pytest tests/unit_tests/test_specific.py

# Run with coverage
pytest --cov=superset

# Run only unit tests
pytest tests/unit_tests

# Run only integration tests  
pytest tests/integration_tests
```

#### Testing with local Presto connections

To test against Presto:

```bash
# Start Presto locally using Docker
docker run -p 8080:8080 \
  --name presto \
  -d prestodb/presto

# Configure in superset_config.py
SQLALCHEMY_DATABASE_URI = 'presto://localhost:8080/hive/default'
```

### Frontend Testing

Run frontend tests using Jest:

```bash
cd superset-frontend

# Run all tests
npm run test

# Run with coverage
npm run test -- --coverage

# Run in watch mode
npm run test -- --watch

# Run specific test file
npm run test -- MyComponent.test.tsx
```

### E2E Integration Testing

We support both Playwright (recommended) and Cypress for end-to-end testing.

#### Playwright (Recommended - NEW)

Playwright is our new E2E testing framework, gradually replacing Cypress.

```bash
# Navigate to frontend directory
cd superset-frontend

# Run all Playwright tests
npm run playwright:test
# or: npx playwright test

# Run with interactive UI for debugging
npm run playwright:ui
# or: npx playwright test --ui

# Run in headed mode (see browser)
npm run playwright:headed
# or: npx playwright test --headed

# Run specific test file
npx playwright test tests/auth/login.spec.ts

# Run with debug mode (step through tests)
npm run playwright:debug tests/auth/login.spec.ts
# or: npx playwright test --debug tests/auth/login.spec.ts

# Generate test report
npm run playwright:report
```

#### Cypress (DEPRECATED - will be removed)

Cypress is being phased out in favor of Playwright but is still available:

```bash
# Set base URL for Cypress
export CYPRESS_BASE_URL='http://localhost:8088'
export CYPRESS_DATABASE=test
export CYPRESS_USERNAME=admin
export CYPRESS_PASSWORD=admin

# Navigate to Cypress directory
cd superset-frontend/cypress-base

# Run interactively
npm run cypress-debug

# Run headless (like CI)
npm run cypress-run-chrome

# Run specific file
npm run cypress-run-chrome -- --spec "cypress/e2e/dashboard/dashboard.test.ts"
```

### Debugging Server App

For debugging the Flask backend:

#### Using PyCharm/IntelliJ

1. Create a new Python configuration
2. Set script path to `superset/app.py`
3. Set environment variables:
   - `FLASK_ENV=development`
   - `SUPERSET_CONFIG_PATH=/path/to/superset_config.py`
4. Set breakpoints and run in debug mode

#### Using VS Code

1. Add to `.vscode/launch.json`:
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Python: Flask",
      "type": "python",
      "request": "launch",
      "module": "flask",
      "env": {
        "FLASK_APP": "superset/app.py",
        "FLASK_ENV": "development"
      },
      "args": ["run", "--no-debugger", "--no-reload"],
      "jinja": true
    }
  ]
}
```

2. Set breakpoints and press F5 to debug

### Debugging Server App in Kubernetes Environment

To debug Flask running in a POD inside a kubernetes cluster, you'll need to make sure the pod runs as root and is granted the `SYS_PTRACE` capability. These settings should not be used in production environments.

```yaml
  securityContext:
    capabilities:
      add: ["SYS_PTRACE"]
```

See [set capabilities for a container](https://kubernetes.io/docs/tasks/configure-pod-container/security-context/#set-capabilities-for-a-container) for more details.

Once the pod is running as root and has the `SYS_PTRACE` capability it will be able to debug the Flask app.

You can follow the same instructions as in `docker compose`. Enter the pod and install the required library and packages: gdb, netstat and debugpy.

Often in a Kubernetes environment nodes are not addressable from outside the cluster. VSCode will thus be unable to remotely connect to port 5678 on a Kubernetes node. In order to do this you need to create a tunnel that port forwards 5678 to your local machine.

```bash
kubectl port-forward  pod/superset-<some random id> 5678:5678
```

You can now launch your VSCode debugger with the same config as above. VSCode will connect to 127.0.0.1:5678 which is forwarded by kubectl to your remote kubernetes POD.

### Storybook

See the dedicated [Storybook documentation](../testing/storybook) for information on running Storybook locally and adding new stories.

## Contributing Translations

Superset uses Flask-Babel for internationalization.

### Enabling language selection

Edit `superset_config.py`:

```python
LANGUAGES = {
    'en': {'flag': 'us', 'name': 'English'},
    'fr': {'flag': 'fr', 'name': 'French'},
    'zh': {'flag': 'cn', 'name': 'Chinese'},
}
```

### Creating a new language dictionary

```bash
# Initialize a new language
pybabel init -i superset/translations/messages.pot -d superset/translations -l de
```

### Extracting new strings for translation

```bash
# Extract Python strings
pybabel extract -F babel.cfg -o superset/translations/messages.pot -k lazy_gettext superset

# Extract JavaScript strings
npm run build-translation
```

### Updating language files

```bash
# Update all language files with new strings
pybabel update -i superset/translations/messages.pot -d superset/translations
```

### Applying translations

```bash
# Frontend
cd superset-frontend
npm run build-translation

# Backend
pybabel compile -d superset/translations
```

## Linting

### Python

We use Ruff for Python linting and formatting:

```bash
# Auto-format using ruff
ruff format .

# Lint check with ruff
ruff check .

# Lint fix with ruff
ruff check --fix .
```

Pre-commit hooks run automatically on `git commit` if installed.

### TypeScript / JavaScript

We use a hybrid linting approach combining OXC (Oxidation Compiler) for standard rules and a custom AST-based checker for Superset-specific patterns.

#### Quick Commands

```bash
cd superset-frontend

# Run both OXC and custom rules
npm run lint:full

# Run OXC linter only (faster for most checks)
npm run lint

# Fix auto-fixable issues with OXC
npm run lint-fix

# Run custom rules checker only
npm run check:custom-rules

# Run tsc (typescript) checks
npm run type

# Format with Prettier
npm run prettier
```

#### Architecture

The linting system consists of two components:

1. **OXC Linter** (`oxlint`) - A Rust-based linter that's 50-100x faster than ESLint
   - Handles all standard JavaScript/TypeScript rules
   - Configured via `oxlint.json`
   - Runs via `npm run lint` or `npm run lint-fix`

2. **Custom Rules Checker** - A Node.js AST-based checker for Superset-specific patterns
   - Enforces no literal colors (use theme colors)
   - Prevents FontAwesome usage (use @superset-ui/core Icons)
   - Validates i18n template usage (no template variables)
   - Runs via `npm run check:custom-rules`

#### Why This Approach?

- **50-100x faster linting** compared to ESLint for standard rules via OXC
- **Apache-compatible** - No custom binaries, ASF-friendly
- **Maintainable** - Custom rules in JavaScript, not Rust
- **Flexible** - Can evolve as OXC adds plugin support

#### Troubleshooting

**"Plugin 'basic-custom-plugin' not found" Error**

Ensure you're using the explicit config:
```bash
npx oxlint --config oxlint.json
```

**Custom Rules Not Running**

Verify the AST parsing dependencies are installed:
```bash
npm ls @babel/parser @babel/traverse glob
```

#### Adding New Custom Rules

1. Edit `scripts/check-custom-rules.js`
2. Add a new check function following the AST visitor pattern
3. Call the function in `processFile()`
4. Test with `npm run check:custom-rules`

## GitHub Ephemeral Environments

For every PR, an ephemeral environment is automatically deployed for testing.

Access pattern: `https://pr-{PR_NUMBER}.superset.apache.org`

Features:
- Automatically deployed on PR creation/update
- Includes sample data
- Destroyed when PR is closed
- Useful for UI/UX review

## Tips and Tricks

### Using Docker for Development

```bash
# Rebuild specific service
docker compose build superset

# View logs
docker compose logs -f superset

# Execute commands in container
docker compose exec superset bash

# Reset database
docker compose down -v
docker compose up
```

### Hot Reloading

**Frontend**: Webpack dev server provides hot module replacement automatically.

**Backend**: Use Flask debug mode:
```bash
FLASK_ENV=development superset run -p 8088 --with-threads --reload
```

### Performance Profiling

For Python profiling:
```python
# In superset_config.py
PROFILING = True
```

For React profiling:
- Use React DevTools Profiler
- Enable performance marks in Chrome DevTools

### Database Migrations

```bash
# Create a new migration
superset db migrate -m "Description of changes"

# Apply migrations
superset db upgrade

# Downgrade
superset db downgrade
```

### Useful Aliases

Add to your shell profile:

```bash
alias sdev='FLASK_ENV=development superset run -p 8088 --with-threads --reload'
alias stest='pytest tests/unit_tests'
alias slint='pre-commit run --all-files'
alias sfront='cd superset-frontend && npm run dev-server'
```

## Common Issues and Solutions

### Node/npm Issues

```bash
# Clear npm cache
npm cache clean --force

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### Python Environment Issues

```bash
# Recreate virtual environment
deactivate
rm -rf venv
python3 -m venv venv
source venv/bin/activate
pip install -r requirements/development.txt
pip install -e .
```

### Database Issues

```bash
# Reset local database
superset db downgrade -r base
superset db upgrade
superset init
```

### Port Already in Use

```bash
# Find process using port
lsof -i :8088
# Kill process
kill -9 [PID]
```

## Reporting Security Vulnerabilities

Please report security vulnerabilities to **private@superset.apache.org**.

In the event a community member discovers a security flaw in Superset, it is important to follow the [Apache Security Guidelines](https://www.apache.org/security/committers.html) and release a fix as quickly as possible before public disclosure. Reporting security vulnerabilities through the usual GitHub Issues channel is not ideal as it will publicize the flaw before a fix can be applied.

## SQL Lab Async Configuration

It's possible to configure a local database to operate in `async` mode, to work on `async` related features.

To do this, you'll need to:

- Add an additional database entry. We recommend you copy the connection string from the database labeled `main`, and then enable `SQL Lab` and the features you want to use. Don't forget to check the `Async` box
- Configure a results backend, here's a local `FileSystemCache` example, not recommended for production, but perfect for testing (stores cache in `/tmp`)

  ```python
  from flask_caching.backends.filesystemcache import FileSystemCache
  RESULTS_BACKEND = FileSystemCache('/tmp/sqllab')
  ```

- Start up a celery worker

  ```bash
  celery --app=superset.tasks.celery_app:app worker -O fair
  ```

Note that:
- for changes that affect the worker logic, you'll have to restart the `celery worker` process for the changes to be reflected.
- The message queue used is a `sqlite` database using the `SQLAlchemy` experimental broker. Ok for testing, but not recommended in production
- In some cases, you may want to create a context that is more aligned to your production environment, and use the similar broker as well as results backend configuration

## Async Chart Queries

It's possible to configure database queries for charts to operate in `async` mode. This is especially useful for dashboards with many charts that may otherwise be affected by browser connection limits. To enable async queries for dashboards and Explore, the following dependencies are required:

- Redis 5.0+ (the feature utilizes [Redis Streams](https://redis.io/topics/streams-intro))
- Cache backends enabled via the `CACHE_CONFIG` and `DATA_CACHE_CONFIG` config settings
- Celery workers configured and running to process async tasks

## Need Help?

- Check the [FAQ](https://superset.apache.org/docs/frequently-asked-questions)
- Ask in [Slack](https://apache-superset.slack.com)
- Search [GitHub Issues](https://github.com/apache/superset/issues)
- Post in [GitHub Discussions](https://github.com/apache/superset/discussions)
