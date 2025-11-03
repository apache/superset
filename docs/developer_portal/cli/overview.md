---
title: Extension CLI
sidebar_position: 1
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

# Superset Extension CLI

The `apache-superset-extensions-cli` package provides command-line tools for creating, developing, and packaging Apache Superset extensions. It streamlines the entire extension development workflow from initialization to deployment.

## Installation

Install the CLI globally using pip:

```bash
pip install apache-superset-extensions-cli
```

Or install locally in your project:

```bash
pip install --user apache-superset-extensions-cli
```

Verify installation:

```bash
superset-extensions --version
# Output: apache-superset-extensions-cli version 1.0.0
```

## Commands Overview

| Command | Description |
|---------|-------------|
| `init` | Create a new extension project |
| `dev` | Start development mode with hot reload |
| `build` | Build extension assets for production |
| `bundle` | Package extension into a .supx file |
| `validate` | Validate extension metadata and structure |
| `publish` | Publish extension to registry (future) |

## Command Reference

### init

Creates a new extension project with the standard structure and boilerplate code.

```bash
superset-extensions init [options] <extension-name>
```

#### Options

- `--type, -t <type>` - Extension type: `full` (default), `frontend-only`, `backend-only`
- `--template <template>` - Project template: `default`, `sql-lab`, `dashboard`, `chart`
- `--author <name>` - Extension author name
- `--description <desc>` - Extension description
- `--license <license>` - License identifier (default: Apache-2.0)
- `--superset-version <version>` - Minimum Superset version (default: 4.0.0)
- `--skip-install` - Skip installing dependencies
- `--use-typescript` - Use TypeScript for frontend (default: true)
- `--use-npm` - Use npm instead of yarn

#### Examples

```bash
# Create a basic extension
superset-extensions init my-extension

# Create a SQL Lab focused extension
superset-extensions init query-optimizer --template sql-lab

# Create frontend-only extension
superset-extensions init custom-viz --type frontend-only

# Create with metadata
superset-extensions init data-quality \
  --author "Jane Doe" \
  --description "Data quality monitoring for SQL Lab"
```

#### Generated Structure

```
my-extension/
├── extension.json          # Extension metadata
├── frontend/              # Frontend source code
│   ├── src/
│   │   ├── index.tsx     # Main entry point
│   │   └── components/   # React components
│   ├── package.json
│   ├── tsconfig.json
│   └── webpack.config.js
├── backend/               # Backend source code
│   ├── src/
│   │   └── my_extension/
│   │       ├── __init__.py
│   │       └── api.py
│   ├── tests/
│   └── requirements.txt
├── README.md
└── .gitignore
```

### dev

Starts development mode with automatic rebuilding and hot reload.

```bash
superset-extensions dev [options]
```

#### Options

