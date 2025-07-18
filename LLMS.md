# LLM Context Guide for Apache Superset

Apache Superset is a data visualization platform with Flask/Python backend and React/TypeScript frontend.

## ⚠️ CRITICAL: Ongoing Refactors (What NOT to Do)

**These migrations are actively happening - avoid deprecated patterns:**

### Frontend Modernization
- **NO `any` types** - Use proper TypeScript types
- **NO JavaScript files** - Convert to TypeScript (.ts/.tsx)
- **NO Enzyme** - Use React Testing Library/Jest (Enzyme fully removed)
- **Use @superset-ui/core** - Don't import Ant Design directly

### Backend Type Safety
- **Add type hints** - All new Python code needs proper typing
- **MyPy compliance** - Run `pre-commit run mypy` to validate
- **SQLAlchemy typing** - Use proper model annotations

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
- **NO `any` types** - Use proper TypeScript
- **Functional components** with hooks
- **@superset-ui/core** for UI components (not direct antd)
- **Jest** for testing (NO Enzyme)
- **Redux** for global state, hooks for local

### Python Backend  
- **Type hints required** for all new code
- **MyPy compliant** - run `pre-commit run mypy`
- **SQLAlchemy models** with proper typing
- **pytest** for testing

## Documentation Requirements

- **docs/**: Update for any user-facing changes
- **UPDATING.md**: Add breaking changes here
- **Docstrings**: Required for new functions/classes

## Architecture Patterns

### Dataset-Centric Approach
Charts built from enriched datasets containing:
- Dimension columns with labels/descriptions  
- Predefined metrics as SQL expressions
- Self-service analytics within defined contexts

### Security & Features
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

### Running Tests
```bash
# Frontend
npm run test

# Backend  
pytest

# Specific module
pytest tests/unit_tests/specific_module_test.py
```

## Pre-commit Validation

**Use pre-commit hooks for quality validation:**

```bash
# Install hooks
pre-commit install

# Run all hooks
pre-commit run

# Run specific validation
pre-commit run mypy        # Python type checking
pre-commit run prettier    # Code formatting
pre-commit run eslint      # Frontend linting
```

## Platform-Specific Instructions

- **[CLAUDE.md](CLAUDE.md)** - For Claude/Anthropic tools
- **[.github/copilot-instructions.md](.github/copilot-instructions.md)** - For GitHub Copilot  
- **[GEMINI.md](GEMINI.md)** - For Google Gemini tools
- **[GPT.md](GPT.md)** - For OpenAI/ChatGPT tools
- **[CURSOR.md](CURSOR.md)** - For Cursor editor

---

**LLM Note**: This codebase is actively modernizing toward full TypeScript and type safety. Always run `pre-commit run` to validate changes. Follow the ongoing refactors section to avoid deprecated patterns.

### Python Test Utilities and Patterns

**Base Test Classes:**
- `tests/integration_tests/base_tests.py` - `SupersetTestCase` with user management, database operations, dashboard creation utilities
- `tests/integration_tests/base_api_tests.py` - `ApiOwnersTestCaseMixin` for API ownership testing

**Key Test Fixtures (conftest.py files):**
- `tests/conftest.py` - Root fixtures with `@with_config` decorator, data loading fixtures
- `tests/integration_tests/conftest.py` - Integration fixtures with authentication (`login_as`, `login_as_admin`), feature flags (`@with_feature_flags`), database markers (`@only_postgresql`, `@only_sqlite`)
- `tests/unit_tests/conftest.py` - Unit test fixtures with in-memory SQLite, app mocking

**Test Utilities:**
- `tests/integration_tests/dashboard_utils.py` - `create_table_metadata()`, `create_slice()`, `create_dashboard()`
- `tests/unit_tests/db_engine_specs/utils.py` - `assert_convert_dttm()`, `assert_column_spec()` for database engine testing
- `tests/common/logger_utils.py` - `@log` decorator for function logging

**Common Patterns:**
- Use `SupersetTestCase` as base class for integration tests
- Use `@with_config` and `@with_feature_flags` decorators for mocking
- Use `temporary_user` context manager for user-scoped tests
- Use database markers for database-specific tests

### TypeScript/TSX Test Utilities and Patterns

**Main Test Helpers:**
- `superset-frontend/spec/helpers/testing-library.tsx` - Custom `render()` function with provider wrappers, `createWrapper()` with Redux/Router/Theme support, `selectOption()` helper
- `superset-frontend/spec/helpers/setup.ts` - Global test setup, DOM configuration, emotion matchers
- `superset-frontend/spec/helpers/shim.tsx` - Environment shims for Worker, IntersectionObserver, ResizeObserver, jQuery, translation

**Provider Wrappers:**
- `superset-frontend/spec/helpers/ProviderWrapper.tsx` - Simple theme and routing provider wrapper

**Browser API Mocks:**
- `superset-frontend/spec/helpers/Cache.ts` - Cache API mock
- `superset-frontend/spec/helpers/IntersectionObserver.ts` - IntersectionObserver mock
- `superset-frontend/spec/helpers/ResizeObserver.ts` - ResizeObserver mock
- `superset-frontend/spec/helpers/Worker.ts` - Web Worker mock

**Common Patterns:**
- Use custom `render()` from testing-library.tsx with provider wrappers
- Use `createStore()` for test Redux stores
- Use `selectOption()` for select component testing
- Use `sleep()` utility for async operations

## Unit Test Philosophy

**Good Tests:**
- Test behavior, not implementation details
- Focus on public APIs and user-facing functionality
- Aim for 70-80% coverage of critical paths
- Mock external dependencies (APIs, databases)
- Use descriptive test names that explain the scenario

**Avoid:**
- Testing internal implementation details
- Overly complex test setups
- Tests that break when refactoring without behavior changes
- Deep coupling with specific implementation approaches

## Development Setup Validation

Before starting development tasks, LLMs should validate:

1. **Docker environment is ready:**
   - `docker-compose ps` shows running services
   - Database is accessible

2. **Dependencies are installed:**
   - Node modules: `npm list --depth=0`
   - Python packages: `pip list` or `uv pip list`

3. **Build tools are working:**
   - `npm run build` succeeds
   - `pytest --version` works

## Pre-commit Hooks for Validation

**This repository has a rich set of commit hooks that provide a quick and easy way to validate work and assumptions in a rich sandbox environment that always works.**

**Read `.pre-commit-config.yaml` carefully and use `pre-commit run` to validate work as you go.**

**Key pre-commit hooks:**
- **MyPy** - Type checking for Python code
- **Prettier** - Code formatting for JavaScript/TypeScript
- **ESLint** - Linting for frontend and docs
- **TypeScript** - Type checking for frontend code
- **Ruff** - Python linting and formatting
- **Custom pylint** - Superset-specific Python linting

**Usage:**
```bash
# Install pre-commit hooks
pre-commit install

# Run all hooks on staged files
pre-commit run

# Run all hooks on all files
pre-commit run --all-files

# Run specific hook
pre-commit run mypy
pre-commit run prettier
pre-commit run eslint
```

**LLM Workflow Integration:**
- Run `pre-commit run` after making changes to validate code quality
- Use specific hooks to test assumptions (`pre-commit run mypy` for Python typing)
- Leverage the sandbox environment for consistent validation
- Fix issues caught by hooks before committing

## Common Troubleshooting

**Docker issues:**
```bash
# Restart services
docker-compose down && docker-compose up -d

# Check logs
docker-compose logs superset_app
```

**Node dependency issues:**
```bash
# Clean install
rm -rf node_modules package-lock.json
npm i
```

**Python environment issues:**
```bash
# Activate virtual environment
source venv/bin/activate  # or uv venv activate
pip install -r requirements/development.txt
```

## Resources

- **Documentation**: https://superset.apache.org/docs/
- **Contributing**: See `CONTRIBUTING.md` for setup details
- **Community**: dev@superset.apache.org mailing list
- **SIPs**: Track improvement proposals and roadmap
- **GitHub**: https://github.com/apache/superset
- **Breaking Changes**: Always check `UPDATING.md`

---

**LLM Note**: Always check ongoing refactors before making changes. The codebase is actively modernizing toward full TypeScript and type safety. Follow existing patterns, especially around `@superset-ui/core` usage and the dataset-centric architecture. Update documentation in `docs/` for any user-facing changes and note breaking changes in `UPDATING.md`.
