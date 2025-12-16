#  Licensed to the Apache Software Foundation (ASF) under one
#  or more contributor license agreements.  See the NOTICE file
#  distributed with this work for additional information
#  regarding copyright ownership.  The ASF licenses this file
#  to you under the Apache License, Version 2.0 (the
#  "License"); you may not use this file except in compliance
#  with the License.  You may obtain a copy of the License at
#
#  http://www.apache.org/licenses/LICENSE-2.0
#
#  Unless required by applicable law or agreed to in writing,
#  software distributed under the License is distributed on an
#  "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
#  KIND, either express or implied.  See the License for the
#  specific language governing permissions and limitations
#  under the License.
"""Auto-discover and load example datasets from DuckDB files."""

from pathlib import Path
from typing import Callable, Dict

# Import loaders that have custom logic (dashboards, CSS, etc.)
from superset.cli.test_loaders import load_big_data

from .css_templates import load_css_templates

# Import generic loader for DuckDB datasets
from .generic_loader import create_generic_loader
from .supported_charts_dashboard import load_supported_charts_dashboard
from .tabbed_dashboard import load_tabbed_dashboard
from .utils import load_examples_from_configs

# Map of DuckDB files to their table names (if different from file name)
TABLE_NAME_OVERRIDES = {
    "energy": "energy_usage",  # Legacy table name expected by tests
    "fcc_2018_survey": "FCC 2018 Survey",
    "sf_population": "sf_population_polygons",
}

# Dataset descriptions for documentation
DATASET_DESCRIPTIONS = {
    "airports": "Airport locations data",
    "bart_lines": "BART transit lines",
    "big_data": "Synthetic big data for testing",
    "birth_france": "France birth data",
    "birth_france_by_region": "France birth data by region",
    "birth_names": "US birth names over time",
    "channel_members": "Slack channel membership data",
    "channels": "Slack channels data",
    "cleaned_sales_data": "Cleaned sales data",
    "countries": "World Bank country statistics",
    "covid_vaccines": "COVID-19 vaccine development data",
    "energy": "Energy usage/flow data (loads as energy_usage table)",
    "exported_stats": "Exported statistics data",
    "fcc_2018_survey": "FCC 2018 Developer Survey",
    "flights": "Flight delays data",
    "long_lat": "Random lat/long points",
    "messages": "Slack messages data",
    "multiformat_time_series": "Time series data in multiple formats",
    "paris_iris": "Paris IRIS geographic data",
    "random_time_series": "Random time series data",
    "san_francisco": "San Francisco addresses",
    "sf_population": "San Francisco population by area",
    "sf_population_polygons": "San Francisco population polygons",
    "threads": "Slack threads data",
    "unicode_test": "Unicode test data",
    "users": "Slack users data",
    "users_channels": "Slack user-channel relationships",
    "video_game_sales": "Video game sales data",
    "wb_health_population": "World Bank health and population data",
}


def get_data_directory() -> Path:
    """Get the path to the data directory."""
    from .helpers import get_examples_folder

    return Path(get_examples_folder()) / "data"


def discover_datasets() -> Dict[str, Callable[..., None]]:
    """Auto-discover all DuckDB files and create loaders for them."""
    loaders: Dict[str, Callable[..., None]] = {}
    data_dir = get_data_directory()

    if not data_dir.exists():
        return loaders

    # Discover all .duckdb files
    for duckdb_file in sorted(data_dir.glob("*.duckdb")):
        dataset_name = duckdb_file.stem

        # Determine table name
        table_name = TABLE_NAME_OVERRIDES.get(dataset_name, dataset_name)

        # Get description
        description = DATASET_DESCRIPTIONS.get(
            dataset_name, f"{dataset_name.replace('_', ' ').title()} dataset"
        )

        # Create loader function
        loader_name = f"load_{dataset_name}"
        loaders[loader_name] = create_generic_loader(
            dataset_name,
            table_name=table_name if table_name != dataset_name else None,
            description=description,
        )

    return loaders


# Auto-discover and create all dataset loaders
_auto_loaders = discover_datasets()

# Add auto-discovered loaders to module namespace
globals().update(_auto_loaders)

# Build __all__ list dynamically
__all__ = [
    # Custom loaders (always included)
    "load_big_data",
    "load_css_templates",
    "load_supported_charts_dashboard",
    "load_tabbed_dashboard",
    "load_examples_from_configs",
    # Auto-discovered loaders
    *sorted(_auto_loaders.keys()),
]
