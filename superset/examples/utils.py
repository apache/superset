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
from pathlib import Path
from typing import Any, Dict

import yaml
from pkg_resources import resource_isdir, resource_listdir, resource_stream

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


def load_contents(load_test_data: bool = False) -> Dict[str, Any]:
    """Traverse configs directory and load contents"""
    root = Path("examples/configs")
    resource_names = resource_listdir("superset", str(root))
    queue = [root / resource_name for resource_name in resource_names]

    contents: Dict[Path, str] = {}
    while queue:
        path_name = queue.pop()
        test_re = re.compile(r"\.test\.|metadata\.yaml$")

        if resource_isdir("superset", str(path_name)):
            queue.extend(
                path_name / child_name
                for child_name in resource_listdir("superset", str(path_name))
            )
        elif path_name.suffix.lower() in YAML_EXTENSIONS:
            if load_test_data and test_re.search(str(path_name)) is None:
                continue
            contents[path_name] = (
                resource_stream("superset", str(path_name)).read().decode("utf-8")
            )

    return {str(path.relative_to(root)): content for path, content in contents.items()}


def load_configs_from_directory(
    root: Path, overwrite: bool = True, force_data: bool = False
) -> None:
    """
    Load all the examples from a given directory.
    """
    contents: Dict[str, str] = {}
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
    metadata = yaml.safe_load(contents.get(METADATA_FILE_NAME, "{}"))
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
