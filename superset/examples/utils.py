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


def load_examples_from_configs(
    force_data: bool = False, load_test_data: bool = False
) -> None:
    """
    Load all the examples from the new directory structure.

    Examples are organized as:
        superset/examples/{example_name}/
            data.parquet      # Raw data
            dataset.yaml      # Dataset metadata
            dashboard.yaml    # Dashboard config (optional)
            charts/           # Chart configs (optional)
                chart1.yaml
                chart2.yaml
        superset/examples/_shared/
            database.yaml     # Database connection
            metadata.yaml     # Import metadata
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
    contents: dict[str, str] = {}

    # Load shared configs (_shared directory)
    shared_dir = examples_root / "_shared"
    if (files("superset") / str(shared_dir)).is_dir():
        # Database config -> databases/examples.yaml
        db_file = shared_dir / "database.yaml"
        if (files("superset") / str(db_file)).is_file():
            contents["databases/examples.yaml"] = (
                files("superset") / str(db_file)
            ).read_text("utf-8")

        # Metadata -> metadata.yaml
        meta_file = shared_dir / "metadata.yaml"
        if (files("superset") / str(meta_file)).is_file():
            contents["metadata.yaml"] = (
                files("superset") / str(meta_file)
            ).read_text("utf-8")

    # Traverse example directories
    for item in (files("superset") / str(examples_root)).iterdir():
        example_dir = examples_root / str(item)

        # Skip non-directories, special dirs, and Python files
        if not (files("superset") / str(example_dir)).is_dir():
            continue
        if str(item).startswith("_") or str(item).startswith("."):
            continue
        if str(item) in ("configs", "data", "__pycache__"):
            continue

        example_name = str(item)

        # Dataset config -> datasets/examples/{name}.yaml
        dataset_file = example_dir / "dataset.yaml"
        if (files("superset") / str(dataset_file)).is_file():
            content = (files("superset") / str(dataset_file)).read_text("utf-8")
            if not load_test_data and test_re.search(str(dataset_file)):
                continue
            contents[f"datasets/examples/{example_name}.yaml"] = content

        # Dashboard config -> dashboards/{name}.yaml
        dashboard_file = example_dir / "dashboard.yaml"
        if (files("superset") / str(dashboard_file)).is_file():
            content = (files("superset") / str(dashboard_file)).read_text("utf-8")
            if not load_test_data and test_re.search(str(dashboard_file)):
                continue
            # Extract dashboard name from content or use example name
            contents[f"dashboards/{example_name}.yaml"] = content

        # Chart configs -> charts/{example_name}/{chart}.yaml
        charts_dir = example_dir / "charts"
        if (files("superset") / str(charts_dir)).is_dir():
            for chart_item in (files("superset") / str(charts_dir)).iterdir():
                chart_file = charts_dir / str(chart_item)
                if Path(str(chart_item)).suffix.lower() in YAML_EXTENSIONS:
                    if not load_test_data and test_re.search(str(chart_file)):
                        continue
                    content = (files("superset") / str(chart_file)).read_text("utf-8")
                    contents[f"charts/{example_name}/{chart_item}"] = content

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
