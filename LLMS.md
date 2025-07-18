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

## Resources

- **Documentation**: https://superset.apache.org/docs/
- **Contributing**: See `CONTRIBUTING.md` for setup details
- **Community**: dev@superset.apache.org mailing list
- **SIPs**: Track improvement proposals and roadmap
- **GitHub**: https://github.com/apache/superset
- **Breaking Changes**: Always check `UPDATING.md`

---

**LLM Note**: Always check ongoing refactors before making changes. The codebase is actively modernizing toward full TypeScript and type safety. Follow existing patterns, especially around `@superset-ui/core` usage and the dataset-centric architecture. Update documentation in `docs/` for any user-facing changes and note breaking changes in `UPDATING.md`.
