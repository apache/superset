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
from typing import Callable, Dict, Optional

import yaml

# Import loaders that have custom logic (dashboards, CSS, etc.)
from superset.cli.test_loaders import load_big_data

from .css_templates import load_css_templates

# Import generic loader for Parquet datasets
from .generic_loader import create_generic_loader
from .utils import load_examples_from_configs


def get_dataset_config_from_yaml(example_dir: Path) -> Dict[str, Optional[str]]:
    """Read table_name and schema from dataset.yaml if it exists."""
    result: Dict[str, Optional[str]] = {"table_name": None, "schema": None}
    dataset_yaml = example_dir / "dataset.yaml"
    if dataset_yaml.exists():
        try:
            with open(dataset_yaml) as f:
                config = yaml.safe_load(f)
                result["table_name"] = config.get("table_name")
                schema = config.get("schema")
                # Treat SQLite's 'main' schema as null (use target database default)
                result["schema"] = None if schema == "main" else schema
        except Exception:
            pass
    return result


def get_examples_directory() -> Path:
    """Get the path to the examples directory."""
    from .helpers import get_examples_folder

    return Path(get_examples_folder())


def discover_datasets() -> Dict[str, Callable[..., None]]:
    """Auto-discover all example datasets and create loaders for them.

    Examples are organized as:
        superset/examples/{example_name}/data.parquet           # Single dataset
        superset/examples/{example_name}/data/{name}.parquet    # Multiple datasets

    Table names are read from dataset.yaml if present, otherwise derived from
    the folder/file name.
    """
    loaders: Dict[str, Callable[..., None]] = {}
    examples_dir = get_examples_directory()

    if not examples_dir.exists():
        return loaders

    # Discover single data.parquet files (simple examples)
    for data_file in sorted(examples_dir.glob("*/data.parquet")):
        example_dir = data_file.parent
        dataset_name = example_dir.name

        # Skip special directories
        if dataset_name.startswith("_"):
            continue

        # Read table_name and schema from dataset.yaml
        config = get_dataset_config_from_yaml(example_dir)
        table_name = config["table_name"] or dataset_name
        schema = config["schema"]

        # Create loader function
        loader_name = f"load_{dataset_name}"
        loaders[loader_name] = create_generic_loader(
            dataset_name,
            table_name=table_name,
            schema=schema,
        )

    # Discover multiple parquet files in data/ folders (complex examples)
    for data_file in sorted(examples_dir.glob("*/data/*.parquet")):
        dataset_name = data_file.stem  # filename without extension
        example_dir = data_file.parent.parent

        # Skip special directories
        if example_dir.name.startswith("_"):
            continue

        # For multi-dataset examples, check datasets/{name}.yaml for table_name and schema
        datasets_yaml = example_dir / "datasets" / f"{dataset_name}.yaml"
        table_name = dataset_name
        schema = None
        if datasets_yaml.exists():
            try:
                with open(datasets_yaml) as f:
                    config = yaml.safe_load(f)
                    table_name = config.get("table_name", dataset_name)
                    raw_schema = config.get("schema")
                    # Treat SQLite's 'main' schema as null (use target database default)
                    schema = None if raw_schema == "main" else raw_schema
            except Exception:
                pass

        # Create loader function
        loader_name = f"load_{dataset_name}"
        if loader_name not in loaders:  # Don't override existing loaders
            loaders[loader_name] = create_generic_loader(
                dataset_name,
                table_name=table_name,
                schema=schema,
                data_file=data_file,
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
    "load_examples_from_configs",
    # Auto-discovered loaders
    *sorted(_auto_loaders.keys()),
]
