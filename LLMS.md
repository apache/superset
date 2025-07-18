# LLM Context Guide for Apache Superset

This document provides essential context for LLMs working with the Apache Superset codebase. Apache Superset is a modern, enterprise-ready business intelligence web application for data exploration and visualization.

## Repository Overview

**Apache Superset** is a data visualization and exploration platform that can replace or augment proprietary BI tools. It features a Flask/Python backend with a React/TypeScript frontend, supporting 40+ visualization types and connecting to any SQL-speaking database.

### Core Architecture
- **Backend**: Python 3.11 (recommended) with Flask, SQLAlchemy, Celery (async tasks)
- **Frontend**: React with TypeScript, built via Webpack
- **Database**: PostgreSQL (prod) or SQLite (dev) for metadata storage
- **Cache**: Redis for query caching and Celery message queue
- **Deployment**: Cloud-native, containerized architecture

## Key Directories

```
superset/
├── superset/                    # Main Python backend application
│   ├── views/                   # Flask views and API endpoints
│   ├── models/                  # SQLAlchemy models
│   ├── connectors/              # Database connectors
│   └── security/                # Authentication and authorization
├── superset-frontend/           # React TypeScript frontend
│   ├── src/
│   │   ├── components/          # Reusable React components
│   │   ├── explore/             # Chart creation interface
│   │   ├── dashboard/           # Dashboard interface
│   │   └── SqlLab/              # SQL IDE components
│   └── packages/
│       └── superset-ui-core/    # Foundational UI library & components
├── tests/                       # Python and integration tests
├── docker/                      # Docker configuration files
├── docs/                        # Documentation source (CRITICAL for changes)
├── UPDATING.md                  # Breaking changes and migration notes
└── requirements/                # Python dependencies by environment
```

### Don't Modify
- `superset-frontend/src/assets/` - Built frontend assets
- `superset/static/assets/` - Compiled static files
- Migration files (unless creating new ones)

## Development Setup

### Recommended Approach
- **Python**: 3.11 (official recommended version)
- **Docker Compose**: `docker compose up --build` (fastest way to get running)
- **Package Manager**: Use `uv` instead of pip for faster Python dependency management
- **Node**: Required for frontend, builds can take 10+ minutes initially

### Environment Setup
```bash
# Python with uv
uv venv
source .venv/bin/activate
uv pip install -r requirements/development.txt

# With Docker (recommended)
docker compose up --build
```

## Documentation

### docs/ Directory
The `docs/` directory is **critical** for any changes:
- **Source of truth**: All documentation lives here
- **Website generation**: Powers the official Superset website
- **Update requirement**: Any API/feature changes MUST include doc updates
- **Structure**: Organized by user type (installation, configuration, development)
- **Format**: Markdown files processed into the official site

### UPDATING.md
**Always check `UPDATING.md` before making changes**:
- Contains breaking changes between versions
- Migration instructions for upgrades
- API deprecation notices
- Required configuration changes
- **Must update**: Add entries for any breaking changes you introduce

## Code Standards & Patterns

### Python Backend
- **Python 3.11**: Official recommended version
- **Formatting**: Black, flake8 linting
- **Types**: Type hints required for all new code
- **Testing**: pytest for unit tests in `tests/unit_tests/`
- **Models**: SQLAlchemy models in `superset/models/`
- **APIs**: REST endpoints follow existing patterns in `superset/views/api/`

