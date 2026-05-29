# LLM Context Guide for Apache Superset

Apache Superset is a data visualization platform with Flask/Python backend and React/TypeScript frontend.

## ⚠️ CRITICAL: Always Run Pre-commit Before Pushing

**ALWAYS run `pre-commit run --all-files` before pushing commits.** CI will fail if pre-commit checks don't pass. This is non-negotiable.

```bash
# Stage your changes first
git add .

# Run pre-commit on all files
pre-commit run --all-files

# If there are auto-fixes, stage them and commit
git add .
git commit --amend  # or new commit
```

Common pre-commit failures:
- **Formatting** - black, prettier, eslint will auto-fix
- **Type errors** - mypy failures need manual fixes
- **Linting** - ruff, pylint issues need manual fixes

## ⚠️ CRITICAL: Ongoing Refactors (What NOT to Do)

**These migrations are actively happening - avoid deprecated patterns:**

### Frontend Modernization
- **NO `any` types** - Use proper TypeScript types
- **NO JavaScript files** - Convert to TypeScript (.ts/.tsx)
- **Use @superset-ui/core** - Don't import Ant Design directly, prefer Ant Design component wrappers from @superset-ui/core/components
- **Use antd theming tokens** - Prefer antd tokens over legacy theming tokens
- **Avoid custom css and styles** - Follow antd best practices and avoid styling and custom CSS whenever possible

