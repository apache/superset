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
title: Developer Portal
sidebar_position: 1
---

# Superset Developer Portal

Welcome to the Apache Superset Developer Portal! This is your comprehensive guide to extending and customizing Superset through our new extension architecture.

## What are Superset Extensions?

Superset Extensions provide a powerful way to enhance and customize Apache Superset without modifying the core codebase. Following the successful model pioneered by VS Code, our extension architecture enables developers to:

- **Add custom features** to SQL Lab and other Superset modules
- **Create reusable components** that can be shared across organizations
- **Integrate external tools** and services seamlessly
- **Customize workflows** to match your team's specific needs

## Why Extensions?

As Superset has grown, we've recognized the need for a more modular architecture that allows:

- **Innovation without fragmentation** - Build features without forking the codebase
- **Community-driven development** - Share and reuse extensions across organizations
- **Stable APIs** - Develop against versioned, well-documented interfaces
- **Rapid iteration** - Deploy custom features without waiting for core releases

## Key Features

### 🎯 Well-Defined Extension Points

Extensions can contribute to specific areas of Superset:
- SQL Lab panels (left, right, bottom, editor)
- Custom commands and menu items
- Status bar components
- API endpoints and backend functionality

### 🔧 Modern Development Experience

- **CLI tools** for scaffolding, building, and packaging
- **Hot reloading** during development
- **TypeScript support** with full type safety
- **Module Federation** for dynamic loading

### 📦 Simple Distribution

- Package extensions as `.supx` files
- Upload via REST API or UI
- Automatic activation and lifecycle management
- Version compatibility checking

## Getting Started

Ready to build your first extension? Check out our [Getting Started Guide](./getting-started) to:

1. Set up your development environment
2. Create your first extension
3. Test it locally
4. Package and deploy it

## Architecture Overview

Our extension architecture is built on several key principles:

- **Lean Core**: Keep Superset's core minimal and delegate features to extensions
- **Explicit APIs**: Clear, versioned interfaces for extension interactions
- **Lazy Loading**: Extensions load only when needed for optimal performance
- **Security First**: Extensions run with appropriate permissions and sandboxing

Learn more in our [Architecture Documentation](./architecture/overview).

## Current Status

The extension architecture is currently in active development. The initial focus is on SQL Lab extensions, with plans to expand to:

- Dashboard extensions
- Chart plugins (enhanced from current system)
- Database connectors
- Security providers

## Example: Dataset References Extension

See the extension system in action with our Dataset References example, which adds a SQL Lab panel showing:

- Tables referenced in queries
- Table owners for permission requests  
- Last available partitions
- Estimated row counts

## Join the Community

- **Contribute**: Help shape the future of Superset extensions
- **Share**: Publish your extensions for others to use
- **Learn**: Explore extensions built by the community

## Quick Links

- [Getting Started Guide](./getting-started)
- [Extension Architecture](./architecture/overview)
- [API Reference](./api/frontend)
- [CLI Documentation](./cli/overview)
- [Examples](./examples)

---

*The Superset extension architecture is inspired by the successful model of VS Code Extensions, bringing similar flexibility and power to the data exploration domain.*
