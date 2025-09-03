# Superset Query Sidecar Service

A Node.js sidecar service that computes Superset QueryObjects from form_data, eliminating the need to store stale query objects in the database for Alerts & Reports.

## Overview

This service provides a REST API that transforms Superset's `form_data` into `QueryObject` format using the same logic as the frontend, ensuring consistency and eliminating staleness issues in Alerts & Reports.

## Features

- **Real-time QueryObject generation**: No stale data from database
- **Frontend-compatible logic**: Uses the same transformation logic as superset-ui-core  
- **TypeScript support**: Full type safety
- **Docker support**: Easy deployment
- **Health checks**: Built-in monitoring endpoints
- **CORS support**: Configurable for Superset integration

## Quick Start

### Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm test
```

### Production

```bash
# Build the application
npm run build

# Start production server
npm start
```

### Docker

```bash
# Build Docker image
docker build -t superset-query-sidecar .

# Run container
docker run -p 3001:3001 superset-query-sidecar
```

## API Reference

### POST /api/v1/query-object

Transforms form_data into a QueryObject.

**Request:**
```json
{
  "form_data": {
    "datasource": "1__table",
    "viz_type": "table",
    "metrics": ["count"],
    "columns": ["name"],
    "time_range": "No filter"
  },
  "query_fields": {
    "x": "columns",
    "y": "metrics"
  }
}
```

**Response:**
```json
{
  "query_object": {
    "datasource": "1__table",
    "metrics": ["count"],
    "columns": ["name"],
    "time_range": "No filter",
    "filters": [],
    "extras": {}
  }
}
```

### GET /health

Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2023-12-01T12:00:00.000Z",
  "version": "1.0.0"
}
```

## Configuration

Environment variables:

- `PORT`: Server port (default: 3001)
- `HOST`: Server host (default: localhost)
- `NODE_ENV`: Environment mode (development/production)
- `SUPERSET_ORIGINS`: Allowed CORS origins (comma-separated)

## Integration with Superset

This service is designed to be called by Superset's Python backend to generate QueryObjects for Alerts & Reports, replacing the current approach of reading stale query objects from the database.

## Architecture

```
┌─────────────────┐    ┌──────────────────────┐    ┌─────────────────────┐
│   Superset      │    │   Query Sidecar     │    │   Alerts & Reports  │
│   Frontend      │    │   Service            │    │                     │
│                 │    │                      │    │                     │
│   form_data ────┼────┼──► buildQueryObject │◄───┼─── Python Client    │
│                 │    │                      │    │                     │
└─────────────────┘    └──────────────────────┘    └─────────────────────┘
```

## Testing

```bash
# Run all tests
npm test

# Run tests in watch mode  
npm run test:watch

# Run tests with coverage
npm test -- --coverage
```

## License

Licensed under the Apache License, Version 2.0.
