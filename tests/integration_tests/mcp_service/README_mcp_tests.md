# Superset MCP Integration Tests

This directory contains integration tests for the Superset Model Context Protocol (MCP) service. These tests exercise all FastMCP tools for dashboards, charts, and instance metadata, ensuring correct behavior and robust schema contracts.

## Contents
- `run_mcp_tests.py`: Main integration test runner for all MCP tools
- `test_get_dashboard_info.py`: Tests for the `get_dashboard_info` tool
- `test_get_dashboard_list_tools.py`: Tests for dashboard listing tools

## Usage
- Ensure the MCP service is running (see `superset/mcp_service/README.md`)
- Run tests with: `python run_mcp_tests.py`

## Coverage
- All listing, info, and filter tools are covered
- Tests validate both Pydantic and dict responses
- See the main MCP README and architecture docs for tool and flow details

For more on the MCP service, see `superset/mcp_service/README.md` and `superset/mcp_service/README_ARCHITECTURE.md`. 