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
"""Auto-discover and load example datasets from Parquet files."""

from pathlib import Path
from typing import Callable, Dict

# Import loaders that have custom logic (dashboards, CSS, etc.)
from superset.cli.test_loaders import load_big_data

from .css_templates import load_css_templates

# Import generic loader for Parquet datasets
from .generic_loader import create_generic_loader
from .supported_charts_dashboard import load_supported_charts_dashboard
from .tabbed_dashboard import load_tabbed_dashboard
from .utils import load_examples_from_configs

# Map of directory names to table names (when different from directory name)
TABLE_NAME_OVERRIDES = {
    "fcc_2018_survey": "FCC 2018 Survey",
}

# Dataset descriptions for documentation (auto-discovered datasets without YAML configs)
DATASET_DESCRIPTIONS = {
    "airports": "Airport locations data",
    "birth_france": "France birth data",
    "countries": "World Bank country statistics",
    "multiformat_time_series": "Time series data in multiple formats",
    "paris_iris": "Paris IRIS geographic data",
    "random_time_series": "Random time series data",
    "san_francisco": "San Francisco addresses",
}


def get_examples_directory() -> Path:
    """Get the path to the examples directory."""
    from .helpers import get_examples_folder

    return Path(get_examples_folder())


def discover_datasets() -> Dict[str, Callable[..., None]]:
    """Auto-discover all example datasets and create loaders for them.

    Examples are organized as:
        superset/examples/{example_name}/data.parquet           # Single dataset
        superset/examples/{example_name}/data/{name}.parquet    # Multiple datasets
    """
    loaders: Dict[str, Callable[..., None]] = {}
    examples_dir = get_examples_directory()

    if not examples_dir.exists():
        return loaders

    # Discover single data.parquet files (simple examples)
    for data_file in sorted(examples_dir.glob("*/data.parquet")):
        dataset_name = data_file.parent.name

        # Skip special directories
        if dataset_name.startswith("_"):
            continue

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

    # Discover multiple parquet files in data/ folders (complex examples)
    for data_file in sorted(examples_dir.glob("*/data/*.parquet")):
        dataset_name = data_file.stem  # filename without extension

        # Skip special directories
        if data_file.parent.parent.name.startswith("_"):
            continue

        # Determine table name
        table_name = TABLE_NAME_OVERRIDES.get(dataset_name, dataset_name)

        # Get description
        description = DATASET_DESCRIPTIONS.get(
            dataset_name, f"{dataset_name.replace('_', ' ').title()} dataset"
        )

        # Create loader function
        loader_name = f"load_{dataset_name}"
        if loader_name not in loaders:  # Don't override existing loaders
            loaders[loader_name] = create_generic_loader(
                dataset_name,
                table_name=table_name if table_name != dataset_name else None,
                description=description,
                data_file=data_file,  # Pass specific file path
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
    # Auto-discovered loaders (includes load_energy from energy.parquet)
    *sorted(_auto_loaders.keys()),
]
