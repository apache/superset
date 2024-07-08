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
from functools import partial
from typing import Optional

from superset.commands.base import BaseCommand
from superset.commands.temporary_cache.exceptions import TemporaryCacheUpdateFailedError
from superset.commands.temporary_cache.parameters import CommandParameters
from superset.utils.decorators import on_error, transaction

logger = logging.getLogger(__name__)


class UpdateTemporaryCacheCommand(BaseCommand, ABC):
    def __init__(
        self,
        cmd_params: CommandParameters,
    ):
        self._parameters = cmd_params

    @transaction(on_error=partial(on_error, reraise=TemporaryCacheUpdateFailedError))
    def run(self) -> Optional[str]:
        return self.update(self._parameters)

    def validate(self) -> None:
        pass

    @abstractmethod
    def update(self, cmd_params: CommandParameters) -> Optional[str]: ...
