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
from typing import Any, Dict

from marshmallow.exceptions import ValidationError

from superset.charts.commands.importers import v1
from superset.commands.base import BaseCommand
from superset.commands.exceptions import CommandInvalidError
from superset.commands.importers.exceptions import IncorrectVersionError

logger = logging.getLogger(__name__)

command_versions = [
    v1.ImportChartsCommand,
]


class ImportChartsCommand(BaseCommand):
    """
    Import charts.

    This command dispatches the import to different versions of the command
    until it finds one that matches.
    """

    # pylint: disable=unused-argument
    def __init__(self, contents: Dict[str, str], *args: Any, **kwargs: Any):
        self.contents = contents

    def run(self) -> None:
        # iterate over all commands until we find a version that can
        # handle the contents
        for version in command_versions:
            command = version(self.contents)
            try:
                command.run()
                return
            except IncorrectVersionError:
                # file is not handled by command, skip
                pass
            except (CommandInvalidError, ValidationError) as exc:
                # found right version, but file is invalid
                logger.info("Command failed validation")
                raise exc
            except Exception as exc:
                # validation succeeded but something went wrong
                logger.exception("Error running import command")
                raise exc

        raise CommandInvalidError("Could not find a valid command to import file")

    def validate(self) -> None:
        pass
