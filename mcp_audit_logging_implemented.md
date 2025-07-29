# MCP Audit Logging - IMPLEMENTED ✅

**Status:** Implemented MCP audit logging per Max's requirements using `@event_logger.log_this_with_context`.

**What was implemented:**

**Must have (✅):**
- `log_source: 'mcp'` - clearly marks requests as coming from MCP
- `impersonation: g.user.username` - tracks which user MCP is acting as

**Ideally (✅):**  
- `model_info: request.headers.get('User-Agent')` - captures AI model info from client
- `session_info: request.headers.get('X-Session-ID')` - tracks AI conversation sessions
- `whitelisted_payload: sanitize_mcp_payload(kwargs)` - sanitized request data (removes secrets, truncates long text)
- `jwt_user` & `jwt_scopes` - JWT context when available

**Implementation details:**
- Extended existing `@mcp_auth_hook` decorator with `@event_logger.log_this_with_context`
- Added `sanitize_mcp_payload()` function to remove sensitive data and limit payload size
- Added `get_mcp_audit_context()` to collect all MCP-specific audit fields
- Context stored in `g.mcp_audit_context` for event logger pickup
- Graceful fallback when event_logger not available (testing/dev environments)

**Result:** All MCP tool calls now have distinct audit entries with MCP-specific context, making them easily identifiable and trackable in audit logs while maintaining existing SQLAlchemy event capture.
