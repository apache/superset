# Superset MCP Service: Tool Schemas Reference

This document provides a reference for the input and output parameters of all MCP tools in the Superset MCP service. Each section lists the tool name, its input parameters (with type), and its output schema.

## Dashboards

### list_dashboards

**Inputs:**
- `filters`: `Optional[List[DashboardFilter]]` — List of filter objects
- `columns`: `Optional[List[str]]` — Columns to include in the response
- `keys`: `Optional[List[str]]` — Keys to include in the response
- `order_column`: `Optional[str]` — Column to order results by
- `order_direction`: `Optional[Literal['asc', 'desc']]` — Order direction
- `page`: `int` — Page number (1-based)
- `page_size`: `int` — Number of items per page
- `select_columns`: `Optional[List[str]]` — Columns to select (overrides columns/keys)
- `search`: `Optional[str]` — Free-text search string

**Returns:** `DashboardList`
- `dashboards`: `List[DashboardInfo]`
- `count`: `int`
- `total_count`: `int`
- `page`: `int`
- `page_size`: `int`
- `total_pages`: `int`
- `has_previous`: `bool`
- `has_next`: `bool`
- `columns_requested`: `List[str]`
- `columns_loaded`: `List[str]`
- `filters_applied`: `Dict[str, Any]`
- `pagination`: `PaginationInfo`
- `timestamp`: `datetime`

### get_dashboard_info

**Inputs:**
- `dashboard_id`: `int` — Dashboard ID

**Returns:** `DashboardInfo` or `DashboardError`

**DashboardInfo:**
- `id`: `int`
- `dashboard_title`: `str`
- `slug`: `Optional[str]`
- `description`: `Optional[str]`
- `css`: `Optional[str]`
- `certified_by`: `Optional[str]`
- `certification_details`: `Optional[str]`
- `json_metadata`: `Optional[str]`
- `position_json`: `Optional[str]`
- `published`: `Optional[bool]`
- `is_managed_externally`: `Optional[bool]`
- `external_url`: `Optional[str]`
- `created_on`: `Optional[Union[str, datetime]]`
- `changed_on`: `Optional[Union[str, datetime]]`
- `created_by`: `Optional[str]`
- `changed_by`: `Optional[str]`
- `uuid`: `Optional[str]`
- `url`: `Optional[str]`
- `thumbnail_url`: `Optional[str]`
- `created_on_humanized`: `Optional[str]`
- `changed_on_humanized`: `Optional[str]`
- `chart_count`: `int`
- `owners`: `List[UserInfo]`
- `tags`: `List[TagInfo]`
- `roles`: `List[RoleInfo]`
- `charts`: `List[ChartInfo]`

**DashboardError:**
- `error`: `str`
- `error_type`: `str`
- `timestamp`: `Optional[Union[str, datetime]]`

### get_dashboard_available_filters

**Inputs:**
- (none)

**Returns:** `DashboardAvailableFilters`
- `filters`: `Dict[str, Any]`
- `operators`: `List[str]`
- `columns`: `List[str]`

## Datasets

### list_datasets

**Inputs:**
- `filters`: `Optional[List[DatasetFilter]]` — List of filter objects
- `columns`: `Optional[List[str]]` — Columns to include in the response
- `keys`: `Optional[List[str]]` — Keys to include in the response
- `order_column`: `Optional[str]` — Column to order results by
- `order_direction`: `Optional[Literal['asc', 'desc']]` — Order direction
- `page`: `int` — Page number (1-based)
- `page_size`: `int` — Number of items per page
- `select_columns`: `Optional[List[str]]` — Columns to select (overrides columns/keys)
- `search`: `Optional[str]` — Free-text search string

**Returns:** `DatasetList`
- `datasets`: `List[DatasetInfo]`
- `count`: `int`
- `total_count`: `int`
- `page`: `int`
- `page_size`: `int`
- `total_pages`: `int`
- `has_previous`: `bool`
- `has_next`: `bool`
- `columns_requested`: `List[str]`
- `columns_loaded`: `List[str]`
- `filters_applied`: `Dict[str, Any]`
- `pagination`: `PaginationInfo`
- `timestamp`: `datetime`

### list_datasets_simple

**Inputs:**
- `filters`: `Optional[DatasetSimpleFilters]` — Simple filter object
- `order_column`: `Optional[str]` — Column to order results by
- `order_direction`: `Literal['asc', 'desc']` — Order direction
- `page`: `int` — Page number (1-based)
- `page_size`: `int` — Number of items per page
- `search`: `Optional[str]` — Free-text search string

**Returns:** `DatasetList` (see above)

### get_dataset_info

**Inputs:**
- `dataset_id`: `int` — DatasetInfo ID

**Returns:** `DatasetInfoResponse` or `DatasetError`

