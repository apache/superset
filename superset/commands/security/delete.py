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

from superset.commands.base import BaseCommand
from superset.commands.security.exceptions import (
    RLSRuleNotFoundError,
    RuleDeleteFailedError,
)
from superset.daos.exceptions import DAODeleteFailedError
from superset.daos.security import RLSDAO
from superset.reports.models import ReportSchedule

logger = logging.getLogger(__name__)


class DeleteRLSRuleCommand(BaseCommand):
    def __init__(self, model_ids: list[int]):
        self._model_ids = model_ids
        self._models: list[ReportSchedule] = []

    def run(self) -> None:
        self.validate()
        try:
            RLSDAO.delete(self._models)
        except DAODeleteFailedError as ex:
            logger.exception(ex.exception)
            raise RuleDeleteFailedError() from ex

    def validate(self) -> None:
        # Validate/populate model exists
        self._models = RLSDAO.find_by_ids(self._model_ids)
        if not self._models or len(self._models) != len(self._model_ids):
            raise RLSRuleNotFoundError()
