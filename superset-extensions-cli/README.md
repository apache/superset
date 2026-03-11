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
- **Validation** - Validate extension structure and configuration before building
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
# Scaffold a new extension project (interactive prompts, or pass options directly)
superset-extensions init [--publisher <publisher>] [--name <name>] [--display-name <name>]
                         [--version <version>] [--license <license>]
                         [--frontend/--no-frontend] [--backend/--no-backend]

# Validate extension structure and configuration
superset-extensions validate

# Build extension assets for production (runs validate first)
superset-extensions build

# Package extension into a distributable .supx file (runs build first)
superset-extensions bundle [--output/-o <path>]

# Automatically rebuild extension as files change during development
superset-extensions dev
```

## 📋 Extension Structure

The CLI scaffolds extensions with the following structure:

```
{publisher}.{name}/             # e.g., my-org.dashboard-widgets/
├── extension.json              # Extension configuration and metadata
├── .gitignore
├── frontend/                   # Optional frontend code
│   ├── src/
│   │   └── index.tsx           # Frontend entry point
│   ├── package.json
│   ├── webpack.config.js
│   └── tsconfig.json
└── backend/                    # Optional backend code
    ├── src/
    │   └── {publisher}/        # e.g., my_org/
    │       └── {name}/         # e.g., dashboard_widgets/
    │           └── entrypoint.py
    └── pyproject.toml
```

## 📄 License

Licensed under the Apache License, Version 2.0. See [LICENSE](https://github.com/apache/superset/blob/master/LICENSE.txt) for details.

## 🔗 Links

- [Community](https://superset.apache.org/community/)
- [GitHub Repository](https://github.com/apache/superset)
- [Extensions Documentation](https://superset.apache.org/developer-docs/extensions/overview)
