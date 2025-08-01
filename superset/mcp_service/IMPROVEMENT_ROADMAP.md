# MCP Service Improvement Roadmap

This document outlines potential improvements for the Superset MCP service, organized by priority.

## 📊 Implementation Status Summary

### Completed (Aug 2025)
- ✅ **All High Priority items completed**
  - Global error handling middleware
  - Retry logic with exponential backoff
  - Rate limiting middleware (sliding window)
  - Field-level permissions with RBAC integration

### Additional Improvements Made
- 🏗️ **Code Organization**
  - Created `dao/` folder with `DAO` Protocol for better type safety
  - Moved `generate_explore_link` to new `explore/tool/` folder
  - Relocated test automation to `tests/integration_tests/mcp_service/`
  - Improved separation of concerns across modules

### Next Steps
- Focus on Medium Priority items (Redis caching, streaming responses)
- Consider Low Priority architectural improvements:
  - Service layer extraction (keeping tool registration intact)
  - Command pattern implementation
  - Configuration reorganization
  - Improved type safety and documentation

## 🔴 High Priority (Security & Reliability) - COMPLETED ✅

### 1. Error Handling Enhancement
- [x] **Implement global error handler middleware for consistent error responses**
  - Added `GlobalErrorHandlerMiddleware` in `middleware.py`
  - Provides structured error responses with error IDs for tracking
  - Logs errors to both standard logger and Superset's event system
  - Maps different exception types to appropriate user-friendly messages

- [x] **Add retry logic for transient failures (database timeouts, screenshot generation)**
  - Created `retry_utils.py` with comprehensive retry functionality
  - Implemented exponential backoff with jitter to avoid thundering herd
  - Added decorators: `@retry_on_exception` and `@async_retry_on_exception`
  - Integrated retry logic into:
    - Database operations in `generic_tools.py` (via `retry_database_operation`)
    - Screenshot generation in `pooled_screenshot.py` (via `retry_screenshot_operation`)
  - Configurable retry attempts and delays for different operation types

### 2. Security Enhancements
- [x] **Add rate limiting middleware to prevent abuse**
  - Implemented `RateLimitMiddleware` with sliding window rate limiting
  - Different limits for:
    - Default: 60 requests/minute
    - Authenticated users: 120 requests/minute  
    - Expensive operations (screenshots, chart generation): 10 requests/minute
  - In-memory storage with automatic cleanup of old entries
  - Logs rate limit violations to event system

- [x] **Add field-level permissions for sensitive data**
  - Created `permissions_utils.py` with comprehensive field filtering
  - Implemented `FieldPermissionsMiddleware` to filter responses automatically
  - Sensitive fields defined per object type (dataset, chart, dashboard)
  - Integration with Superset's RBAC system
  - Fields like `sql`, `extra`, `query_context` require specific permissions

## 🟡 Medium Priority (Performance & Monitoring)

### 3. Performance Optimizations
- [ ] Implement Redis-based caching for frequently accessed metadata
- [ ] Add pagination cursor support for batch operations in list endpoints
- [ ] Add support for streaming responses for large data exports

### 4. Security Enhancements (Continued)
- [ ] Implement request signing/validation for webhook-style integrations

### 5. Monitoring & Observability
- [ ] Add OpenTelemetry instrumentation for distributed tracing
- [ ] Add metrics collection for tool usage patterns

## 🟢 Low Priority (Developer Experience & Architecture)

### 6. Monitoring & Observability (Continued)
- [ ] Implement health check endpoints beyond basic FastMCP support

### 7. Developer Tools
- [ ] Create a Swagger/OpenAPI spec generator from Pydantic schemas
- [ ] Add development mode with request/response logging
- [ ] Add GraphQL-style field selection for list operations

### 8. Architecture Refinements
- [ ] Extract screenshot service into separate microservice
- [ ] Implement plugin system for custom tools

### 9. Structural Improvements (Code Organization)
- [ ] **Extract Service Layer Pattern**
  - Keep @mcp.tool decorators in place (required for registration)
  - Move business logic to service classes (ChartService, DashboardService, etc.)
  - Tools become thin wrappers that delegate to services
  - Benefits: Better testing, separation of concerns, reusability

- [ ] **Implement Command Pattern for Complex Operations**
  - CreateChartCommand, UpdateChartCommand, GenerateDashboardCommand
  - Following Superset's command pattern for consistency
  - Handles transactions, validation, and error handling uniformly
  - Keep within tool context to respect app context requirements

- [ ] **Create MCP-Specific Exception Hierarchy**
  - Inherit from Superset's exception classes
  - MCPException, MCPToolNotFoundError, MCPRateLimitError, etc.
  - Better error handling and debugging

- [ ] **Reorganize Configuration**
  - Create config/ module with structured settings
  - Centralized MCPConfigManager to handle app context issues
  - Separate files: defaults.py, auth.py, cache.py, limits.py

- [ ] **Standardize Module Structure**
  - Each feature area follows: tool/, services/, commands/, schemas/
  - Consistent organization across chart/, dashboard/, dataset/, etc.

- [ ] **Add Tool Registration Documentation**
  - Document why tools must be imported in mcp_app.py
  - Create README_ARCHITECTURE.md explaining registration pattern
  - Add inline comments about registration requirements

- [ ] **Improve Type Safety**
  - Add type stubs (.pyi files) for FastMCP
  - Create types/ directory for better IDE support
  - Enhance DAO Protocol with all required methods

- [ ] **Reorganize Utilities**
  - Group by function: cache/, permissions/, retry/, validation/
  - Move out of flat structure into categorized modules

## Implementation Notes

### Error Handling & Retry Logic
Consider using libraries like:
- `tenacity` for retry logic with exponential backoff
- Custom FastMCP middleware for global error handling

### Redis Caching
- Use existing Superset Redis connections where possible
- Cache frequently accessed metadata (dataset schemas, dashboard configs)
- Set appropriate TTLs based on data volatility

### Rate Limiting
- Consider `slowapi` (Starlette-based rate limiter)
- Implement per-user and per-IP limits
- Add bypass for internal services

### OpenTelemetry
- Use `opentelemetry-instrumentation-fastapi`
- Integrate with existing Superset telemetry if available
- Track tool usage, response times, error rates

### Field-Level Permissions
- Extend existing RBAC system
- Define sensitive fields in schema metadata
- Filter responses based on user permissions

### Streaming Responses
- Use Server-Sent Events (SSE) for large exports
- Implement chunked transfer encoding
- Add progress indicators for long-running operations

## Success Metrics

- **Error Rate**: < 0.1% for non-user errors
- **Response Time**: P95 < 500ms for metadata operations
- **Cache Hit Rate**: > 80% for frequently accessed data
- **Security**: Zero unauthorized data access incidents
- **Developer Satisfaction**: Reduced time to implement new tools

## Timeline Estimates

- **High Priority**: 2-3 sprints (4-6 weeks)
- **Medium Priority**: 3-4 sprints (6-8 weeks)
- **Low Priority**: As resources allow

## Dependencies

- Coordination with Superset core team for:
  - Redis connection sharing
  - RBAC integration
  - Telemetry standards
- Infrastructure support for:
  - Redis deployment (if not existing)
  - APM/monitoring tools
  - Rate limiting at edge (optional)
