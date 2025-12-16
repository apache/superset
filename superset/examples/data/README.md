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

# Adding Example Datasets to Superset

## Quick Start

To add a new example dataset:

1. **Add your Parquet file** to this directory (`superset/examples/data/`)
   - Name it descriptively: `your_dataset.parquet`

2. **That's it!** The dataset will be auto-discovered and loaded when running:
   ```bash
   superset load-examples
   ```

## CLI Loading Options

The `superset load-examples` command supports several flags for different use cases:

- **`--force` / `-f`**: Force reload data even if tables already exist
- **`--only-metadata` / `-m`**: Only create table metadata without loading actual data (fast setup)
- **`--load-test-data` / `-t`**: Include test-specific dashboards and datasets (*.test.yaml files)
- **`--load-big-data` / `-b`**: Generate synthetic stress-test data (wide tables, many tables)

## Why Parquet?

- **Apache-friendly**: Parquet is an Apache project, making it ideal for ASF projects
- **Compressed**: Parquet uses efficient columnar compression (Snappy by default)
- **Widely supported**: Compatible with pandas, pyarrow, DuckDB, Spark, and many other tools
- **Self-describing**: Schema is embedded in the file

## Creating a Parquet File

From a CSV:
```python
import pandas as pd

# Read your data
df = pd.read_csv("your_data.csv")

# Save as Parquet
df.to_parquet("your_dataset.parquet", compression="snappy", index=False)
```

From a DataFrame:
```python
your_dataframe.to_parquet("your_dataset.parquet", compression="snappy", index=False)
```

## Custom Table Names

If your table name needs to differ from the filename, add an entry to `TABLE_NAME_OVERRIDES` in `superset/examples/data_loading.py`:

```python
TABLE_NAME_OVERRIDES = {
    "your_dataset": "Different_Table_Name",
    # ...
}
```

## Adding Descriptions

Add a description for better documentation in `DATASET_DESCRIPTIONS` in `superset/examples/data_loading.py`:

```python
DATASET_DESCRIPTIONS = {
    "your_dataset": "Description of your dataset",
    # ...
}
```

## Custom Loaders

For datasets requiring special processing (like creating dashboards or slices), create a custom loader. Custom loaders are used for:
- Creating example dashboards (`supported_charts_dashboard.py`, `tabbed_dashboard.py`)
- Loading CSS templates (`css_templates.py`)
- Generating synthetic test data (moved to `superset/cli/test_loaders.py`)

## Testing Your Dataset

```bash
# Load only your dataset (if it has a custom loader)
python -c "from superset.examples.data_loading import load_your_dataset; load_your_dataset()"

# Or load all examples
superset load-examples
```

## File Size Considerations

Keep datasets reasonably sized for demo purposes:
- Aim for < 10MB per file
- Use sampling for large datasets
- Parquet compression helps reduce file sizes significantly

## Removing a Dataset

Simply delete the `.parquet` file from this directory. No other changes needed!
