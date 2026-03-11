# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.
import logging
import re
from importlib.resources import files
from pathlib import Path
from typing import Any

import yaml

from superset.commands.exceptions import CommandInvalidError
from superset.commands.importers.v1.examples import ImportExamplesCommand
from superset.commands.importers.v1.utils import METADATA_FILE_NAME

_logger = logging.getLogger(__name__)

YAML_EXTENSIONS = {".yaml", ".yml"}


def _normalize_dataset_schema(content: str) -> str:
    """Normalize schema in dataset YAML content.

    Converts SQLite's 'main' schema to null for portability across databases.
    """
    # Replace 'schema: main' with 'schema: null' to use target database default
    return content.replace("schema: main", "schema: null")


def _read_file_if_exists(base: Any, path: Any) -> str | None:
    """Read file content if it exists, return None otherwise."""
    file_path = base / str(path)
    if file_path.is_file():
        return file_path.read_text("utf-8")
    return None


def _load_shared_configs(examples_root: Any) -> dict[str, str]:
    """Load shared database and metadata configs from _shared directory."""
    from flask import current_app

    contents: dict[str, str] = {}
    base = files("superset")
    shared_dir = examples_root / "_shared"

    if not (base / str(shared_dir)).is_dir():
        return contents

    # Database config -> databases/examples.yaml
    if db_content := _read_file_if_exists(base, shared_dir / "database.yaml"):
        # Replace placeholder with configured examples URI
        examples_uri = current_app.config.get("SQLALCHEMY_EXAMPLES_URI", "")
        db_content = db_content.replace("__SQLALCHEMY_EXAMPLES_URI__", examples_uri)
        contents["databases/examples.yaml"] = db_content

    # Metadata -> metadata.yaml
    if meta_content := _read_file_if_exists(base, shared_dir / "metadata.yaml"):
        contents["metadata.yaml"] = meta_content

    return contents


def _should_skip_directory(item: Any) -> bool:
    """Check if directory should be skipped during traversal."""
    name = str(item)
    if name.startswith("_") or name.startswith("."):
        return True
    return name in ("configs", "data", "__pycache__")


def _load_datasets_from_folder(
    base: Any,
    datasets_dir: Any,
    test_re: re.Pattern[str],
    load_test_data: bool,
) -> dict[str, str]:
    """Load dataset configs from a datasets/ folder."""
    contents: dict[str, str] = {}
    if not (base / str(datasets_dir)).is_dir():
        return contents

    for dataset_item in (base / str(datasets_dir)).iterdir():
        dataset_filename = dataset_item.name  # Get just the filename, not full path
        if Path(dataset_filename).suffix.lower() not in YAML_EXTENSIONS:
            continue
        if not load_test_data and test_re.search(dataset_filename):
            continue
        dataset_file = datasets_dir / dataset_filename
        content = _read_file_if_exists(base, dataset_file)
        if content:
            dataset_name = Path(dataset_filename).stem
            contents[f"datasets/examples/{dataset_name}.yaml"] = (
                _normalize_dataset_schema(content)
            )
    return contents


def _load_charts_from_folder(
    base: Any,
    charts_dir: Any,
    example_name: str,
    test_re: re.Pattern[str],
    load_test_data: bool,
) -> dict[str, str]:
    """Load chart configs from a charts/ folder."""
    contents: dict[str, str] = {}
    if not (base / str(charts_dir)).is_dir():
        return contents

    for chart_item in (base / str(charts_dir)).iterdir():
        chart_name = chart_item.name  # Get just the filename, not full path
        if Path(chart_name).suffix.lower() not in YAML_EXTENSIONS:
            continue
        if not load_test_data and test_re.search(chart_name):
            continue
        chart_file = charts_dir / chart_name
        content = _read_file_if_exists(base, chart_file)
        if content:
            contents[f"charts/{example_name}/{chart_name}"] = content
    return contents


