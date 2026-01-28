---
title: CI/CD and Automation
sidebar_position: 5
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

# CI/CD and Automation

🚧 **Coming Soon** 🚧

Understanding Superset's continuous integration and deployment pipelines.

## Topics to be covered:

- GitHub Actions workflows
- Pre-commit hooks configuration
- Automated testing pipelines
- Code quality checks (ESLint, Prettier, Black, MyPy)
- Security scanning (Dependabot, CodeQL)
- Docker image building and publishing
- Release automation
- Performance benchmarking
- Coverage reporting and tracking

## Pre-commit Hooks

```bash
# Install pre-commit hooks
pre-commit install

# Run all hooks on staged files
pre-commit run

# Run specific hook
pre-commit run mypy

# Run on all files (not just staged)
pre-commit run --all-files
```

## GitHub Actions

Key workflows:
- `test-frontend.yml` - Frontend tests
- `test-backend.yml` - Backend tests
- `docker.yml` - Docker image builds
- `codeql.yml` - Security analysis
- `release.yml` - Release automation

---

*This documentation is under active development. Check back soon for updates!*
