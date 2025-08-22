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
---
title: CLI Documentation
sidebar_position: 1
---

# Superset Extensions CLI

The `apache-superset-extensions-cli` provides command-line tools for creating, developing, and packaging Superset extensions.

## Installation

```bash
pip install apache-superset-extensions-cli
```

## Commands

### init

Creates a new extension project with the standard folder structure.

```bash
superset-extensions init <extension-name> [options]
```

**Options:**
- `--template <template>`: Use a specific template (default: basic)
- `--author <name>`: Set the author name
- `--description <text>`: Set the extension description
- `--with-backend`: Include backend code structure

**Example:**
```bash
superset-extensions init my-extension \
  --author "John Doe" \
  --description "Adds custom analytics to SQL Lab" \
  --with-backend
```

**Generated Structure:**
```
my-extension/
├── extension.json
├── frontend/
│   ├── src/
│   │   └── index.tsx
│   ├── package.json
│   ├── tsconfig.json
│   └── webpack.config.js
├── backend/
│   ├── src/
│   │   └── my_extension/
│   │       ├── __init__.py
│   │       └── entrypoint.py
│   ├── tests/
│   ├── pyproject.toml
│   └── requirements.txt
└── README.md
```

### dev

Starts the development server with hot reloading.

```bash
superset-extensions dev [options]
```

**Options:**
- `--port <port>`: Development server port (default: 9001)
- `--host <host>`: Development server host (default: localhost)
- `--no-watch`: Disable file watching
- `--verbose`: Show detailed output

**Example:**
```bash
# Start development server
superset-extensions dev

# Output:
⚙️  Building frontend assets...
✅ Frontend rebuilt
✅ Backend files synced
✅ Manifest updated
👀 Watching for changes...
```

### build

Builds the extension for production.

```bash
superset-extensions build [options]
```

**Options:**
- `--mode <mode>`: Build mode (development | production)
- `--analyze`: Generate bundle analysis
- `--source-maps`: Include source maps

**Example:**
```bash
# Production build
superset-extensions build --mode production

# With analysis
superset-extensions build --analyze
```

### bundle

Creates a `.supx` package for distribution.

```bash
superset-extensions bundle [options]
```

**Options:**
- `--output <path>`: Output directory (default: current)
- `--sign`: Sign the package (requires certificate)
- `--compress`: Compression level (0-9, default: 6)

**Example:**
```bash
# Create bundle
superset-extensions bundle

# Creates: my-extension-1.0.0.supx
```

### validate

Validates extension configuration and structure.

```bash
superset-extensions validate [options]
```

**Options:**
- `--fix`: Auto-fix common issues
- `--strict`: Enable strict validation

**Checks:**
- Valid extension.json syntax
- Required files present
- Dependency versions
- Module exports
- TypeScript configuration

**Example:**
```bash
superset-extensions validate --strict

# Output:
✅ extension.json valid
✅ Frontend structure valid
✅ Backend structure valid
⚠️  Warning: Missing LICENSE file
✅ Validation passed with warnings
```

### test

Runs extension tests.

```bash
superset-extensions test [options]
```

**Options:**
- `--coverage`: Generate coverage report
- `--watch`: Run in watch mode
- `--frontend-only`: Run only frontend tests
- `--backend-only`: Run only backend tests

**Example:**
```bash
# Run all tests
superset-extensions test --coverage

# Watch mode for frontend
superset-extensions test --frontend-only --watch
```

### publish

Publishes extension to a registry (future feature).

```bash
superset-extensions publish [options]
```

**Options:**
- `--registry <url>`: Registry URL
- `--token <token>`: Authentication token
- `--dry-run`: Simulate publish

## Configuration

### Project Configuration

The CLI reads configuration from multiple sources:

1. **extension.json** - Extension metadata
2. **package.json** - Frontend dependencies
3. **pyproject.toml** - Backend configuration
4. **.extensionrc** - CLI-specific settings

### .extensionrc Example

