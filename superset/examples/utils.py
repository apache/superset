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
from pathlib import Path
from typing import Any, Dict

from pkg_resources import resource_isdir, resource_listdir, resource_stream

from superset.commands.importers.v1.examples import ImportExamplesCommand

YAML_EXTENSIONS = {".yaml", ".yml"}


def load_from_configs(force_data: bool = False) -> None:
    contents = load_contents()
    command = ImportExamplesCommand(contents, overwrite=True, force_data=force_data)
    command.run()


def load_contents() -> Dict[str, Any]:
    """Traverse configs directory and load contents"""
    root = Path("examples/configs")
    resource_names = resource_listdir("superset", str(root))
    queue = [root / resource_name for resource_name in resource_names]

    contents: Dict[Path, str] = {}
    while queue:
        path_name = queue.pop()

        if resource_isdir("superset", str(path_name)):
            queue.extend(
                path_name / child_name
                for child_name in resource_listdir("superset", str(path_name))
            )
        elif path_name.suffix.lower() in YAML_EXTENSIONS:
            contents[path_name] = (
                resource_stream("superset", str(path_name)).read().decode("utf-8")
            )

    return {str(path.relative_to(root)): content for path, content in contents.items()}
