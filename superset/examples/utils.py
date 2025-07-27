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

# Known example UUID from YAML files (USA Births dashboard)
BIRTHS_DASHBOARD_UUID = "fb7d30bc-b160-4371-861c-235d19bf6e25"
BIRTHS_DASHBOARD_SLUG = "births"


def _has_old_examples() -> bool:
    """
    Check if old pre-YAML examples exist by looking for a known dashboard.
    If the births dashboard exists with a different UUID than expected,
    we know these are old examples.
    """
    from superset import db
    from superset.models.dashboard import Dashboard

    try:
        # Check if births dashboard exists with wrong UUID (indicating old examples)
        births_dashboard = (
            db.session.query(Dashboard).filter_by(slug=BIRTHS_DASHBOARD_SLUG).first()
        )

        if births_dashboard and str(births_dashboard.uuid) != BIRTHS_DASHBOARD_UUID:
            _logger.info(
                f"Found old births dashboard with UUID {births_dashboard.uuid} "
                f"(expected {BIRTHS_DASHBOARD_UUID})"
            )
            return True

    except Exception as e:
        _logger.debug(f"Error checking for old examples: {e}")
        # If we can't check (e.g., database not set up), assume no old examples
        return False

    return False


def cleanup_old_examples() -> bool:
    """
    Clean up old pre-YAML examples if they exist.
    Returns True if cleanup was performed, False otherwise.
    """
    from superset.cli.examples import clear_old_examples

    try:
        return clear_old_examples()
    except Exception as e:
        _logger.error(f"Failed to clean up examples: {e}")
        raise


def load_examples_from_configs(
    force_data: bool = False, load_test_data: bool = False
) -> None:
    """
    Load all the examples inside superset/examples/configs/.
    """
    # Check if old examples exist before loading new ones
    if _has_old_examples():
        _logger.warning(
            "Old, pre-YAML examples detected, skipping example import. "
            "Existing examples will be preserved."
        )
        return

    contents = load_contents(load_test_data)
    _logger.info(f"Found {len(contents)} YAML configuration files to import")
    command = ImportExamplesCommand(contents, overwrite=True, force_data=force_data)
    command.run()
    _logger.info("Finished loading examples from YAML configuration files")


def load_contents(load_test_data: bool = False) -> dict[str, Any]:
    """Traverse configs directory and load contents"""
    root = files("superset") / "examples/configs"
    resource_names = (files("superset") / str(root)).iterdir()
    queue = [root / str(resource_name) for resource_name in resource_names]

    contents: dict[Path, str] = {}
    while queue:
        path_name = queue.pop()
        test_re = re.compile(r"\.test\.|metadata\.yaml$")

        if (files("superset") / str(path_name)).is_dir():
            queue.extend(
                path_name / str(child_name)
                for child_name in (files("superset") / str(path_name)).iterdir()
            )
        elif Path(str(path_name)).suffix.lower() in YAML_EXTENSIONS:
            if load_test_data and test_re.search(str(path_name)) is None:
                continue
            contents[Path(str(path_name))] = (
                files("superset") / str(path_name)
            ).read_text("utf-8")

    return {
        str(path.relative_to(str(root))): content for path, content in contents.items()
    }


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
