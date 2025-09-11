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

# Playwright E2E Tests for Superset

This directory contains Playwright end-to-end tests for Apache Superset, designed as a replacement for the existing Cypress tests during the migration to Playwright.

## Architecture

```
playwright/
├── components/core/     # Reusable UI components
├── pages/              # Page Object Models  
├── tests/              # Test files organized by feature
├── utils/              # Shared constants and utilities
└── README.md           # This file
```

## Design Principles

We follow **YAGNI** (You Aren't Gonna Need It), **DRY** (Don't Repeat Yourself), and **KISS** (Keep It Simple, Stupid) principles:

- Build only what's needed now
- Reuse existing patterns and components
- Keep solutions simple and maintainable

## Component Architecture

### Core Components (`components/core/`)

Reusable UI interaction classes for common elements:

- **Form**: Container with properly scoped child element access
- **Input**: Supports `fill()`, `type()`, and `pressSequentially()` methods
- **Button**: Standard click, hover, focus interactions

**Usage Example:**
```typescript
import { Form } from '../components/core';

const loginForm = new Form(page, '[data-test="login-form"]');
const usernameInput = loginForm.getInput('[data-test="username-input"]');
await usernameInput.fill('admin');
```

### Page Objects (`pages/`)

Each page object encapsulates:
- **Actions**: What you can do on the page
- **Queries**: Information you can get from the page  
- **Selectors**: Centralized in private static SELECTORS constant
- **NO Assertions**: Keep assertions in test files

**Page Object Pattern:**
```typescript
export class AuthPage {
  // Selectors centralized in the page object
  private static readonly SELECTORS = {
    LOGIN_FORM: '[data-test="login-form"]',
    USERNAME_INPUT: '[data-test="username-input"]',
  } as const;

  // Actions - what you can do
  async loginWithCredentials(username: string, password: string) { }

  // Queries - information you can get  
  async getCurrentUrl(): Promise<string> { }

  // NO assertions - those belong in tests
}
```

### Tests (`tests/`)

Organized by feature/area (auth, dashboard, charts, etc.):
- Use page objects for actions
- Keep assertions in test files  
- Import shared constants from `utils/`

**Test Pattern:**
```typescript
import { test, expect } from '@playwright/test';
import { AuthPage } from '../../pages/AuthPage';
import { LOGIN } from '../../utils/urls';

test('should login with correct credentials', async ({ page }) => {
  const authPage = new AuthPage(page);
  await authPage.goto();
  await authPage.loginWithCredentials('admin', 'general');

  // Assertions belong in tests, not page objects
  expect(await authPage.getCurrentUrl()).not.toContain(LOGIN);
});
```

### Utilities (`utils/`)

Shared constants and utilities:
- **urls.ts**: URL paths and request patterns
- Keep flat exports (no premature namespacing)

## Contributing Guidelines

### Adding New Tests

1. **Check existing components** before creating new ones
2. **Use page objects** for page interactions  
3. **Keep assertions in tests**, not page objects
4. **Follow naming conventions**: `feature.spec.ts`

### Adding New Components

1. **Follow YAGNI**: Only build what's immediately needed
2. **Use Locator-based scoping** for proper element isolation
3. **Support both string selectors and Locator objects** via constructor overloads
4. **Add to `components/core/index.ts`** for easy importing

### Adding New Page Objects

1. **Centralize selectors** in private static SELECTORS constant
2. **Import shared constants** from `utils/urls.ts`
3. **Actions and queries only** - no assertions
4. **Use existing components** for DOM interactions

## Running Tests

```bash
# Run all tests
npm run playwright:test
# or: npx playwright test

# Run specific test file
npx playwright test tests/auth/login.spec.ts

# Run with UI mode for debugging
npm run playwright:ui
# or: npx playwright test --ui

# Run in headed mode (see browser)
npm run playwright:headed
# or: npx playwright test --headed

# Debug specific test file
npm run playwright:debug tests/auth/login.spec.ts
# or: npx playwright test --debug tests/auth/login.spec.ts
```

## Test Reports

Playwright generates multiple reports for better visibility:

```bash
# View interactive HTML report (opens automatically on failure)
npm run playwright:report
# or: npx playwright show-report

# View test trace for debugging failures
npx playwright show-trace test-results/[test-name]/trace.zip
```

### Report Types

- **List Reporter**: Shows progress and summary table in terminal
- **HTML Report**: Interactive web interface with screenshots, videos, and traces
- **JSON Report**: Machine-readable format in `test-results/results.json`
- **GitHub Actions**: Annotations in CI for failed tests

### Debugging Failed Tests

When tests fail, Playwright automatically captures:
- **Screenshots** at the point of failure
- **Videos** of the entire test run
- **Traces** with timeline and network activity
- **Error context** with detailed debugging information

All debugging artifacts are available in the HTML report for easy analysis.

## Configuration

- **Config**: `playwright.config.ts` - matches Cypress settings
- **Base URL**: `http://localhost:8088` (assumes Superset running)
- **Browsers**: Chrome only for Phase 1 (YAGNI)
- **Retries**: 2 in CI, 0 locally (matches Cypress)

## Migration from Cypress

When porting Cypress tests:

1. **Port the logic**, not the implementation
2. **Use page objects** instead of inline selectors
3. **Replace `cy.intercept/cy.wait`** with `page.waitForRequest()`
4. **Use shared constants** from `utils/urls.ts`
5. **Follow the established patterns** shown in `tests/auth/login.spec.ts`

## Best Practices

- **Centralize selectors** in page objects
- **Centralize URLs** in `utils/urls.ts`  
- **Use meaningful test descriptions**
- **Keep page objects action-focused**
- **Put assertions in tests, not page objects**
- **Follow the existing patterns** for consistency
