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
from abc import ABC, abstractmethod
from typing import Optional

from sqlalchemy.exc import SQLAlchemyError

from superset.commands.base import BaseCommand
from superset.temporary_cache.commands.exceptions import TemporaryCacheUpdateFailedError
from superset.temporary_cache.commands.parameters import CommandParameters

logger = logging.getLogger(__name__)


class UpdateTemporaryCacheCommand(BaseCommand, ABC):
    def __init__(
        self,
        cmd_params: CommandParameters,
    ):
        self._parameters = cmd_params

    def run(self) -> Optional[str]:
        try:
            return self.update(self._parameters)
        except SQLAlchemyError as ex:
            logger.exception("Error running update command")
            raise TemporaryCacheUpdateFailedError() from ex

    def validate(self) -> None:
        pass

    @abstractmethod
    def update(self, cmd_params: CommandParameters) -> Optional[str]:
        ...
