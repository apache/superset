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
    Load all the examples inside superset/examples/configs/.
    """
    contents = load_contents(load_test_data)
    command = ImportExamplesCommand(contents, overwrite=True, force_data=force_data)
    command.run()


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
    metadata = yaml.load(contents.get(METADATA_FILE_NAME, "{}"), Loader=yaml.Loader)
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
