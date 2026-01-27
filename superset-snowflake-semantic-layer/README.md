# Snowflake Semantic Layer Extension for Apache Superset

This extension adds support for Snowflake Semantic Views to Apache Superset.

## Installation

### As a pip package

```bash
pip install superset-snowflake-semantic-layer
```

### As a Superset extension (.supx bundle)

1. Build the extension bundle:
   ```bash
   cd superset-snowflake-semantic-layer
   superset-extensions bundle
   ```

2. Copy the generated `.supx` file to your Superset extensions directory.

3. Configure Superset to load extensions:
   ```python
   # superset_config.py
   EXTENSIONS_PATH = "/path/to/extensions"
   ```

## Configuration

When adding a Snowflake Semantic Layer in Superset, you'll need to provide:

- **Account Identifier**: Your Snowflake account identifier (e.g., `abc12345`)
- **Authentication**: Either username/password or private key authentication
- **Role** (optional): The default Snowflake role to use
- **Warehouse** (optional): The default warehouse to use
- **Database** (optional): The default database containing semantic views
- **Schema** (optional): The default schema containing semantic views

## Features

- Browse and query Snowflake Semantic Views
- Support for dimensions and metrics defined in semantic views
- Filtering and aggregation through the Superset UI
- Group limiting (top N) with optional "Other" grouping

## Requirements

- Apache Superset 4.0+
- Snowflake account with semantic views
- `snowflake-connector-python` >= 3.0.0