```json
{
  "dev": {
    "port": 9001,
    "host": "localhost",
    "autoReload": true
  },
  "build": {
    "mode": "production",
    "sourceMaps": false,
    "optimization": true
  },
  "test": {
    "coverage": true,
    "threshold": {
      "statements": 80,
      "branches": 70,
      "functions": 80,
      "lines": 80
    }
  }
}
```

## Templates

### Available Templates

- **basic**: Simple extension with frontend only
- **full-stack**: Frontend and backend components
- **sql-panel**: SQL Lab panel extension
- **api-only**: Backend API extension
- **chart-plugin**: Custom chart visualization

### Using Templates

```bash
# Use specific template
superset-extensions init my-chart --template chart-plugin

# List available templates
superset-extensions init --list-templates
```

### Custom Templates

Create custom templates in `~/.superset-extensions/templates/`:

```
~/.superset-extensions/templates/
└── my-template/
    ├── template.json
    └── files/
        └── ... template files ...
```

## Development Workflow

### 1. Create Extension

```bash
superset-extensions init awesome-feature
cd awesome-feature
```

### 2. Install Dependencies

```bash
# Frontend
cd frontend && npm install

# Backend (if applicable)
cd ../backend && pip install -r requirements.txt
```

### 3. Configure Superset

```python
# superset_config.py
ENABLE_EXTENSIONS = True
LOCAL_EXTENSIONS = [
    "/path/to/awesome-feature"
]
```

### 4. Start Development

```bash
# Terminal 1: Extension dev server
superset-extensions dev

# Terminal 2: Superset
superset run -p 8088 --reload
```

### 5. Test Changes

Make changes to your code and see them reflected immediately in Superset.

### 6. Build and Package

```bash
# Validate
superset-extensions validate

# Test
superset-extensions test

# Build
superset-extensions build --mode production

# Bundle
superset-extensions bundle
```

### 7. Deploy

Upload the `.supx` file to your Superset instance.

## Environment Variables

The CLI respects these environment variables:

- `SUPERSET_EXTENSIONS_DEV_PORT`: Development server port
- `SUPERSET_EXTENSIONS_DEV_HOST`: Development server host
- `SUPERSET_BASE_URL`: Superset instance URL
- `NODE_ENV`: Node environment (development/production)
- `PYTHONPATH`: Python module search path

## Troubleshooting

### Common Issues

#### Port Already in Use

```bash
# Use different port
superset-extensions dev --port 9002
```

#### Module Federation Errors

```bash
# Rebuild with clean cache
rm -rf dist/ node_modules/.cache
superset-extensions build
```

#### Python Import Errors

```bash
# Ensure virtual environment is activated
source venv/bin/activate
superset-extensions dev
```

### Debug Mode

Enable verbose output for troubleshooting:

```bash
# Verbose output
superset-extensions dev --verbose

# Debug webpack
DEBUG=webpack:* superset-extensions build
```

## Best Practices

1. **Version Control**: Commit `extension.json` but not `dist/`
2. **Dependencies**: Pin versions in package.json
3. **Testing**: Write tests for critical functionality
4. **Documentation**: Keep README.md updated
5. **Validation**: Run validate before bundling
6. **Semantic Versioning**: Follow semver for releases

## Advanced Usage

### Custom Webpack Configuration

Extend the default webpack config:

```javascript
// webpack.config.js
const baseConfig = require('./webpack.base.config');

module.exports = {
  ...baseConfig,
  // Custom modifications
  resolve: {
    ...baseConfig.resolve,
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
};
```

### CI/CD Integration

```yaml
# .github/workflows/extension.yml
name: Extension CI

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - uses: actions/setup-python@v2

      - name: Install CLI
        run: pip install apache-superset-extensions-cli

      - name: Validate
        run: superset-extensions validate --strict

      - name: Test
        run: superset-extensions test --coverage

      - name: Build
        run: superset-extensions build --mode production

      - name: Bundle
        run: superset-extensions bundle
```

## Getting Help

- **Documentation**: [Developer Portal](../)
- **Examples**: [GitHub Repository](https://github.com/apache/superset/tree/master/extensions)
- **Issues**: [GitHub Issues](https://github.com/apache/superset/issues)
- **Community**: [Slack Channel](https://apache-superset.slack.com)
