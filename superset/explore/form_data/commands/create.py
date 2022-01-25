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
from secrets import token_urlsafe

from sqlalchemy.exc import SQLAlchemyError

from superset.commands.base import BaseCommand
from superset.explore.form_data.commands.parameters import CommandParameters
from superset.explore.form_data.commands.state import TemporaryExploreState
from superset.explore.form_data.utils import check_access
from superset.extensions import cache_manager
from superset.key_value.commands.exceptions import KeyValueCreateFailedError

logger = logging.getLogger(__name__)


class CreateFormDataCommand(BaseCommand):
    def __init__(self, cmd_params: CommandParameters):
        self._cmd_params = cmd_params

    def run(self) -> str:
        try:
            dataset_id = self._cmd_params.dataset_id
            chart_id = self._cmd_params.chart_id
            actor = self._cmd_params.actor
            form_data = self._cmd_params.form_data
            check_access(dataset_id, chart_id, actor)
            key = token_urlsafe(48)
            if form_data:
                state: TemporaryExploreState = {
                    "owner": actor.get_user_id(),
                    "dataset_id": dataset_id,
                    "chart_id": chart_id,
                    "form_data": form_data,
                }
                cache_manager.explore_form_data_cache.set(key, state)
            return key
        except SQLAlchemyError as ex:
            logger.exception("Error running create command")
            raise KeyValueCreateFailedError() from ex

    def validate(self) -> None:
        pass
