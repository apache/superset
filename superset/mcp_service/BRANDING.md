# MCP Service Branding Configuration

This document explains how to customize the branding of the Superset MCP service for white-labeled or enterprise deployments.

## Overview

The MCP service supports customizable branding to allow deployments to present their own product name and server identity to AI clients. This is useful for:

- **Enterprise deployments**: Show custom company branding instead of "Apache Superset"
- **White-label deployments**: Use custom product names for OEM partners
- **Multi-tenant deployments**: Different branding per tenant or customer

## Configuration Options

Add these to your `superset_config.py`:

```python
# MCP Service Branding
MCP_SERVICE_NAME = "ACME Analytics MCP Server"  # Server name shown to AI clients
MCP_SERVICE_BRANDING = "ACME Analytics"  # Product name used in LLM instructions
```

### MCP_SERVICE_NAME

**Type**: `str`
**Default**: `"Superset MCP Server"`

The display name of the MCP server as shown to AI clients and in server listings.

**Examples**:
- `"ACME Analytics MCP Server"` - For ACME Corp deployment
- `"Enterprise BI Server"` - Generic enterprise branding
- `"DataViz Platform MCP"` - Custom platform name

### MCP_SERVICE_BRANDING

**Type**: `str`
**Default**: `"Apache Superset"`

The product name used throughout LLM instructions and documentation. This replaces "Apache Superset" in all default instructions sent to AI assistants.

**Examples**:
- `"ACME Analytics"` - For ACME Corp platform
- `"Enterprise BI"` - Generic enterprise branding
- `"DataViz Platform"` - Custom platform branding

## How It Works

### 1. Server Name (MCP_SERVICE_NAME)

The server name is used in:
- MCP server registration with AI clients
- Server discovery and listing
- Claude Desktop configuration

**Before** (default):
```json
{
  "mcpServers": {
    "Superset MCP Server": {
      "command": "superset",
      "args": ["mcp", "run"]
    }
  }
}
```

**After** (with `MCP_SERVICE_NAME = "ACME Analytics MCP Server"`):
```json
{
  "mcpServers": {
    "ACME Analytics MCP Server": {
      "command": "superset",
      "args": ["mcp", "run"]
    }
  }
}
```

### 2. LLM Instructions (MCP_SERVICE_BRANDING)

The branding name is used in:
- Default instructions sent to AI assistants
- Tool descriptions and documentation
- Error messages and responses

**Before** (default):
```
You are connected to the Apache Superset MCP (Model Context Protocol) service.
This service provides programmatic access to Apache Superset dashboards, charts, datasets,
SQL Lab, and instance metadata via a comprehensive set of tools.
```

**After** (with `MCP_SERVICE_BRANDING = "ACME Analytics"`):
```
You are connected to the ACME Analytics MCP (Model Context Protocol) service.
This service provides programmatic access to ACME Analytics dashboards, charts, datasets,
SQL Lab, and instance metadata via a comprehensive set of tools.
```

## Example Configurations

### Enterprise Deployment

```python
# superset_config.py
MCP_SERVICE_NAME = "ACME Analytics MCP Server"
MCP_SERVICE_BRANDING = "ACME Analytics"
```

### White-Label/OEM Deployment

```python
# superset_config.py
MCP_SERVICE_NAME = "DataViz Platform MCP Server"
MCP_SERVICE_BRANDING = "DataViz Platform"
```

### Keep Apache Superset Branding (Default)

```python
# superset_config.py
# No configuration needed - defaults to Apache Superset
# MCP_SERVICE_NAME = "Superset MCP Server"  # default
# MCP_SERVICE_BRANDING = "Apache Superset"  # default
```

## Advanced: Custom Instructions

If you need complete control over LLM instructions beyond just branding, you can provide a custom instructions string:

```python
# superset_config.py
def get_custom_instructions():
    return """
    You are connected to the Acme Corp Analytics Platform MCP service.

    This is a custom deployment with specific features:
    - Custom dashboards
    - Enterprise-grade security
    - Multi-tenant support

    Available tools:
    [... custom tool documentation ...]
    """

# Pass to MCP server initialization
# (This is an advanced use case - most deployments should use MCP_SERVICE_BRANDING)
```

## Testing Branding Configuration

1. **Set configuration** in `superset_config.py`:
   ```python
   MCP_SERVICE_NAME = "My Custom MCP Server"
   MCP_SERVICE_BRANDING = "My Product"
   ```

2. **Restart the MCP service**:
   ```bash
   superset mcp run --port 5008
   ```

3. **Verify branding** appears correctly:
   - Check server name in Claude Desktop or MCP client
   - Send a test query and verify instructions mention your product name
   - Check tool descriptions use your branding

## Implementation Details

### Code Location

- **Configuration**: `superset/mcp_service/mcp_config.py`
- **Instructions Generation**: `superset/mcp_service/app.py` - `get_default_instructions()`
- **Server Initialization**: `superset/mcp_service/app.py` - `init_fastmcp_server()`

### Backwards Compatibility

The default values ensure existing deployments continue to work without changes:
- Default `MCP_SERVICE_NAME`: `"Superset MCP Server"`
- Default `MCP_SERVICE_BRANDING`: `"Apache Superset"`

### Extension Points

For advanced customization beyond branding:
- Override `DEFAULT_INSTRUCTIONS` completely
- Provide custom `instructions` parameter to `init_fastmcp_server()`
- Implement custom instruction generation logic

## Best Practices

1. **Consistency**: Use the same branding name across all configuration
2. **Clarity**: Choose names that clearly identify the service to AI clients
3. **Simplicity**: Avoid overly long or complex names
4. **Testing**: Always test branding changes with an actual AI client
5. **Documentation**: Document your custom branding in your deployment docs

## Troubleshooting

### Branding Not Applied

**Problem**: Custom branding doesn't appear after configuration.

**Solution**:
1. Verify `superset_config.py` is being loaded
2. Restart the MCP service completely
3. Check logs for configuration loading
4. Ensure no typos in configuration keys

### Instructions Still Show Default Branding

**Problem**: LLM instructions still mention "Apache Superset".

**Solution**:
1. Check `MCP_SERVICE_BRANDING` is set correctly
2. Verify `get_default_instructions()` is being called
3. Clear any cached instructions
4. Restart AI client (Claude Desktop, etc.)

## Support

For issues or questions about branding configuration:
- Open an issue on GitHub
- Check Superset documentation
- Contact your deployment administrator
