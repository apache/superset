# POC Test Plan

Simple test plan with 5 tool calls to demonstrate MCP functionality.

## Test Cases

Test: Get Superset Instance Info
```
Use the get_superset_instance_info tool to get basic information about this Superset instance.
```

Test: List First 3 Datasets
```
Use the list_datasets tool with page_size=3 to show the first 3 datasets available.
```

Test: List First 2 Charts
```
Use the list_charts tool with page_size=2 to show the first 2 charts.
```

Test: List First Dashboard
```
Use the list_dashboards tool with page_size=1 to show one dashboard.
```

Test: Get Dataset Info
```
Use the get_dataset_info tool with dataset_id=1 to get detailed information about dataset ID 1.
```
