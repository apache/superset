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

# Superset Example Datasets

This directory contains example datasets, charts, and dashboards that are loaded
when running `superset load-examples`.

## Directory Structure

Each example is organized in its own directory with data and configuration together:

```
superset/examples/
├── _shared/                    # Shared configuration for all examples
│   ├── database.yaml          # Database connection (examples database)
│   └── metadata.yaml          # Import metadata
├── birth_names/               # Example: US Birth Names
│   ├── data.parquet          # Dataset (Parquet format)
│   ├── dataset.yaml          # Dataset metadata & column definitions
│   ├── dashboard.yaml        # Dashboard layout (optional)
│   └── charts/               # Chart configurations (optional)
│       ├── Boys.yaml
│       ├── Girls.yaml
│       └── ...
├── energy_usage/              # Example: Energy Sankey diagram
│   ├── data.parquet
│   ├── dataset.yaml
│   └── charts/
└── ...
```

## Adding a New Example

### Quick Start (Data Only)

1. Create a directory for your example:
   ```bash
   mkdir superset/examples/my_dataset
   ```

2. Create your Parquet file:
   ```python
   import pandas as pd

   df = pd.read_csv("your_data.csv")
   df.to_parquet(
       "superset/examples/my_dataset/data.parquet",
       compression="snappy",
       index=False
   )
   ```

3. Run `superset load-examples` - your dataset will be auto-discovered!

### Complete Example (With Dashboard)

1. Create the directory structure:
   ```bash
   mkdir -p superset/examples/my_dataset/charts
   ```

2. Add your `data.parquet` file (see above)

3. Add `dataset.yaml` with column definitions:
   ```yaml
   table_name: my_dataset
   main_dttm_col: date_column
   description: Description of your dataset
   columns:
     - column_name: date_column
       is_dttm: true
     - column_name: value
       groupby: true
       filterable: true
   metrics:
     - metric_name: total_value
       expression: SUM(value)
   ```

4. Add `dashboard.yaml` and chart configs in `charts/`
   - Tip: Export an existing dashboard from Superset UI to get the YAML format

### Exporting from Superset UI

1. Create your dashboard in Superset
2. Go to Dashboards list → select your dashboard
3. Actions → Export
4. Unzip and copy the YAML files to your example directory
5. Add the `data.parquet` file

## CLI Options

```bash
superset load-examples              # Load all examples
superset load-examples --force      # Force reload (replace existing)
superset load-examples --only-metadata  # Fast: metadata only, no data
superset load-examples --load-test-data # Include test dashboards
```

## Why Parquet?

- **Apache-friendly**: Parquet is an Apache project
- **Compressed**: Snappy compression reduces size ~27%
- **Self-describing**: Schema embedded in file
- **Fast**: Columnar format enables efficient queries
- **Portable**: Works with pandas, pyarrow, DuckDB, Spark, etc.

## File Size Guidelines

- Keep datasets under 10MB for reasonable load times
- Use sampling for large datasets
- Parquet compression helps significantly

## Special Directories

- `_shared/`: Contains database and metadata configs shared by all examples
- Directories starting with `_` are skipped during auto-discovery
