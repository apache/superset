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

# apache-superset-extensions-cli

[![PyPI version](https://badge.fury.io/py/apache-superset-extensions-cli.svg)](https://badge.fury.io/py/apache-superset-extensions-cli)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Python 3.10+](https://img.shields.io/badge/python-3.10+-blue.svg)](https://www.python.org/downloads/)

Official command-line interface for building, bundling, and managing Apache Superset extensions. This CLI tool provides developers with everything needed to create, develop, and package extensions for the Superset ecosystem.

## 🚀 Features

- **Extension Scaffolding** - Generate initial folder structure and scaffold new extension projects
- **Development Server** - Automatically rebuild extensions as files change during development
- **Build System** - Build extension assets for production deployment
- **Bundle Packaging** - Package extensions into distributable .supx files

## 📦 Installation

```bash
pip install apache-superset-extensions-cli
```

## 🛠️ Quick Start

### Available Commands

```bash
# Generate initial folder structure and scaffold a new extension project
superset-extensions init <extension-name>

# Automatically rebuild extension as files change during development
superset-extensions dev

# Build extension assets for production
superset-extensions build

# Package extension into a distributable .supx file
superset-extensions bundle
```

## 📋 Extension Structure

The CLI generates extensions with the following structure:

```
extension_name/
├── extension.json              # Extension configuration and metadata
├── frontend/                   # Frontend code
│   ├── src/                   # TypeScript/React source files
│   ├── webpack.config.js      # Frontend build configuration
│   ├── tsconfig.json          # TypeScript configuration
│   └── package.json           # Frontend dependencies
├── backend/                   # Backend code
│   ├── src/
│   │   └── dataset_references/ # Python package source
│   ├── tests/                 # Backend tests
│   ├── pyproject.toml         # Python package configuration
│   └── requirements.txt       # Python dependencies
├── dist/                      # Built extension files (generated)
│   ├── manifest.json          # Generated extension manifest
│   ├── frontend/
│   │   └── dist/              # Built frontend assets
│   │       ├── remoteEntry.*.js  # Module federation entry
│   │       └── *.js           # Additional frontend bundles
│   └── backend/
│       └── dataset_references/ # Built backend package
│           ├── __init__.py
│           ├── api.py
│           └── entrypoint.py
├── dataset_references-1.0.0.supx  # Packaged extension file (generated)
└── README.md                  # Extension documentation
```

## 🤝 Contributing

We welcome contributions! Please see the [Contributing Guide](https://github.com/apache/superset/blob/master/CONTRIBUTING.md) for details.

## 📄 License

Licensed under the Apache License, Version 2.0. See [LICENSE](https://github.com/apache/superset/blob/master/LICENSE.txt) for details.

## 🔗 Links

- [Apache Superset](https://superset.apache.org/)
- [Extension Development Guide](https://superset.apache.org/docs/extensions/)
- [API Documentation](https://superset.apache.org/docs/api/)
- [GitHub Repository](https://github.com/apache/superset)
- [Community](https://superset.apache.org/community/)

---

**Note**: This package is currently in early development. APIs and commands may change before the 1.0.0 release. Please check the [changelog](CHANGELOG.md) for breaking changes between versions.
