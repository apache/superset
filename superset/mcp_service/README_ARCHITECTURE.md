# MCP Service Architecture

The Superset MCP (Model Context Protocol) service provides programmatic access to Superset dashboards through both REST API and FastMCP interfaces.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        MCP Service                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐    ┌─────────────────┐    ┌──────────────┐ │
│  │   Flask Server  │    │  FastMCP Server │    │   Proxy      │ │
│  │   (Port 5008)   │    │  (Port 5009)    │    │   Scripts    │ │
│  └─────────────────┘    └─────────────────┘    └──────────────┘ │
│           │                       │                      │      │
│           │                       │                      │      │
│  ┌─────────────────┐    ┌─────────────────┐    ┌──────────────┐ │
│  │   REST API      │    │   FastMCP       │    │   run_proxy  │ │
│  │   Endpoints     │    │   Tools         │    │   .sh        │ │
│  │                 │    │                 │    │              │ │
│  │ • /health       │    │ • list_dashboards│   │ • Local proxy│ │
│  │ • /list_dashboards│  │ • get_dashboard │   │   for free    │ │
│  │ • /dashboard/<id>│   │ • health_check  │   │   users       │ │
│  └─────────────────┘    └─────────────────┘    └──────────────┘ │
│           │                       │                      │      │
│           │                       │                      │      │
│  ┌─────────────────┐    ┌─────────────────┐    ┌──────────────┐ │
│  │   API Layer     │    │   HTTP Client   │    │   simple_    │ │
│  │   (api/v1/)     │    │   (requests)    │    │   proxy.py   │ │
│  │                 │    │                 │    │              │ │
│  │ • Authentication│    │ • Internal API  │    │ • Background │ │
│  │ • Request/Response│  │   calls         │    │   proxy      │ │
│  │ • Error handling│    │ • JSON parsing  │    │   process    │ │
│  └─────────────────┘    └─────────────────┘    └──────────────┘ │
│           │                       │                      │      │
│           └───────────────────────┼──────────────────────┘      │
│                                   │                             │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                    Superset Core                            │ │
│  │                                                             │ │
│  │  ┌─────────────────┐    ┌─────────────────┐    ┌──────────┐ │ │
│  │  │   Database      │    │   Models        │    │   DAOs   │ │ │
│  │  │   (SQLAlchemy)  │    │   (Dashboard,   │    │          │ │ │
│  │  │                 │    │    Chart, etc.) │    │          │ │ │
│  │  └─────────────────┘    └─────────────────┘    └──────────┘ │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Components

### 1. Flask Server (`server.py`)
- **Purpose**: Main HTTP server providing REST API endpoints
- **Port**: 5008 (configurable)
- **Features**:
  - Flask application with Superset integration
  - Database connection management
  - Authentication middleware
  - Automatic FastMCP server startup

### 2. FastMCP Server (`fastmcp_server.py`)
- **Purpose**: Model Context Protocol server for AI tool integration
- **Port**: 5009 (server port + 1)
- **Features**:
  - Tools for dashboard discovery and management
  - Resource templates for dashboard operations
  - Prompt templates for common tasks
  - Internal HTTP client for API calls

### 3. REST API (`api/v1/endpoints.py`)
- **Purpose**: HTTP endpoints for dashboard operations
- **Endpoints**:
  - `GET /health` - Service health check
  - `GET /list_dashboards` - Simple filtering with query parameters
  - `POST /list_dashboards` - Advanced filtering with JSON payload
  - `GET /dashboard/<id>` - Get specific dashboard details

### 4. Data Schemas (`schemas.py`)
- **Purpose**: Request/response validation and serialization
- **Features**:
  - Pydantic models for API contracts
  - Filter validation and parsing
  - Response formatting
  - Column selection handling

### 5. Proxy Scripts
- **`run_proxy.sh`**: Shell script for local proxy setup
- **`simple_proxy.py`**: Python proxy for background operation
- **Purpose**: Enable Claude Desktop integration for free users

## Data Flow

1. **Client Request** → Flask Server (REST) or FastMCP Server
2. **Authentication** → API key validation
3. **Request Processing** → Parameter parsing and validation
4. **Database Query** → Superset models and DAOs
5. **Response Formatting** → Schema validation and serialization
6. **Client Response** → JSON or FastMCP format

## Key Features

- **Dual Interface**: REST API + FastMCP for maximum compatibility
- **Flexible Filtering**: Simple query params + advanced JSON filters
- **Column Selection**: Dynamic column loading based on requests
- **Authentication**: API key-based security
- **Proxy Support**: Local proxy for Claude Desktop integration
- **Standalone Operation**: Independent of main Superset web server

## Configuration

- **API Key**: `MCP_API_KEY` environment variable
- **Ports**: Configurable via CLI arguments
- **Debug Mode**: SQL and application logging
- **Database**: Uses Superset's existing database connection 