- `--port, -p <port>` - Development server port (default: 9001)
- `--host <host>` - Development server host (default: localhost)
- `--watch-backend` - Also watch backend files (default: true)
- `--watch-frontend` - Also watch frontend files (default: true)
- `--no-open` - Don't open browser automatically
- `--superset-url <url>` - Superset instance URL (default: http://localhost:8088)
- `--verbose` - Enable verbose logging

#### Examples

```bash
# Start development mode
superset-extensions dev

# Use custom port
superset-extensions dev --port 9002

# Connect to remote Superset
superset-extensions dev --superset-url https://superset.example.com
```

#### Development Workflow

1. **Start the dev server:**
```bash
superset-extensions dev
```

2. **Configure Superset** (`superset_config.py`):
```python
LOCAL_EXTENSIONS = [
    "/path/to/your/extension"
]
ENABLE_EXTENSIONS = True
```

3. **Start Superset:**
```bash
superset run -p 8088 --with-threads --reload
```

The extension will automatically reload when you make changes.

### build

Builds extension assets for production deployment.

```bash
superset-extensions build [options]
```

#### Options

- `--mode <mode>` - Build mode: `production` (default), `development`
- `--analyze` - Generate bundle analysis report
- `--source-maps` - Generate source maps
- `--minify` - Minify output (default: true in production)
- `--output, -o <dir>` - Output directory (default: dist)
- `--clean` - Clean output directory before build
- `--parallel` - Build frontend and backend in parallel

#### Examples

```bash
# Production build
superset-extensions build

# Development build with source maps
superset-extensions build --mode development --source-maps

# Analyze bundle size
superset-extensions build --analyze

# Custom output directory
superset-extensions build --output build
```

#### Build Output

```
dist/
├── manifest.json          # Build manifest
├── frontend/
│   ├── remoteEntry.[hash].js
│   ├── [name].[hash].js
│   └── assets/
└── backend/
    └── my_extension/
        ├── __init__.py
        └── *.py
```

### bundle

Packages the built extension into a distributable `.supx` file.

```bash
superset-extensions bundle [options]
```

#### Options

- `--output, -o <file>` - Output filename (default: `{name}-{version}.supx`)
- `--sign` - Sign the bundle (requires configured keys)
- `--compression <level>` - Compression level 0-9 (default: 6)
- `--exclude <patterns>` - Files to exclude (comma-separated)
- `--include-dev-deps` - Include development dependencies

#### Examples

```bash
# Create bundle
superset-extensions bundle

# Custom output name
superset-extensions bundle --output my-extension-latest.supx

# Signed bundle
superset-extensions bundle --sign

# Exclude test files
superset-extensions bundle --exclude "**/*.test.js,**/*.spec.ts"
```

#### Bundle Structure

The `.supx` file is a ZIP archive containing:

```
my-extension-1.0.0.supx
├── manifest.json
├── extension.json
├── frontend/
│   └── dist/
└── backend/
    └── src/
```

### validate

Validates extension structure, metadata, and compatibility.

```bash
superset-extensions validate [options]
```

#### Options

- `--strict` - Enable strict validation
- `--fix` - Auto-fix correctable issues
- `--check-deps` - Validate dependencies
- `--check-security` - Run security checks

#### Examples

```bash
# Basic validation
superset-extensions validate

# Strict mode with auto-fix
superset-extensions validate --strict --fix

# Full validation
superset-extensions validate --check-deps --check-security
```

#### Validation Checks

- Extension metadata completeness
- File structure conformity
- API version compatibility
- Dependency security vulnerabilities
- Code quality standards
- Bundle size limits

## Configuration File

Create `.superset-extension.json` for project-specific settings:

```json
{
  "build": {
    "mode": "production",
    "sourceMaps": true,
    "analyze": false,
    "parallel": true
  },
  "dev": {
    "port": 9001,
    "host": "localhost",
    "autoOpen": true
  },
  "bundle": {
    "compression": 6,
    "sign": false,
    "exclude": [
      "**/*.test.*",
      "**/*.spec.*",
      "**/tests/**"
    ]
  },
  "validation": {
    "strict": true,
    "autoFix": true
  }
}
```

## Environment Variables

Configure CLI behavior using environment variables:

```bash
# Superset connection
export SUPERSET_URL=http://localhost:8088
export SUPERSET_USERNAME=admin
export SUPERSET_PASSWORD=admin

# Development settings
export EXTENSION_DEV_PORT=9001
export EXTENSION_DEV_HOST=localhost

# Build settings
export EXTENSION_BUILD_MODE=production
export EXTENSION_SOURCE_MAPS=true

# Registry settings (future)
export EXTENSION_REGISTRY_URL=https://registry.superset.apache.org
export EXTENSION_REGISTRY_TOKEN=your-token
```

## Advanced Usage

### Custom Templates

Create custom project templates:

```bash
# Use custom template
superset-extensions init my-ext --template https://github.com/user/template

# Use local template
superset-extensions init my-ext --template ./my-template
```

### CI/CD Integration

#### GitHub Actions

```yaml
name: Build Extension

on: [push, pull_request]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2

      - name: Setup Python
        uses: actions/setup-python@v2
        with:
          python-version: '3.9'

      - name: Setup Node
        uses: actions/setup-node@v2
        with:
          node-version: '16'

      - name: Install CLI
        run: pip install apache-superset-extensions-cli

      - name: Install dependencies
        run: |
          npm install --prefix frontend
          pip install -r backend/requirements.txt

      - name: Validate
        run: superset-extensions validate --strict

      - name: Build
        run: superset-extensions build --mode production

      - name: Bundle
        run: superset-extensions bundle

      - name: Upload artifact
        uses: actions/upload-artifact@v2
        with:
          name: extension-bundle
          path: '*.supx'
```

### Automated Deployment

Deploy extensions automatically:

```bash
#!/bin/bash
# deploy.sh

# Build and bundle
superset-extensions build --mode production
superset-extensions bundle --sign

# Upload to Superset instance
BUNDLE=$(ls *.supx | head -1)
curl -X POST "$SUPERSET_URL/api/v1/extensions/import/" \
  -H "Authorization: Bearer $SUPERSET_TOKEN" \
  -F "bundle=@$BUNDLE"

# Verify deployment
curl "$SUPERSET_URL/api/v1/extensions/" \
  -H "Authorization: Bearer $SUPERSET_TOKEN"
```

### Multi-Extension Projects

Manage multiple extensions in one repository:

```bash
# Initialize multiple extensions
superset-extensions init extensions/viz-plugin --type frontend-only
superset-extensions init extensions/sql-optimizer --template sql-lab
superset-extensions init extensions/auth-provider --type backend-only

# Build all extensions
for dir in extensions/*/; do
  (cd "$dir" && superset-extensions build)
done

# Bundle all extensions
for dir in extensions/*/; do
  (cd "$dir" && superset-extensions bundle)
done
```

## Troubleshooting

### Common Issues

#### Port already in use

```bash
# Error: Port 9001 is already in use

# Solution: Use a different port
superset-extensions dev --port 9002
```

#### Module not found

```bash
# Error: Cannot find module '@apache-superset/core'

# Solution: Ensure dependencies are installed
npm install --prefix frontend
```

#### Build failures

```bash
# Check Node and Python versions
node --version  # Should be 16+
python --version  # Should be 3.9+

# Clear cache and rebuild
rm -rf dist node_modules frontend/node_modules
npm install --prefix frontend
superset-extensions build --clean
```

#### Bundle too large

```bash
# Warning: Bundle size exceeds recommended limit

# Solution: Analyze and optimize
superset-extensions build --analyze

# Exclude unnecessary files
superset-extensions bundle --exclude "**/*.map,**/*.test.*"
```

### Debug Mode

Enable debug logging:

```bash
# Set debug environment variable
export DEBUG=superset-extensions:*

# Or use verbose flag
superset-extensions dev --verbose
superset-extensions build --verbose
```

### Getting Help

```bash
# General help
superset-extensions --help

# Command-specific help
superset-extensions init --help
superset-extensions dev --help

# Version information
superset-extensions --version
```

## Best Practices

### Development

1. **Use TypeScript** for type safety
2. **Follow the style guide** for consistency
3. **Write tests** for critical functionality
4. **Document your code** with JSDoc/docstrings
5. **Use development mode** for rapid iteration

### Building

1. **Optimize bundle size** - analyze and tree-shake
2. **Generate source maps** for debugging
3. **Validate before building** to catch issues early
4. **Use production mode** for final builds
5. **Clean build directory** to avoid stale files

### Deployment

1. **Sign your bundles** for security
2. **Version properly** using semantic versioning
3. **Test in staging** before production deployment
4. **Document breaking changes** in CHANGELOG
5. **Provide migration guides** for major updates

## Resources

- [Extension Architecture](/developer_portal/architecture/overview)
- [API Reference](/developer_portal/api/frontend)
- [Frontend Contribution Types](/developer_portal/extensions/frontend-contribution-types)
- [GitHub Repository](https://github.com/apache/superset)
- [Community Forum](https://github.com/apache/superset/discussions)