### TypeScript Frontend
- **No `any` types**: Use proper TypeScript typing
- **Components**: Functional components with hooks
- **UI Library**: Ant Design (antd) via `@superset-ui/core/components`
- **Testing**: Jest (no Enzyme - it's been removed from the repo)
- **State**: Redux for global state, React hooks for local

### Superset UI Core
The `packages/superset-ui-core` package is foundational to the frontend:
- Contains shared components, utilities, and types
- Provides the component library wrapping Ant Design
- All new UI components should extend or use patterns from this library
- Critical for maintaining consistency across the application

## Ongoing Refactors

**Major ongoing migrations you should be aware of:**

### Frontend Modernization
- **JavaScript → TypeScript**: Converting remaining JS files to TS
- **Removing `any` types**: Replacing all `any` with proper TypeScript types
- **Enzyme removal**: All tests now use React Testing Library/Jest (Enzyme is fully removed)
- **Component standardization**: Migrating to Ant Design components via `@superset-ui/core`

### Backend Type Safety
- **MyPy everywhere**: Adding type annotations and MyPy checking across the entire Python codebase
- **Type hint migration**: Retrofitting existing functions with proper type hints
- **SQLAlchemy typing**: Improving model type safety

### Architecture Evolution
- **Dataset-centric approach**: Moving toward enriched datasets as the core abstraction
- **Plugin architecture**: Standardizing visualization plugins and extension points
- **API consistency**: Refactoring APIs for better REST compliance

## CI/CD & Testing

### GitHub Actions (GHA)
**Superset is committed to GitHub Actions for all CI/automation**:
- **Pre-commit hooks**: Mandatory formatting, linting, type checking
- **Test matrix**: Python/Node versions, multiple databases
- **Build verification**: Frontend builds, Docker images
- **Security scanning**: Dependency vulnerabilities, code quality
- **Release automation**: Automated publishing and deployment
- **Documentation**: Auto-deploy docs changes to website

### Testing Strategy
- **Unit tests**: Jest (frontend), pytest (backend)
- **Integration tests**: Full stack testing via utility scripts
- **No Enzyme**: Use React Testing Library for component testing
- **Coverage**: Aim for high test coverage on new code

## Extending Superset

### Superset Improvement Proposals (SIPs)
Superset follows a formal SIP process for major changes:
- **SIP process**: Technical proposals for significant features/changes
- **Community review**: Open discussion and consensus building
- **Implementation tracking**: Status of approved SIPs
- **Extension patterns**: Guidelines for adding new functionality

### Plugin Development
- **Visualization plugins**: TypeScript/JavaScript in `superset-frontend/plugins/`
- **Database connectors**: Python in `superset/connectors/`
- **Custom authentication**: Extend Flask-AppBuilder patterns
- **Configuration**: Override via `superset_config.py`

## Architecture Patterns

### Dataset-Centric Approach
Charts built from enriched datasets containing:
- Dimension columns with labels/descriptions
- Predefined metrics as SQL expressions
- Self-service analytics within defined contexts

### Security Model
- **RBAC**: Role-based access via Flask-AppBuilder
- **Feature flags**: Control feature rollouts
- **Row-level security**: SQL-based data access control

## Performance & Scaling

### Caching Strategy
- **Query results**: Redis backend for query caching
- **Metadata**: Separate cache for configuration
- **Async queries**: Celery for long-running operations

### Database Integration
Supports 40+ databases via SQLAlchemy:
- Cloud: Snowflake, BigQuery, Redshift
- Traditional: PostgreSQL, MySQL, Oracle
- Modern: Trino, Presto, ClickHouse

## Contributing Guidelines

### Development Flow
- **Fork & PR**: All contributions via personal forks
- **Pre-commit**: Install hooks with `pre-commit install`
- **PR titles**: Use conventional commits (`feat:`, `fix:`, `docs:`)
- **Testing**: Include tests for new functionality
- **Documentation**: Update `docs/` for any user-facing changes
- **Breaking changes**: Document in `UPDATING.md`

### Code Review Focus
- **Type safety**: Proper TypeScript/Python typing
- **Performance**: Database queries, frontend bundle size
- **Accessibility**: UI components should be accessible
- **Documentation**: Update relevant docs with changes

## Common Patterns

### Frontend
- Use `@superset-ui/core/components` for UI components
- Leverage existing hooks and context patterns
- Follow dataset-centric visualization approach
- Implement proper error boundaries

### Backend
- Extend existing FAB ModelView patterns
- Use SQLAlchemy relationships properly
- Implement proper error handling and logging
- Follow REST API conventions

## Platform-Specific LLM Instructions

- **[CLAUDE.md](CLAUDE.md)** - For Claude/Anthropic tools
- **[.github/copilot-instructions.md](.github/copilot-instructions.md)** - For GitHub Copilot
- **[GEMINI.md](GEMINI.md)** - For Google Gemini tools
- **[GPT.md](GPT.md)** - For OpenAI/ChatGPT tools
- **[CURSOR.md](CURSOR.md)** - For Cursor editor

## Environment Validation Commands

When unsure about environment state, run these diagnostic commands:

**Check Docker services:**
```bash
docker-compose ps
# Expected: superset_app, superset_db, superset_redis all "Up"
```

**Check Node setup:**
```bash
npm list --depth=0
# Expected: No missing dependencies
```

**Check Python environment:**
```bash
python --version && which python
# Expected: Python 3.11+ in project venv
```

## LLM Diagnostic Response Patterns

When environment issues are detected, respond with helpful guidance:

❌ **"I notice you haven't run `npm i` yet. Please run this first:"**
```bash
npm i
```

❌ **"Docker services aren't running. Start them with:"**
```bash
docker-compose up -d
```

✅ **"Environment looks good! Proceeding with the task..."**

## Running Unit Tests

**Frontend tests:**
```bash
npm run test
```

**Backend tests:**
```bash
pytest
```

**Test specific modules:**
```bash
pytest tests/unit_tests/specific_module_test.py
```

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
