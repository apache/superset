---
title: Backend Testing
sidebar_position: 3
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

# Backend Testing

🚧 **Coming Soon** 🚧

Complete guide for testing Superset's Python backend, APIs, and database interactions.

## Topics to be covered:

- Pytest configuration and fixtures
- Unit testing best practices
- Integration testing with databases
- API endpoint testing
- Mocking strategies and patterns
- Testing async operations with Celery
- Security testing guidelines
- Performance and load testing
- Test database setup and teardown
- Coverage requirements

## Quick Commands

```bash
# Run all backend tests
pytest

# Run specific test file
pytest tests/unit_tests/specific_test.py

# Run with coverage
pytest --cov=superset

# Run tests in parallel
pytest -n auto

# Run only unit tests
pytest tests/unit_tests/

# Run only integration tests
pytest tests/integration_tests/
```

---

*This documentation is under active development. Check back soon for updates!*
