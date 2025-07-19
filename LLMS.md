# LLM Context Guide for Apache Superset

Apache Superset is a data visualization platform with Flask/Python backend and React/TypeScript frontend.

## ⚠️ CRITICAL: Ongoing Refactors (What NOT to Do)

**These migrations are actively happening - avoid deprecated patterns:**

### Frontend Modernization
- **NO `any` types** - Use proper TypeScript types
- **NO JavaScript files** - Convert to TypeScript (.ts/.tsx)
- **NO Enzyme** - Use React Testing Library/Jest (Enzyme fully removed)
- **Use @superset-ui/core** - Don't import Ant Design directly

### Testing Strategy Migration
- **Prefer unit tests** over integration tests
- **Prefer integration tests** over Cypress end-to-end tests
- **Cypress is last resort** - Actively moving away from Cypress
- **Use Jest + React Testing Library** for component testing

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

### Apache License Headers
- **New files require ASF license headers** - When creating new code files, include the standard Apache Software Foundation license header
- **LLM instruction files are excluded** - Files like LLMS.md, CLAUDE.md, etc. are in `.rat-excludes` to avoid header token overhead

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
npm run test                           # All tests
npm run test -- filename.test.tsx     # Single file

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

## Pre-commit Validation

**Use pre-commit hooks for quality validation:**

```bash
# Install hooks
pre-commit install

# Quick validation (faster than --all-files)
pre-commit run                    # Staged files only
pre-commit run mypy              # Python type checking
pre-commit run prettier          # Code formatting
pre-commit run eslint            # Frontend linting
```

## Platform-Specific Instructions

- **[CLAUDE.md](CLAUDE.md)** - For Claude/Anthropic tools
- **[.github/copilot-instructions.md](.github/copilot-instructions.md)** - For GitHub Copilot  
- **[GEMINI.md](GEMINI.md)** - For Google Gemini tools
- **[GPT.md](GPT.md)** - For OpenAI/ChatGPT tools
- **[CURSOR.md](CURSOR.md)** - For Cursor editor

---

**LLM Note**: This codebase is actively modernizing toward full TypeScript and type safety. Always run `pre-commit run` to validate changes. Follow the ongoing refactors section to avoid deprecated patterns.
