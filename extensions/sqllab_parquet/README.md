# SQL Lab Parquet Export Extension

This Apache Superset extension enables users to export SQL Lab query results directly to Parquet format.

## Features

- Export query results to Parquet with a single click
- Uses Snappy compression for optimal file size and performance
- Automatic filename generation with timestamp
- Handles various data types including dates and null values

## Installation

### Build the Extension

```bash
cd extensions/sqllab_parquet/frontend
npm install
npm run build
```

### Configure Superset

Add the following to your `superset_config.py`:

```python
# Enable extensions feature
FEATURE_FLAGS = {"ENABLE_EXTENSIONS": True}

# For development (load from filesystem):
LOCAL_EXTENSIONS = ["/path/to/extensions/sqllab_parquet"]

# For production (load from bundled .supx files):
# EXTENSIONS_PATH = "/path/to/extensions/"
```

### Restart Superset

After configuration, restart your Superset instance for the extension to load.

## Usage

1. Open SQL Lab and write a query
2. Run the query to see results
3. Click the three-dot menu (secondary actions) in the editor toolbar
4. Select "Export to Parquet"
5. The Parquet file will download automatically

## Requirements

- Apache Superset with Extensions support enabled
- Python packages: `pyarrow>=10.0.0`, `pandas>=1.0.0`

## License

Apache License 2.0