**DatasetInfoResponse:**
- `id`: `int`
- `table_name`: `str`
- `db_schema`: `Optional[str]`
- `database_name`: `Optional[str]`
- `description`: `Optional[str]`
- `changed_by`: `Optional[str]`
- `changed_on`: `Optional[Union[str, datetime]]`
- `changed_on_humanized`: `Optional[str]`
- `created_by`: `Optional[str]`
- `created_on`: `Optional[Union[str, datetime]]`
- `created_on_humanized`: `Optional[str]`
- `tags`: `List[TagInfo]`
- `owners`: `List[UserInfo]`
- `is_virtual`: `Optional[bool]`
- `database_id`: `Optional[int]`
- `schema_perm`: `Optional[str]`
- `url`: `Optional[str]`
- `sql`: `Optional[str]`
- `main_dttm_col`: `Optional[str]`
- `offset`: `Optional[int]`
- `cache_timeout`: `Optional[int]`
- `params`: `Optional[Dict[str, Any]]`
- `template_params`: `Optional[Dict[str, Any]]`
- `extra`: `Optional[Dict[str, Any]]`

**DatasetError:**
- `error`: `str`
- `error_type`: `str`
- `timestamp`: `Optional[Union[str, datetime]]`

### get_dataset_available_filters

**Inputs:**
- (none)

**Returns:** `DatasetAvailableFilters`
- `filters`: `Dict[str, Any]`
- `operators`: `List[str]`
- `columns`: `List[str]`

## Charts

### list_charts

**Inputs:**
- `filters`: `Optional[List[ChartFilter]]` — List of filter objects
- `columns`: `Optional[List[str]]` — Columns to include in the response
- `keys`: `Optional[List[str]]` — Keys to include in the response
- `order_column`: `Optional[str]` — Column to order results by
- `order_direction`: `Optional[Literal['asc', 'desc']]` — Order direction
- `page`: `int` — Page number (1-based)
- `page_size`: `int` — Number of items per page
- `select_columns`: `Optional[List[str]]` — Columns to select (overrides columns/keys)
- `search`: `Optional[str]` — Free-text search string

**Returns:** `ChartList`
- `charts`: `List[ChartInfo]`
- `count`: `int`
- `total_count`: `int`
- `page`: `int`
- `page_size`: `int`
- `total_pages`: `int`
- `has_previous`: `bool`
- `has_next`: `bool`
- `columns_requested`: `List[str]`
- `columns_loaded`: `List[str]`
- `filters_applied`: `Dict[str, Any]`
- `pagination`: `PaginationInfo`
- `timestamp`: `datetime`

### get_chart_info

**Inputs:**
- `chart_id`: `int` — Chart ID

**Returns:** `ChartInfoResponse` or `ChartError`

**ChartInfoResponse:**
- `chart`: `ChartInfo`

**ChartError:**
- `error`: `str`
- `error_type`: `str`
- `timestamp`: `Optional[Union[str, datetime]]`

### get_chart_available_filters

**Inputs:**
- (none)

**Returns:** `ChartAvailableFiltersResponse`
- `filters`: `Dict[str, Any]`
- `operators`: `List[str]`
- `columns`: `List[str]`

### create_chart_simple

**Inputs:**
- `request`: `CreateSimpleChartRequest` — Chart creation request

**Returns:** `CreateSimpleChartResponse`
- `chart`: `Optional[ChartInfo]`
- `embed_url`: `Optional[str]`
- `thumbnail_url`: `Optional[str]`
- `embed_html`: `Optional[str]`
- `error`: `Optional[str]`

## System

### get_superset_instance_info

**Inputs:**
- (none)

**Returns:** `InstanceInfo`
- `instance_summary`: `InstanceSummary`
- `recent_activity`: `RecentActivity`
- `dashboard_breakdown`: `DashboardBreakdown`
- `database_breakdown`: `DatabaseBreakdown`
- `popular_content`: `PopularContent`
- `timestamp`: `datetime`

---

## Complex Type Definitions

### ChartFilter
- `col`: `Literal[ ... ]` (see allowed columns in code)
- `opr`: `Literal[ ... ]` (see allowed operators in code)
- `value`: `Any`

### ChartInfo
- `id`: `int`
- `slice_name`: `str`
- `viz_type`: `Optional[str]`
- `datasource_name`: `Optional[str]`
- `datasource_type`: `Optional[str]`
- `url`: `Optional[str]`
- `description`: `Optional[str]`
- `cache_timeout`: `Optional[int]`
- `form_data`: `Optional[Dict[str, Any]]`
- `query_context`: `Optional[Any]`
- `changed_by`: `Optional[str]`
- `changed_by_name`: `Optional[str]`
- `changed_on`: `Optional[Union[str, datetime]]`
- `changed_on_humanized`: `Optional[str]`
- `created_by`: `Optional[str]`
- `created_on`: `Optional[Union[str, datetime]]`
- `created_on_humanized`: `Optional[str]`
- `tags`: `List[TagInfo]`
- `owners`: `List[UserInfo]`

