<!--
Licensed to the Apache Software Foundation (ASF) under one
or more contributor license agreements.  See the NOTICE file
distributed with this work for additional information
regarding copyright ownership.  The ASF licenses this file
to you under the Apache License, Version 2.0 (the
"License"); you may not use this file except in compliance
with the License.  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing,
software distributed under the License is distributed on an
"AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, either express or implied.  See the License for the
specific language governing permissions and limitations
under the License.
-->

# Tool Search Optimization for Superset MCP Service

This guide explains how to optimize context usage when connecting to Superset's MCP service using Anthropic's Tool Search Tool feature.

## Overview

Superset's MCP service provides 21 tools across various categories. Loading all tool definitions upfront can consume significant context tokens (~15-20K tokens). The Tool Search Tool feature allows Claude to dynamically discover tools on-demand, reducing initial context overhead by up to 85%.

## Tool Categories

Superset MCP tools are categorized with tags to help clients configure optimal loading strategies:

| Tag | Description | Tools | Recommended Strategy |
|-----|-------------|-------|---------------------|
| `core` | Essential discovery and health tools | `health_check`, `get_instance_info`, `list_charts`, `list_dashboards`, `list_datasets` | Always load |
| `discovery` | Detailed resource information | `get_chart_info`, `get_chart_available_filters`, `get_dashboard_info`, `get_dashboard_available_filters`, `get_dataset_info`, `get_dataset_available_filters` | Can defer |
| `data` | Data retrieval and previews | `get_chart_preview`, `get_chart_data` | Defer |
| `mutate` | Create/modify resources | `generate_chart`, `update_chart`, `update_chart_preview`, `generate_dashboard`, `add_chart_to_existing_dashboard`, `execute_sql` | Defer |
| `explore` | URL generation for exploration | `generate_explore_link`, `open_sql_lab_with_context` | Defer |

## Client Configuration

### Claude API Configuration

When calling the Claude API with Superset MCP tools, configure `defer_loading` based on tool categories:

```json
{
  "type": "mcp_toolset",
  "mcp_server_name": "superset",
  "default_config": {"defer_loading": true},
  "configs": {
    "health_check": {"defer_loading": false},
    "get_instance_info": {"defer_loading": false},
    "list_charts": {"defer_loading": false},
    "list_dashboards": {"defer_loading": false},
    "list_datasets": {"defer_loading": false}
  }
}
```

This configuration:
- **Always loads** the 5 core tools (~4-5K tokens)
- **Defers** the remaining 16 tools until needed
- Reduces initial context from ~15-20K tokens to ~4-5K tokens

### Claude Desktop Configuration

For Claude Desktop (`claude_desktop_config.json`), add the Superset MCP server with defer_loading:

```json
{
  "mcpServers": {
    "superset": {
      "command": "npx",
      "args": ["@superset/mcp-server", "--stdio"],
      "env": {
        "SUPERSET_URL": "http://localhost:8088",
        "SUPERSET_ACCESS_TOKEN": "your-token"
      },
      "toolConfig": {
        "default": {"defer_loading": true},
        "overrides": {
          "health_check": {"defer_loading": false},
          "get_instance_info": {"defer_loading": false},
          "list_charts": {"defer_loading": false},
          "list_dashboards": {"defer_loading": false},
          "list_datasets": {"defer_loading": false}
        }
      }
    }
  }
}
```

## Token Savings Estimates

| Configuration | Estimated Initial Tokens | Savings |
|--------------|-------------------------|---------|
| All tools loaded | ~15-20K | Baseline |
| Core only + defer | ~4-5K | ~75% reduction |
| Minimal (health only) | ~500 | ~97% reduction |

## How It Works

1. **Initial Load**: Only `core` tagged tools are loaded when the session starts
2. **On-Demand Discovery**: When Claude needs a deferred tool (e.g., user asks to "create a chart"), it searches for and loads the relevant tool
3. **Context Preservation**: Deferred tools are only loaded into context when actually needed

## Usage Patterns

### Common Workflows

**Data Exploration Flow** (loads progressively):
1. `list_datasets` (core, always loaded)
2. `get_dataset_info` (discovery, loaded on-demand)
3. `generate_explore_link` (explore, loaded on-demand)

**Chart Creation Flow** (loads progressively):
1. `list_datasets` (core, always loaded)
2. `get_dataset_info` (discovery, loaded on-demand)
3. `generate_chart` (mutate, loaded on-demand)
4. `get_chart_preview` (data, loaded on-demand)

**Dashboard Building Flow** (loads progressively):
1. `list_charts` (core, always loaded)
2. `generate_dashboard` (mutate, loaded on-demand)

## Best Practices

1. **Always keep core tools loaded**: These are used in nearly every session
2. **Defer mutate tools**: These are only needed when explicitly creating/modifying resources
3. **Defer data tools**: Preview/data retrieval is typically after initial exploration
4. **Monitor token usage**: Track your actual usage patterns and adjust accordingly

## References

- [Anthropic Tool Search Tool Documentation](https://www.anthropic.com/engineering/advanced-tool-use)
- [MCP Protocol Specification](https://modelcontextprotocol.io/)
- [Superset MCP Service Documentation](../CLAUDE.md)