def _load_example_contents(
    example_dir: Any, example_name: str, test_re: re.Pattern[str], load_test_data: bool
) -> dict[str, str]:
    """Load all configs (dataset, dashboard, charts) from a single example directory."""
    contents: dict[str, str] = {}
    base = files("superset")

    # Single dataset.yaml at root (backward compatible)
    dataset_content = _read_file_if_exists(base, example_dir / "dataset.yaml")
    if dataset_content and (load_test_data or not test_re.search("dataset.yaml")):
        contents[f"datasets/examples/{example_name}.yaml"] = _normalize_dataset_schema(
            dataset_content
        )

    # Multiple datasets in datasets/ folder
    contents.update(
        _load_datasets_from_folder(
            base, example_dir / "datasets", test_re, load_test_data
        )
    )

    # Dashboard config
    dashboard_content = _read_file_if_exists(base, example_dir / "dashboard.yaml")
    if dashboard_content and (load_test_data or not test_re.search("dashboard.yaml")):
        contents[f"dashboards/{example_name}.yaml"] = dashboard_content

    # Chart configs
    contents.update(
        _load_charts_from_folder(
            base, example_dir / "charts", example_name, test_re, load_test_data
        )
    )

    return contents


def load_examples_from_configs(
    force_data: bool = False, load_test_data: bool = False
) -> None:
    """
    Load all the examples from the new directory structure.

    Examples are organized as:
        superset/examples/{example_name}/
            data.parquet      # Raw data (optional)
            dataset.yaml      # Single dataset metadata (simple examples)
            datasets/         # Multiple datasets (complex examples)
                dataset1.yaml
                dataset2.yaml
            dashboard.yaml    # Dashboard config (optional)
            charts/           # Chart configs (optional)
                chart1.yaml
                chart2.yaml
        superset/examples/_shared/
            database.yaml     # Database connection
            metadata.yaml     # Import metadata

    For simple examples with one dataset, use dataset.yaml at root.
    For complex examples with multiple datasets, use datasets/ folder.
    """
    contents = load_contents(load_test_data)
    command = ImportExamplesCommand(contents, overwrite=True, force_data=force_data)
    command.run()


def load_contents(load_test_data: bool = False) -> dict[str, Any]:
    """Traverse example directories and load YAML configs.

    Builds import structure expected by ImportExamplesCommand:
        databases/examples.yaml
        datasets/examples/{name}.yaml
        charts/{dashboard}/{chart}.yaml
        dashboards/{name}.yaml
        metadata.yaml

    Args:
        load_test_data: If True, includes test data files (*.test.yaml).
                       If False, excludes test data files.
    """
    examples_root = files("superset") / "examples"
    test_re = re.compile(r"\.test\.")
    base = files("superset")

    # Load shared configs (_shared directory)
    contents: dict[str, str] = _load_shared_configs(examples_root)

    # Traverse example directories
    for item in (base / str(examples_root)).iterdir():
        item_name = item.name  # Get just the directory name, not full path
        example_dir = examples_root / item_name

        # Skip non-directories and special dirs
        if not (base / str(example_dir)).is_dir():
            continue
        if _should_skip_directory(item_name):
            continue

        example_name = item_name

        example_contents = _load_example_contents(
            example_dir, example_name, test_re, load_test_data
        )
        contents.update(example_contents)

    return contents


def load_configs_from_directory(
    root: Path, overwrite: bool = True, force_data: bool = False
) -> None:
    """
    Load all the examples from a given directory.
    """
    contents: dict[str, str] = {}
    queue = [root]
    while queue:
        path_name = queue.pop()
        if path_name.is_dir():
            queue.extend(path_name.glob("*"))
        elif path_name.suffix.lower() in YAML_EXTENSIONS:
            with open(path_name) as fp:
                contents[str(path_name.relative_to(root))] = fp.read()

    # removing "type" from the metadata allows us to import any exported model
    # from the unzipped directory directly
    metadata = yaml.load(contents.get(METADATA_FILE_NAME, "{}"), Loader=yaml.Loader)  # noqa: S506
    if "type" in metadata:
        del metadata["type"]
    contents[METADATA_FILE_NAME] = yaml.dump(metadata)

    command = ImportExamplesCommand(
        contents,
        overwrite=overwrite,
        force_data=force_data,
    )
    try:
        command.run()
    except CommandInvalidError as ex:
        _logger.error("An error occurred: %s", ex.normalized_messages())
