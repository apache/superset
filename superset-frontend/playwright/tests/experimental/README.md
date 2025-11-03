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

# Experimental Playwright Tests

This directory contains Playwright tests that are still under development or validation.

## Purpose

Tests in this directory run in "shadow mode" with `continue-on-error: true` in CI:
- Failures do NOT block PR merges
- Allows tests to run in CI to validate stability before promotion
- Provides visibility into test reliability over time

## Promoting Tests to Stable

Once a test has proven stable (no false positives/negatives over sufficient time):

1. Move the test file out of `experimental/` to the appropriate feature directory:
   ```bash
   # From the repository root:
   git mv superset-frontend/playwright/tests/experimental/dashboard/test.spec.ts \
          superset-frontend/playwright/tests/dashboard/

   # Or from the superset-frontend/ directory:
   git mv playwright/tests/experimental/dashboard/test.spec.ts \
          playwright/tests/dashboard/
   ```

2. The test will automatically become required for merge

## Test Organization

Organize tests by feature area:
- `auth/` - Authentication and authorization tests
- `dashboard/` - Dashboard functionality tests
- `explore/` - Chart builder tests
- `sqllab/` - SQL Lab tests
- etc.

## Running Tests

```bash
# Run all experimental tests (requires INCLUDE_EXPERIMENTAL env var)
INCLUDE_EXPERIMENTAL=true npm run playwright:test -- experimental/

# Run specific experimental test
INCLUDE_EXPERIMENTAL=true npm run playwright:test -- experimental/dashboard/test.spec.ts

# Run in UI mode for debugging
INCLUDE_EXPERIMENTAL=true npm run playwright:ui -- experimental/
```

**Note**: The `INCLUDE_EXPERIMENTAL=true` environment variable is required because experimental tests are filtered out by default in `playwright.config.ts`. Without it, Playwright will report "No tests found".