### Testing Strategy Migration
- **Prefer unit tests** over integration tests
- **Prefer integration tests** over end-to-end tests
- **Use Playwright for E2E tests** - Migrating from Cypress
- **Cypress is deprecated** - Will be removed once migration is completed
- **Use Jest + React Testing Library** for component testing
- **Use `test()` instead of `describe()`** - Follow [avoid nesting when testing](https://kentcdodds.com/blog/avoid-nesting-when-youre-testing) principles

### Backend Type Safety
- **Add type hints** - All new Python code needs proper typing
- **MyPy compliance** - Run `pre-commit run mypy` to validate
- **SQLAlchemy typing** - Use proper model annotations

### UUID Migration
- **Prefer UUIDs over auto-incrementing IDs** - New models should use UUID primary keys
- **External API exposure** - Use UUIDs in public APIs instead of internal integer IDs
- **Existing models** - Add UUID fields alongside integer IDs for gradual migration

## Security and Threat Model

Before evaluating any code path for security issues, read [`SECURITY.md`](SECURITY.md). It is the canonical, authoritative source for Apache Superset's security model and is referenced by both human reporters and automated scanners.

In short, the test for whether a finding is in scope is one question:

> *Does it let a principal perform an action the role and capability matrix in `SECURITY.md` does not entitle them to?*

If yes, it is in scope. If no, it is not.

The three trust boundaries are:

1. **The Admin role** is a fully trusted operational principal. Anything an Admin can do through documented configuration, API, or UI is an intended capability, not a vulnerability.
2. **The operator** owns deployment-time decisions (secrets, network exposure, feature-flag selection, connector and codec choices, notification destinations, third-party plugins). Misconfiguration at this layer is a deployment defect, not a Superset vulnerability.
3. **The codebase** is responsible for enforcing the role and capability matrix wherever it exposes functionality to a principal: API routes, command and DAO layers, UI handlers, background jobs, and any other entry point. A missing or incorrect enforcement check is in scope no matter where it lives.

The security model assumes that operator-controlled infrastructure, including the metadata database, cache backends, message brokers, secret stores, and deployment environment, remains within the operator's trust boundary. Vulnerabilities must demonstrate a security boundary violation by an attacker who does not already control those systems.

Route-level authorization in this codebase uses one of three Flask-AppBuilder decorators depending on the route type:

- `@protect()` for REST API routes (`ModelRestApi` / `BaseApi`)
- `@has_access_api` for legacy view routes
- `@has_access` for legacy HTML view routes

Object-level authorization via `security_manager.raise_for_access(...)` applies to data-bearing resources: dashboards, charts, datasets and datasources, queries, database and table access, and query contexts. Other resources (annotations, tags, CSS templates, reports, RLS rules, and similar) rely on the route-level decorator plus DAO `base_filters` for ownership scoping; the absence of `raise_for_access` on these resources is by design, not a finding. Code that omits the per-object gate on a route that returns or mutates a specific data-bearing object is in scope; code that follows the correct pattern for its resource class can still contain injection, SSRF, XSS, or other classes of finding unrelated to authorization, which are evaluated separately.

The full role and capability matrix, in-scope and out-of-scope class lists, and CVE aggregation rules are in [`SECURITY.md`](SECURITY.md). Defer to that document for any specifics.

**Requirements for findings filed by automated tooling**

Automated scanners (LLM-based code scanners, static analyzers, dependency tools) that file findings against this codebase must, in each finding, name:

1. The specific role and capability matrix row in [`SECURITY.md`](SECURITY.md) the finding believes is violated.
2. The principal the finding assumes the attacker holds (Public, Gamma, sql_lab, Alpha, Admin, Embedded guest token, or a custom role with explicit capability grants).

Findings that cannot identify both should be filed as questions, not vulnerabilities. This requirement exists to ensure every reported issue is testable against the published security model and to keep speculative or pattern-match-only reports out of the triage queue.

## Key Directories

```
superset/
├── superset/                    # Python backend (Flask, SQLAlchemy)
│   ├── views/api/              # REST API endpoints
│   ├── models/                 # Database models
│   └── connectors/             # Database connections
├── superset-frontend/src/       # React TypeScript frontend
│   ├── components/             # Reusable components
│   ├── explore/                # Chart builder
│   ├── dashboard/              # Dashboard interface
│   └── SqlLab/                 # SQL editor
├── superset-frontend/packages/
│   └── superset-ui-core/       # UI component library (USE THIS)
├── tests/                      # Python/integration tests
├── docs/                       # Documentation (UPDATE FOR CHANGES)
└── UPDATING.md                 # Breaking changes log
```

## Code Standards

### TypeScript Frontend
- **Avoid `any` types** - Use proper TypeScript, reuse existing types
- **Functional components** with hooks
- **@superset-ui/core** for UI components (not direct antd)
- **Jest** for testing (NO Enzyme)
- **Redux** for global state where it exists, hooks for local

### Python Backend  
- **Type hints required** for all new code
- **MyPy compliant** - run `pre-commit run mypy`
- **SQLAlchemy models** with proper typing
- **pytest** for testing

### Apache License Headers
- **New files require ASF license headers** - When creating new code files, include the standard Apache Software Foundation license header
- **LLM instruction files are excluded** - Files like AGENTS.md, CLAUDE.md, etc. are in `.rat-excludes` to avoid header token overhead

### Code Comments
- **Avoid time-specific language** - Don't use words like "now", "currently", "today" in code comments as they become outdated
- **Write timeless comments** - Comments should remain accurate regardless of when they're read

## Documentation Requirements

- **docs/**: Update for any user-facing changes
- **UPDATING.md**: Add breaking changes here
- **Docstrings**: Required for new functions/classes

## Developer Portal: Storybook-to-MDX Documentation

The Developer Portal auto-generates MDX documentation from Storybook stories. **Stories are the single source of truth.**

### Core Philosophy
- **Fix issues in the STORY, not the generator** - When something doesn't render correctly, update the story file first
- **Generator should be lightweight** - It extracts and passes through data; avoid special cases
- **Stories define everything** - Props, controls, galleries, examples all come from story metadata

### Story Requirements for Docs Generation
- Use `export default { title: '...' }` (inline), not `const meta = ...; export default meta;`
- Name interactive stories `Interactive${ComponentName}` (e.g., `InteractiveButton`)
- Define `args` for default prop values
- Define `argTypes` at the story level (not meta level) with control types and descriptions
- Use `parameters.docs.gallery` for size×style variant grids
- Use `parameters.docs.sampleChildren` for components that need children
- Use `parameters.docs.liveExample` for custom live code blocks
- Use `parameters.docs.staticProps` for complex object props that can't be parsed inline

### Generator Location
- Script: `docs/scripts/generate-superset-components.mjs`
- Wrapper: `docs/src/components/StorybookWrapper.jsx`
- Output: `docs/developer_portal/components/`

## Architecture Patterns

### Security & Features
- **Security model**: see the top-level [Security and Threat Model](#security-and-threat-model) section and [`SECURITY.md`](SECURITY.md)
- **RBAC**: Role-based access via Flask-AppBuilder
- **Feature flags**: Control feature rollouts
- **Row-level security**: SQL-based data access control

## Test Utilities

### Python Test Helpers
- **`SupersetTestCase`** - Base class in `tests/integration_tests/base_tests.py`
- **`@with_config`** - Config mocking decorator
- **`@with_feature_flags`** - Feature flag testing
- **`login_as()`, `login_as_admin()`** - Authentication helpers
- **`create_dashboard()`, `create_slice()`** - Data setup utilities

### TypeScript Test Helpers
- **`superset-frontend/spec/helpers/testing-library.tsx`** - Custom render() with providers
- **`createWrapper()`** - Redux/Router/Theme wrapper
- **`selectOption()`** - Select component helper
- **React Testing Library** - NO Enzyme (removed)

### Test Database Patterns
- **Mock patterns**: Use `MagicMock()` for config objects, avoid `AsyncMock` for synchronous code
- **API tests**: Update expected columns when adding new model fields

### Running Tests
```bash
# Frontend
npm run test                           # All tests
npm run test -- filename.test.tsx     # Single file

# E2E Tests (Playwright - NEW)
npm run playwright:test                # All Playwright tests
npm run playwright:ui                  # Interactive UI mode
npm run playwright:headed              # See browser during tests
npx playwright test tests/auth/login.spec.ts  # Single file
npm run playwright:debug tests/auth/login.spec.ts  # Debug specific file

# E2E Tests (Cypress - DEPRECATED)
cd superset-frontend/cypress-base
npm run cypress-run-chrome             # All Cypress tests (headless)
npm run cypress-debug                  # Interactive Cypress UI

# Backend  
pytest                                 # All tests
pytest tests/unit_tests/specific_test.py  # Single file
pytest tests/unit_tests/               # Directory

# If pytest fails with database/setup issues, ask the user to run test environment setup
```

## Environment Validation

**Quick Setup Check (run this first):**

```bash
# Verify Superset is running
curl -f http://localhost:8088/health || echo "❌ Setup required - see https://superset.apache.org/docs/contributing/development#working-with-llms"
```

**If health checks fail:**
"It appears you aren't set up properly. Please refer to the [Working with LLMs](https://superset.apache.org/docs/contributing/development#working-with-llms) section in the development docs for setup instructions."

**Key Project Files:**
- `superset-frontend/package.json` - Frontend build scripts (`npm run dev` on port 9000, `npm run test`, `npm run lint`)
- `pyproject.toml` - Python tooling (ruff, mypy configs)
- `requirements/` folder - Python dependencies (base.txt, development.txt)

## SQLAlchemy Query Best Practices  
- **Use negation operator**: `~Model.field` instead of `== False` to avoid ruff E712 errors
- **Example**: `~Model.is_active` instead of `Model.is_active == False`

## Pull Request Guidelines

**When creating pull requests:**

1. **Read the current PR template**: Always check `.github/PULL_REQUEST_TEMPLATE.md` for the latest format
2. **Use the template sections**: Include all sections from the template (SUMMARY, BEFORE/AFTER, TESTING INSTRUCTIONS, ADDITIONAL INFORMATION)
3. **Follow PR title conventions**: Use [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/)
   - Format: `type(scope): description`
   - Example: `fix(dashboard): load charts correctly`
   - Types: `fix`, `feat`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`

**Important**: Always reference the actual template file at `.github/PULL_REQUEST_TEMPLATE.md` instead of using cached content, as the template may be updated over time.

## Pre-commit Validation

**Use pre-commit hooks for quality validation:**

```bash
# Install hooks
pre-commit install

# IMPORTANT: Stage your changes first!
git add .                        # Pre-commit only checks staged files

# Quick validation (faster than --all-files)
pre-commit run                   # Staged files only
pre-commit run mypy              # Python type checking
pre-commit run prettier          # Code formatting
pre-commit run eslint            # Frontend linting
```

**Important pre-commit usage notes:**
- **Stage files first**: Run `git add .` before `pre-commit run` to check only changed files (much faster)
- **Virtual environment**: Activate your Python virtual environment before running pre-commit
  ```bash
  # Common virtual environment locations (yours may differ):
  source .venv/bin/activate      # if using .venv
  source venv/bin/activate       # if using venv
  source ~/venvs/superset/bin/activate  # if using a central location
  ```
  If you get a "command not found" error, ask the user which virtual environment to activate
- **Auto-fixes**: Some hooks auto-fix issues (e.g., trailing whitespace). Re-run after fixes are applied

## Common File Patterns

### API Structure
- **`/api.py`** - REST endpoints with decorators and OpenAPI docstrings
- **`/schemas.py`** - Marshmallow validation schemas for OpenAPI spec
- **`/commands/`** - Business logic classes with @transaction() decorators
- **`/models/`** - SQLAlchemy database models
- **OpenAPI docs**: Auto-generated at `/swagger/v1` from docstrings and schemas

### Migration Files
- **Location**: `superset/migrations/versions/`
- **Naming**: `YYYY-MM-DD_HH-MM_hash_description.py`
- **Utilities**: Use helpers from `superset.migrations.shared.utils` for database compatibility
- **Pattern**: Import utilities instead of raw SQLAlchemy operations

## Platform-Specific Instructions

- **[CLAUDE.md](CLAUDE.md)** - For Claude/Anthropic tools
- **[.github/copilot-instructions.md](.github/copilot-instructions.md)** - For GitHub Copilot  
- **[GEMINI.md](GEMINI.md)** - For Google Gemini tools
- **[GPT.md](GPT.md)** - For OpenAI/ChatGPT tools
- **[.cursor/rules/dev-standard.mdc](.cursor/rules/dev-standard.mdc)** - For Cursor editor

---

**LLM Note**: This codebase is actively modernizing toward full TypeScript and type safety. Always run `pre-commit run` to validate changes. Follow the ongoing refactors section to avoid deprecated patterns.
