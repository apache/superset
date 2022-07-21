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

from flask import session
from sqlalchemy.exc import SQLAlchemyError

from superset.commands.base import BaseCommand
from superset.explore.form_data.commands.parameters import CommandParameters
from superset.explore.form_data.commands.state import TemporaryExploreState
from superset.explore.form_data.commands.utils import check_access
from superset.extensions import cache_manager
from superset.key_value.utils import get_owner, random_key
from superset.temporary_cache.commands.exceptions import TemporaryCacheCreateFailedError
from superset.temporary_cache.utils import cache_key
from superset.utils.schema import validate_json

logger = logging.getLogger(__name__)


class CreateFormDataCommand(BaseCommand):
    def __init__(self, cmd_params: CommandParameters):
        self._cmd_params = cmd_params

    def run(self) -> str:
        self.validate()
        try:
            datasource_id = self._cmd_params.datasource_id
            datasource_type = self._cmd_params.datasource_type
            chart_id = self._cmd_params.chart_id
            tab_id = self._cmd_params.tab_id
            actor = self._cmd_params.actor
            form_data = self._cmd_params.form_data
            check_access(datasource_id, chart_id, actor, datasource_type)
            contextual_key = cache_key(
                session.get("_id"), tab_id, datasource_id, chart_id, datasource_type
            )
            key = cache_manager.explore_form_data_cache.get(contextual_key)
            if not key or not tab_id:
                key = random_key()
            if form_data:
                state: TemporaryExploreState = {
                    "owner": get_owner(actor),
                    "datasource_id": datasource_id,
                    "datasource_type": datasource_type,
                    "chart_id": chart_id,
                    "form_data": form_data,
                }
                cache_manager.explore_form_data_cache.set(key, state)
                cache_manager.explore_form_data_cache.set(contextual_key, key)
            return key
        except SQLAlchemyError as ex:
            logger.exception("Error running create command")
            raise TemporaryCacheCreateFailedError() from ex

    def validate(self) -> None:
        if self._cmd_params.form_data:
            validate_json(self._cmd_params.form_data)
