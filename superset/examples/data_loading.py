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

import logging
from pathlib import Path
from typing import Any, Callable, Dict, Optional

import yaml

# Import loaders that have custom logic (dashboards, CSS, etc.)
from superset.cli.test_loaders import load_big_data

from .css_templates import load_css_templates

# Import generic loader for Parquet datasets
from .generic_loader import create_generic_loader
from .utils import load_examples_from_configs

logger = logging.getLogger(__name__)


def get_dataset_config_from_yaml(example_dir: Path) -> Dict[str, Optional[str]]:
    """Read table_name, schema, and data_file from dataset.yaml if it exists."""
    result: Dict[str, Optional[str]] = {
        "table_name": None,
        "schema": None,
        "data_file": None,
    }
    dataset_yaml = example_dir / "dataset.yaml"
    if dataset_yaml.exists():
        try:
            with open(dataset_yaml) as f:
                config = yaml.safe_load(f)
                result["table_name"] = config.get("table_name")
                result["data_file"] = config.get("data_file")
                schema = config.get("schema")
                # Treat SQLite's 'main' schema as null (use target database default)
                result["schema"] = None if schema == "main" else schema
        except Exception:
            logger.debug("Could not read dataset.yaml from %s", example_dir)
    return result


def get_examples_directory() -> Path:
    """Get the path to the examples directory."""
    from .helpers import get_examples_folder

    return Path(get_examples_folder())


def _get_multi_dataset_config(
    example_dir: Path, dataset_name: str, data_file: Path
) -> Dict[str, Any]:
    """Read config for a multi-dataset example from datasets/{name}.yaml."""
    datasets_yaml = example_dir / "datasets" / f"{dataset_name}.yaml"
    result: Dict[str, Any] = {
        "table_name": dataset_name,
        "schema": None,
        "data_file": data_file,
    }

    if not datasets_yaml.exists():
        return result

    try:
        with open(datasets_yaml) as f:
            yaml_config = yaml.safe_load(f)
            result["table_name"] = yaml_config.get("table_name") or dataset_name
            raw_schema = yaml_config.get("schema")
            result["schema"] = None if raw_schema == "main" else raw_schema

            # Use explicit data_file from YAML if specified
            explicit_data_file = yaml_config.get("data_file")
            if explicit_data_file:
                candidate = example_dir / "data" / explicit_data_file
                if candidate.exists():
                    result["data_file"] = candidate
                else:
                    logger.warning(
                        "data_file '%s' specified in YAML does not exist",
                        explicit_data_file,
                    )
    except Exception:
        logger.debug("Could not read datasets yaml from %s", datasets_yaml)

    return result


def discover_datasets() -> Dict[str, Callable[..., None]]:
    """Auto-discover all example datasets and create loaders for them.

    Examples are organized as:
        superset/examples/{example_name}/data.parquet           # Single dataset
        superset/examples/{example_name}/data/{name}.parquet    # Multiple datasets

    Table names and data file references are read from dataset.yaml/datasets/*.yaml
    if present, otherwise derived from the folder/file name.
    """
    loaders: Dict[str, Callable[..., None]] = {}
    examples_dir = get_examples_directory()

    if not examples_dir.exists():
        return loaders

    # Discover single data.parquet files (simple examples)
    for data_file in sorted(examples_dir.glob("*/data.parquet")):
        example_dir = data_file.parent
        dataset_name = example_dir.name

        if dataset_name.startswith("_"):
            continue

        config = get_dataset_config_from_yaml(example_dir)
        table_name = config["table_name"] or dataset_name
        explicit_data_file = config.get("data_file")
        if explicit_data_file:
            resolved_file = example_dir / explicit_data_file
        else:
            resolved_file = data_file
        if explicit_data_file and not resolved_file.exists():
            logger.warning("data_file '%s' does not exist", explicit_data_file)
            resolved_file = data_file

        loader_name = f"load_{dataset_name}"
        loaders[loader_name] = create_generic_loader(
            dataset_name,
            table_name=table_name,
            schema=config["schema"],
            data_file=resolved_file,
        )

    # Discover multiple parquet files in data/ folders (complex examples)
    for data_file in sorted(examples_dir.glob("*/data/*.parquet")):
        dataset_name = data_file.stem
        example_dir = data_file.parent.parent

        if example_dir.name.startswith("_"):
            continue

        config = _get_multi_dataset_config(example_dir, dataset_name, data_file)
        loader_name = f"load_{dataset_name}"
        if loader_name not in loaders:
            loaders[loader_name] = create_generic_loader(
                dataset_name,
                table_name=config["table_name"],
                schema=config["schema"],
                data_file=config["data_file"],
            )

    return loaders


# Auto-discover and create all dataset loaders
try:
    _auto_loaders = discover_datasets()
except RuntimeError:
    # Outside Flask app context (e.g., tests, tooling)
    _auto_loaders = {}

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