### PaginationInfo
- `page`: `int`
- `page_size`: `int`
- `total_count`: `int`
- `total_pages`: `int`
- `has_next`: `bool`
- `has_previous`: `bool`

### TagInfo
- `id`: `Optional[int]`
- `name`: `Optional[str]`
- `type`: `Optional[str]`
- `description`: `Optional[str]`

### UserInfo
- `id`: `Optional[int]`
- `username`: `Optional[str]`
- `first_name`: `Optional[str]`
- `last_name`: `Optional[str]`
- `email`: `Optional[str]`
- `active`: `Optional[bool]`

### RoleInfo
- `id`: `Optional[int]`
- `name`: `Optional[str]`
- `permissions`: `Optional[List[str]]`

### ChartInfo
- `id`: `Optional[int]`
- `slice_name`: `Optional[str]`
- `viz_type`: `Optional[str]`
- `datasource_name`: `Optional[str]`
- `datasource_type`: `Optional[str]`
- `url`: `Optional[str]`
- `description`: `Optional[str]`
- `cache_timeout`: `Optional[int]`
- `form_data`: `Optional[Dict[str, Any]]`
- `query_context`: `Optional[Any]`
- `created_by`: `Optional[UserInfo]`
- `changed_by`: `Optional[UserInfo]`
- `created_on`: `Optional[Union[str, datetime]]`
- `changed_on`: `Optional[Union[str, datetime]]`

### DashboardInfo
- `id`: `int`
- `dashboard_title`: `str`
- `slug`: `Optional[str]`
- `url`: `Optional[str]`
- `published`: `Optional[bool]`
- `changed_by`: `Optional[str]`
- `changed_by_name`: `Optional[str]`
- `changed_on`: `Optional[Union[str, datetime]]`
- `changed_on_humanized`: `Optional[str]`
- `created_by`: `Optional[str]`
- `created_on`: `Optional[Union[str, datetime]]`
- `created_on_humanized`: `Optional[str]`
- `tags`: `List[TagInfo]`
- `owners`: `List[UserInfo]`

### DatasetInfo
- `id`: `int`
- `table_name`: `str`
- `db_schema`: `Optional[str]`
- `database_name`: `Optional[str]`
- `description`: `Optional[str]`
- `changed_by`: `Optional[str]`
- `changed_by_name`: `Optional[str]`
- `changed_on`: `Optional[Union[str, datetime]]`
- `changed_on_humanized`: `Optional[str]`
- `created_by`: `Optional[str]`
- `created_on`: `Optional[Union[str, datetime]]`
- `created_on_humanized`: `Optional[str]`
- `tags`: `List[TagInfo]`
- `owners`: `List[UserInfo]`
- `is_virtual`: `Optional[bool]`
- `database_id`: `Optional[int]`
- `schema_perm`: `Optional[str]`
- `url`: `Optional[str]`

### DatasetFilter
- `col`: `Literal[ ... ]` (see allowed columns in code)
- `opr`: `Literal[ ... ]` (see allowed operators in code)
- `value`: `Any`

### CreateSimpleChartRequest
- `slice_name`: `str`
- `viz_type`: `str`
- `datasource_id`: `int`
- `datasource_type`: `Literal["table"]`
- `metrics`: `List[str]`
- `dimensions`: `List[str]`
- `filters`: `Optional[List[Dict[str, Any]]]`
- `description`: `Optional[str]`
- `owners`: `Optional[List[int]]`
- `dashboards`: `Optional[List[int]]`
- `return_embed`: `Optional[bool]`

### CreateSimpleChartResponse
- `chart`: `Optional[ChartInfo]`
- `embed_url`: `Optional[str]`
- `thumbnail_url`: `Optional[str]`
- `embed_html`: `Optional[str]`
- `error`: `Optional[str]`

### InstanceSummary
- `total_dashboards`: `int`
- `total_charts`: `int`
- `total_datasets`: `int`
- `total_databases`: `int`
- `total_users`: `int`
- `total_roles`: `int`
- `total_tags`: `int`
- `avg_charts_per_dashboard`: `float`

### RecentActivity
- `dashboards_created_last_30_days`: `int`
- `charts_created_last_30_days`: `int`
- `datasets_created_last_30_days`: `int`
- `dashboards_modified_last_7_days`: `int`
- `charts_modified_last_7_days`: `int`
- `datasets_modified_last_7_days`: `int`

### DashboardBreakdown
- `published`: `int`
- `unpublished`: `int`
- `certified`: `int`
- `with_charts`: `int`
- `without_charts`: `int`

### DatabaseBreakdown
- `by_type`: `Dict[str, int]`

### PopularContent
- `top_tags`: `List[str]`
- `top_creators`: `List[str]` 
