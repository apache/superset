# MCP Service Demo Script for Claude Desktop

This is a safe, read-only demo script to showcase the MCP service capabilities. Run these commands in sequence in Claude Desktop.

## Prerequisites
- Ensure Superset is running locally on port 8088
- MCP service should be running on port 5008
- You should have some sample data loaded

## Demo Script

### 1. Check Instance Health
```
First, let's verify the Superset instance is running and get some basic stats:

Use the get_superset_instance_info tool
```

### 2. List Available Datasets
```
Now let's see what datasets are available:

Use the list_datasets tool with these parameters:
- page: 1
- page_size: 5
```

### 3. Get Dataset Details
```
Pick a dataset ID from the list above and get detailed information:

Use the get_dataset_info tool with:
- dataset_id: [ID from previous list]
```

### 4. List Dashboards
```
Let's explore existing dashboards:

Use the list_dashboards tool with:
- page: 1
- page_size: 5
```

### 5. Get Dashboard Details
```
Get details about a specific dashboard:

Use the get_dashboard_info tool with:
- dashboard_id: [ID from dashboard list]
```

### 6. List Charts with Filters
```
Let's see charts, filtered by a specific dataset:

Use the list_charts tool with:
- page: 1
- page_size: 5
- filters: {"datasource_id": [dataset_id from step 3]}
```

### 7. Get Chart Preview
```
Get a visual preview of a chart:

Use the get_chart_preview tool with:
- chart_id: [ID from chart list]
- format: "url"
```

### 8. Generate Explore Link
```
Create a custom explore link for data analysis:

Use the generate_explore_link tool with:
- dataset_id: [ID from step 2]
- metrics: ["COUNT(*)"]
- dimensions: ["[column_name from dataset info]"]
- time_range: "Last week"
```

### 9. Check Available Filters
```
See what filtering options are available for datasets:

Use the get_dataset_available_filters tool
```

### 10. Advanced Dataset Search
```
Search for datasets with specific criteria:

Use the list_datasets tool with:
- page: 1
- page_size: 10
- filters: {
    "database_name": {"operator": "contains", "value": "examples"},
    "table_name": {"operator": "contains", "value": "sales"}
  }
- sort_by: "changed_on_delta_humanized"
- sort_desc: true
```

## Expected Results

Each command should return:
- ✅ Structured JSON responses with detailed information
- ✅ Preview URLs for charts (viewable in browser)
- ✅ Metadata about relationships between entities
- ✅ Human-readable timestamps and descriptions

## Safety Notes

- All operations in this demo are **read-only**
- No data is modified or created
- Preview URLs expire after cache timeout
- Filters validate column names to prevent errors

## Troubleshooting

If you get errors:
1. Verify Superset is running: `curl http://localhost:8088/health`
2. Check MCP service is running on port 5008
3. Ensure you have datasets loaded in Superset
4. Use valid IDs from the list responses

## Advanced Demo (Optional)

For a more advanced demo showing chart generation capabilities:

```
Create a simple table chart:

Use the generate_chart tool with:
- dataset_id: [valid dataset ID]
- config: {
    "chart_type": "table",
    "columns": [
      {"name": "[column1_name]"},
      {"name": "[column2_name]", "aggregate": "COUNT"}
    ]
  }
- chart_name: "Demo Table Chart"
- save_chart: false
- generate_preview: true
- preview_formats: ["table", "url"]
```

This will generate a preview without saving the chart to the database.
