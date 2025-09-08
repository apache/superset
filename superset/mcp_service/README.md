# Superset MCP Service

This is the **scaffolding version** of the Apache Superset Model Context Protocol (MCP) service. This foundational implementation establishes the core structure and contracts for the MCP service without providing the full functionality.

## Overview

The Superset MCP Service will provide a standardized way for AI assistants and tools to interact with Apache Superset through the Model Context Protocol. When fully implemented, it will offer tools for:

- **Chart Management**: Create, update, and retrieve charts
- **Dashboard Operations**: Build and manage dashboards
- **Dataset Exploration**: Discover and analyze datasets
- **SQL Execution**: Run SQL queries through SQL Lab
- **System Information**: Access Superset instance metadata

## Current Status: Scaffolding (PR 1)

This scaffolding implementation includes:

### Core Infrastructure
- Basic project structure (`superset/mcp_service/`)
- Configuration management (`config.py`)
- Authentication framework (`auth.py`)
- Module entry points (`__init__.py`, `__main__.py`)

### Schema Definitions
All modules have complete schema definitions establishing the contracts:
- `chart/schemas.py` - Chart-related request/response schemas
- `dashboard/schemas.py` - Dashboard operation schemas  
- `dataset/schemas.py` - Dataset discovery and metadata schemas
- `explore/schemas.py` - Interactive exploration schemas
- `system/schemas.py` - System information and health schemas

### Launcher Infrastructure  
- Node.js launcher script (`bin/superset-mcp.js`)
- Environment detection and Python integration setup

## Architecture

```
superset/mcp_service/
├── __init__.py              # Main module initialization
├── __main__.py              # Entry point for python -m superset.mcp_service
├── config.py                # Configuration management
├── auth.py                  # Authentication framework
├── bin/
│   └── superset-mcp.js      # Node.js launcher script
├── chart/
│   ├── __init__.py
│   └── schemas.py           # Chart operation schemas
├── dashboard/
│   ├── __init__.py
│   └── schemas.py           # Dashboard operation schemas
├── dataset/
│   ├── __init__.py
│   └── schemas.py           # Dataset discovery schemas
├── explore/
│   ├── __init__.py
│   └── schemas.py           # Exploration tool schemas
├── system/
│   ├── __init__.py
│   └── schemas.py           # System information schemas
└── README.md                # This file
```

## Design Principles

### Non-Breaking Changes
- This scaffolding causes no changes to existing Superset functionality
- Can be imported safely without side effects
- Establishes foundation without disrupting current operations

### Extensible Architecture
- Modular design allows incremental implementation
- Clear separation between modules (chart, dashboard, dataset, etc.)
- Schema-first approach ensures consistent contracts

### Authentication Ready
- Pluggable authentication provider system
- Support for multiple auth methods (token, session, OAuth)
- Default no-auth provider for development

## Usage (Scaffolding)

Currently, you can run the scaffolding to verify the structure:

```bash
# Run as Python module
python -m superset.mcp_service

# Run launcher script
node superset/mcp_service/bin/superset-mcp.js --help
```

Both commands will display scaffolding information and exit successfully.

## Next Steps

Subsequent PRs will implement:

1. **Tool Implementation**: Actual MCP tool functions for each module
2. **FastMCP Integration**: Complete MCP server implementation  
3. **Authentication**: Real authentication providers and security
4. **Error Handling**: Comprehensive error handling and validation
5. **Testing**: Unit and integration tests
6. **Documentation**: Complete API documentation and examples

## Development

This scaffolding establishes the foundation for MCP service development. All schema contracts are defined, allowing parallel development of different modules.

### Key Components

- **Schemas**: Pydantic models defining all request/response structures
- **Auth Framework**: Pluggable authentication with RBAC support
- **Configuration**: Flexible configuration system for different deployments
- **Launcher**: Node.js integration for easy deployment and usage

## License

Licensed under the Apache License, Version 2.0. See the main Superset repository for full license details.
