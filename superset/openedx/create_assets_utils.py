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


# This is taken from Superset's example utils:
# https://github.com/apache/superset/blob/7081a0e73d872332a1a63727c9ff7a22159018bb/superset/examples/utils.py#L73

# Changes were added to mock out the security manager, since the other options
# are to either replicate asset import entirely or to use the "examples"
# version, which skips a variety of other checks.
import logging
import yaml
import json
from pathlib import Path

from flask import g
from superset.commands.exceptions import CommandInvalidError
from superset.commands.importers.v1.assets import ImportAssetsCommand
from superset.commands.importers.v1.utils import METADATA_FILE_NAME
from superset.commands.database.importers.v1.utils import security_manager

logger = logging.getLogger(__name__)

# This logger is really spammy
model_helper_logger = logging.getLogger("superset.models.helpers")
model_helper_logger.setLevel(logging.WARNING)


YAML_EXTENSIONS = {".yaml", ".yml"}



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
                content = fp.read()
                loaded_content = yaml.load(content, Loader=yaml.Loader)
                if loaded_content.get("query_context") and isinstance(loaded_content["query_context"], dict):
                    loaded_content["query_context"] = json.dumps(loaded_content["query_context"])
                content = yaml.dump(loaded_content)
                contents[str(path_name.relative_to(root))] = content


    # removing "type" from the metadata allows us to import any exported model
    # from the unzipped directory directly
    metadata = yaml.load(contents.get(METADATA_FILE_NAME, "{}"), Loader=yaml.Loader)
    if "type" in metadata:
        del metadata["type"]
    contents[METADATA_FILE_NAME] = yaml.dump(metadata)

    # Force our use to the admin user to prevent errors on import
    g.user = security_manager.find_user(username="{{SUPERSET_ADMIN_USERNAME}}")

    command = ImportAssetsCommand(
        contents,
        overwrite=overwrite,
        force_data=force_data,
    )
    try:
        command.run()
    except CommandInvalidError as ex:
        logger.error("An error occurred: %s", ex.normalized_messages())
