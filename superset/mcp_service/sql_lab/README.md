# SQL Lab MCP Tools

This directory contains MCP tools for interacting with Superset's SQL Lab functionality.

## Available Tools

### 1. `execute_sql`

Execute SQL queries directly against Superset databases with full security validation.

**Features:**
- Direct SQL execution with results
- Security validation (RLS, permissions, disallowed functions)
- Query timeout protection
- Result size limits
- Support for both SELECT and DML operations (when allowed)
- Parameter substitution

**Request Parameters:**
- `database_id` (required): Database connection ID
- `sql` (required): SQL query to execute
- `schema` (optional): Schema name
- `limit` (optional): Result row limit (default: 1000, max: 10000)
- `timeout` (optional): Query timeout in seconds (default: 30, max: 300)
- `parameters` (optional): Dictionary of parameters for query substitution

**Response Fields:**
- `success`: Whether query executed successfully
- `rows`: Query results as list of dictionaries
- `columns`: Column metadata (name, type, nullable)
- `row_count`: Number of rows returned
- `affected_rows`: Number of rows affected (for DML)
- `execution_time`: Query execution time in seconds
- `error`: Error message if failed
- `error_type`: Type of error (SECURITY_ERROR, TIMEOUT, etc.)

**Example Usage:**
```python
# Simple SELECT query
request = {
    "database_id": 1,
    "sql": "SELECT id, name FROM users LIMIT 10",
    "schema": "public"
}

# Query with parameters
request = {
    "database_id": 1,
    "sql": "SELECT * FROM {table} WHERE status = '{status}'",
    "parameters": {
        "table": "orders",
        "status": "active"
    },
    "limit": 100
}

# DML operation (requires database.allow_dml = True)
request = {
    "database_id": 1,
    "sql": "UPDATE users SET last_login = NOW() WHERE id = 123"
}
```

### 2. `open_sql_lab_with_context`

Generate a URL to open SQL Lab with pre-populated context.

**Features:**
- Pre-populate database connection
- Set default schema
- Add dataset context
- Pre-fill SQL query
- Set query title

**Request Parameters:**
- `database_connection_id` (required): Database ID
- `schema` (optional): Default schema
- `dataset_in_context` (optional): Dataset/table name
- `sql` (optional): SQL query to pre-populate
- `title` (optional): Query title

**Response Fields:**
- `url`: Generated SQL Lab URL
- `database_id`: Database ID used
- `schema`: Schema selected
- `title`: Query title
- `error`: Error message if failed

## Security Considerations

All tools respect Superset's security model:
- Database access permissions are validated
- Row Level Security (RLS) is applied when enabled
- Disallowed SQL functions are blocked
- DML operations respect database `allow_dml` setting
- Query timeouts are enforced
- Result sizes are limited

## Error Handling

Tools return structured error responses with:
- `error`: Human-readable error message
- `error_type`: Machine-readable error category
  - `SECURITY_ERROR`: Permission denied
  - `DISALLOWED_FUNCTION`: Blocked SQL function
  - `DML_NOT_ALLOWED`: DML on read-only database
  - `TIMEOUT`: Query exceeded timeout
  - `EXECUTION_ERROR`: General execution failure
