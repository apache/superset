# Superset MCP Service – Phase 1 Status Update

## Background
The Model Context Protocol (MCP) is a new protocol for exposing high-level, structured actions in Superset, designed for LLM agents and automation. Phase 1 delivers a foundational, extensible MCP service in Superset, leveraging internal APIs (DAOs/commands) and providing a versioned, developer-friendly interface for both Apache and Preset use cases. ([SIP-171](https://github.com/apache/superset/issues/33870))

## Phase 1 Objectives (from SoW/SIP-171)
- Standalone MCP service, config flag, CLI, modular, stateless
- Strong typing: all actions use DAOs/commands and Pydantic schemas
- Clear extension points for Preset-specific auth, RBAC, and logging
- 3+ high-value MCP actions (list, info, mutation)
- Developer experience: easy to run, clear docs, tests
- Auth/RBAC/logging hooks stubbed, ready for enterprise
- Out of scope: full RBAC, impersonation, logging, external identity provider integration

## What’s Delivered (Phase 1)
- **Service infrastructure**: ASGI-based FastMCP server, config flag, CLI (`superset mcp run`), stateless
- **Strong typing**: All tool input/output uses Pydantic v2 models with field descriptions
- **Modular tools**: Grouped by domain (`dashboard/`, `dataset/`, `chart/`, `system/`), shared abstractions in `model_tools.py` and `middleware.py`
- **Abstracted, reusable tools**: List, info, and available filters tools are now abstracted and reusable across datasets, charts, and dashboards
- **Tool registration**: All tool functions use `@mcp.tool` and `@mcp_auth_hook` decorators for registration and auth (no more add_tool); DAOs/commands imported inside function body
- **DAO wrapper removed**: The old dao wrapper has been removed for clarity and maintainability
- **Auth/RBAC/logging hooks**: Stubbed in `auth.py` and `middleware.py`, admin mode by default, ready for extension
- **Extension points**: Documented and ready for Preset/enterprise
- **Core actions implemented**:
  - `list_dashboards`, `list_datasets` (now returns columns and metrics), `list_charts`
  - `get_dashboard_info`, `get_dataset_info` (now returns columns and metrics), `get_chart_info`
  - `get_dashboard_available_filters`, `get_dataset_available_filters`, `get_chart_available_filters`
  - `create_chart_simple` (PoC for mutation)
  - `create_chart` (advanced ECharts chart creation, supports stack, area, smooth, show_value, color_scheme, legend_type, legend_orientation, tooltip_sorting, y_axis_format, y_axis_bounds, x_axis_time_format, rich_tooltip, extra_options)
  - `get_superset_instance_info`
- **Tests**: Unit and integration tests for all core tools, with improved coverage and best practices. Dataset and chart tools now have tests verifying advanced ECharts options and extra_options are included in responses.
- **Docs**: Architecture, schemas, and dev guides up to date
- **Tool module reorganization**: Modules have been reorganized for clarity and maintainability
- **Chart creation tool modeling**: Progress on modeling chart creation tool input parameters for flexibility and LLM-friendliness

## What’s Next / Planned
- **Primary focus: chart_create tool**
  - Design and implement a robust chart creation tool
  - Explore how prompt engineering can guide chart creation (e.g., mapping user intent to chart config)
  - Integrate prompt injection prevention from the start
  - Support creating a chart and navigating the user to Explore with the settings (without saving the chart)
  - Investigate backend rendering of charts for previews or agent feedback
  - Add mutation tools for iterating on charts, dashboards, datasets, etc. (e.g., update, refine, clone)
- More advanced mutations (create/update/delete)
- Navigation tools (e.g., generate_explore_link, open_sql_lab_with_context)
- Full RBAC, impersonation, logging (stubbed only in Phase 1)
- Preset/enterprise integration (hooks ready)

## Summary Table
| SoW Objective/Deliverable                | Status (Phase 1)                |
|------------------------------------------|---------------------------------|
| Standalone MCP service, config flag, CLI | ✅ Delivered                    |
| Modular, typed schemas                   | ✅ Delivered                    |
| Abstracted, reusable list/info/filter tools | ✅ Delivered                 |
| 3+ core actions (list/count)             | ✅ Delivered                    |
| Mutations (create/update)                | 🟡 PoC for chart creation       |
| Navigation actions                       | 🟡 Planned                     |
| Auth/RBAC hooks (stubbed)                | ✅ Delivered                    |
| Documentation & dev guide                | ✅ Delivered                    |
| Preset extension points                  | ✅ Delivered                    |
| Demo script/notebook                     | 🟡 Not in OSS, easy to run/tests|

## Reference
- [SIP-171: MCP Service Proposal](https://github.com/apache/superset/issues/33870) 