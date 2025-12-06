# Adding Example Datasets to Superset

## Quick Start

To add a new example dataset:

1. **Add your DuckDB file** to this directory (`superset/examples/data/`)
   - Name it descriptively: `your_dataset.duckdb`
   - The table inside should match the filename (without .duckdb)

2. **That's it!** The dataset will be auto-discovered and loaded when running:
   ```bash
   superset load-examples
   ```

## DuckDB File Structure

Each `.duckdb` file should contain a single table with the same name as the file:
- File: `sales_data.duckdb`
- Table inside: `sales_data`

## Creating a DuckDB File

From a CSV:
```python
import duckdb
import pandas as pd

# Read your data
df = pd.read_csv("your_data.csv")

# Create DuckDB file
conn = duckdb.connect("your_dataset.duckdb")
conn.execute("CREATE TABLE your_dataset AS SELECT * FROM df")
conn.close()
```

From a DataFrame:
```python
import duckdb

conn = duckdb.connect("your_dataset.duckdb")
conn.execute("CREATE TABLE your_dataset AS SELECT * FROM your_dataframe")
conn.close()
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

For datasets requiring special processing (like creating dashboards or slices), create a custom loader in `superset/examples/your_dataset.py`. See `birth_names.py` for an example.

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
- Consider compression within DuckDB

## Removing a Dataset

Simply delete the `.duckdb` file from this directory. No other changes needed!
