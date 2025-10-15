---
title: End-to-End Testing
sidebar_position: 4
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

# End-to-End Testing

🚧 **Coming Soon** 🚧

Guide for writing and running end-to-end tests using Playwright and Cypress.

## Topics to be covered:

### Playwright (Recommended)
- Setting up Playwright environment
- Writing reliable E2E tests
- Page Object Model pattern
- Handling async operations
- Cross-browser testing
- Visual regression testing
- Debugging with Playwright Inspector
- CI/CD integration

### Cypress (Deprecated)
- Legacy Cypress test maintenance
- Migration to Playwright
- Running existing Cypress tests

## Quick Commands

### Playwright
```bash
# Run all Playwright tests
npm run playwright:test

# Run in headed mode (see browser)
npm run playwright:headed

# Run specific test file
npx playwright test tests/auth/login.spec.ts

# Debug specific test
npm run playwright:debug tests/auth/login.spec.ts

# Open Playwright UI
npm run playwright:ui
```

### Cypress (Deprecated)
```bash
# Run Cypress tests
cd superset-frontend/cypress-base
npm run cypress-run-chrome

# Open Cypress UI
npm run cypress-debug
```

---

*This documentation is under active development. Check back soon for updates!*
