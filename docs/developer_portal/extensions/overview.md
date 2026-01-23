---
title: Overview
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

# Overview

Apache Superset's extension system enables organizations to build custom features without modifying the core codebase. Inspired by the [VS Code extension model](https://code.visualstudio.com/api), this architecture addresses a long-standing challenge: teams previously had to fork Superset or make invasive modifications to add capabilities like query optimizers, custom panels, or specialized integrations—resulting in maintenance overhead and codebase fragmentation.

The extension system introduces a modular, plugin-based architecture where both built-in features and external extensions use the same well-defined APIs. This "lean core" approach ensures that any capability available to Superset's internal features is equally accessible to community-developed extensions, fostering a vibrant ecosystem while reducing the maintenance burden on core contributors.

## What are Superset Extensions?

Superset extensions are self-contained `.supx` packages that extend the platform's capabilities through standardized contribution points. Each extension can include both frontend (React/TypeScript) and backend (Python) components, bundled together and loaded dynamically at runtime using Webpack Module Federation.

## Extension Capabilities

Extensions can provide:

- **Custom UI Components**: New panels, views, and interactive elements
- **Commands and Menus**: Custom actions accessible via menus and keyboard shortcuts
- **REST API Endpoints**: Backend services under the `/api/v1/extensions/` namespace
- **MCP Tools and Prompts**: AI agent capabilities for enhanced user assistance

## Next Steps

- **[Quick Start](./quick-start)** - Build your first extension with a complete walkthrough
- **[Architecture](./architecture)** - Design principles and system overview
- **[Dependencies](./dependencies)** - Managing dependencies and understanding API stability
- **[Contribution Types](./contribution-types)** - Available extension points
- **[Development](./development)** - Project structure, APIs, and development workflow
- **[Deployment](./deployment)** - Packaging and deploying extensions
- **[MCP Integration](./mcp)** - Adding AI agent capabilities using extensions
- **[Security](./security)** - Security considerations and best practices
- **[Tasks](./tasks)** - Framework for creating and managing long running tasks
- **[Community Extensions](./registry)** - Browse extensions shared by the community
