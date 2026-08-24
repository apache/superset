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
from typing import Any

from marshmallow.exceptions import ValidationError

from superset.commands.base import BaseCommand
from superset.commands.dataset.importers import v1
from superset.commands.exceptions import CommandInvalidError
from superset.commands.importers.exceptions import IncorrectVersionError

logger = logging.getLogger(__name__)

# list of different import formats supported. The legacy v0 importer is
# deliberately NOT dispatched here: it overrides datasets matched by
# (table_name, schema, database) without ownership checks, and this
# dispatcher is reachable from the HTTP import endpoint
# (POST /api/v1/dataset/import/). Operators can still import legacy v0
# YAML files with the `legacy_import_datasources` CLI command, which uses
# the v0 command directly.
command_versions = [
    v1.ImportDatasetsCommand,
]


class ImportDatasetsCommand(BaseCommand):
    """
    Import datasets.

    This command dispatches the import to different versions of the command
    until it finds one that matches.
    """

    def __init__(self, contents: dict[str, str], *args: Any, **kwargs: Any):
        self.contents = contents
        self.args = args
        self.kwargs = kwargs

    def run(self) -> None:
        # iterate over all commands until we find a version that can
        # handle the contents
        for version in command_versions:
            command = version(self.contents, *self.args, **self.kwargs)
            try:
                command.run()
                return
            except IncorrectVersionError:
                logger.debug("File not handled by command, skipping")
            except (CommandInvalidError, ValidationError):
                # found right version, but file is invalid
                logger.info("Command failed validation")
                raise
            except Exception:
                # validation succeeded but something went wrong
                logger.exception("Error running import command")
                raise

        raise CommandInvalidError("Could not find a valid command to import file")

    def validate(self) -> None:
        pass
