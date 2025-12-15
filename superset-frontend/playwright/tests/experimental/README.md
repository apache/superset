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

## Purpose

This directory contains **experimental** Playwright E2E tests that are being developed and stabilized before becoming part of the required test suite.

## How Experimental Tests Work

### Running Tests

**By default (CI and local), experimental tests are EXCLUDED:**
```bash
npm run playwright:test
# Only runs stable tests (tests/auth/*)
```

**To include experimental tests, set the environment variable:**
```bash
INCLUDE_EXPERIMENTAL=true npm run playwright:test
# Runs all tests including experimental/
```

### CI Behavior

- **Required CI jobs**: Experimental tests are excluded by default
  - Tests in `experimental/` do NOT block merges
  - Failures in `experimental/` do NOT fail the build

- **Experimental CI jobs** (optional): Use `TEST_PATH=experimental/`
  - Set `INCLUDE_EXPERIMENTAL=true` in the job environment to include experimental tests
  - These jobs can use `continue-on-error: true` for shadow mode

### Configuration

The experimental pattern is configured in `playwright.config.ts`:

```typescript
testIgnore: process.env.INCLUDE_EXPERIMENTAL
  ? undefined
  : '**/experimental/**',
```

This ensures:
- Without `INCLUDE_EXPERIMENTAL`: Tests in `experimental/` are ignored
- With `INCLUDE_EXPERIMENTAL=true`: All tests run, including experimental

## When to Use Experimental

Add tests to `experimental/` when:

1. **Testing new infrastructure** - New page objects, components, or patterns that need real-world validation
2. **Flaky tests** - Tests that pass locally but have intermittent CI failures that need investigation
3. **New test types** - E2E tests for new features that need to prove stability before becoming required
4. **Prototyping** - Experimental approaches that may or may not become standard patterns

## Moving Tests to Stable

Once an experimental test has proven stable (consistent CI passes over time):

1. **Move the test file** from `experimental/` to the appropriate stable directory:
   ```bash
   git mv tests/experimental/dataset/my-test.spec.ts tests/dataset/my-test.spec.ts
   ```

2. **Commit the move** with a clear message:
   ```bash
   git commit -m "test(playwright): promote my-test from experimental to stable"
   ```

3. **Test will now be required** - It will run by default and block merges on failure

## Current Experimental Tests

### Dataset Tests

- **`dataset/dataset-list.spec.ts`** - Dataset list E2E tests
  - Status: Infrastructure complete, validating stability
  - Includes: Delete dataset test with API-based test data
  - Supporting infrastructure: API helpers, Modal components, page objects

## Infrastructure Location

**Important**: Supporting infrastructure (components, page objects, API helpers) should live in **stable locations**, NOT under `experimental/`:

✅ **Correct locations:**
- `playwright/components/` - Components used by any tests
- `playwright/pages/` - Page objects for any features
- `playwright/helpers/api/` - API helpers for test data setup

❌ **Avoid:**
- `playwright/tests/experimental/components/` - Makes it hard to share infrastructure

This keeps infrastructure reusable and avoids duplication when tests graduate from experimental to stable.

## Questions?

See [Superset Testing Documentation](https://superset.apache.org/docs/contributing/development#testing) or ask in the `#testing` Slack channel.
