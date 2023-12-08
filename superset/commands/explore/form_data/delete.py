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
from abc import ABC
from typing import Optional

from flask import session
from sqlalchemy.exc import SQLAlchemyError

from superset.commands.base import BaseCommand
from superset.commands.explore.form_data.parameters import CommandParameters
from superset.commands.explore.form_data.state import TemporaryExploreState
from superset.commands.explore.form_data.utils import check_access
from superset.commands.temporary_cache.exceptions import (
    TemporaryCacheAccessDeniedError,
    TemporaryCacheDeleteFailedError,
)
from superset.extensions import cache_manager
from superset.temporary_cache.utils import cache_key
from superset.utils.core import DatasourceType, get_user_id

logger = logging.getLogger(__name__)


class DeleteFormDataCommand(BaseCommand, ABC):
    def __init__(self, cmd_params: CommandParameters):
        self._cmd_params = cmd_params

    def run(self) -> bool:
        try:
            key = self._cmd_params.key
            state: TemporaryExploreState = cache_manager.explore_form_data_cache.get(
                key
            )
            if state:
                datasource_id: int = state["datasource_id"]
                chart_id: Optional[int] = state["chart_id"]
                datasource_type = DatasourceType(state["datasource_type"])
                check_access(datasource_id, chart_id, datasource_type)
                if state["owner"] != get_user_id():
                    raise TemporaryCacheAccessDeniedError()
                tab_id = self._cmd_params.tab_id
                contextual_key = cache_key(
                    session.get("_id"), tab_id, datasource_id, chart_id, datasource_type
                )
                cache_manager.explore_form_data_cache.delete(contextual_key)
                return cache_manager.explore_form_data_cache.delete(key)
            return False
        except SQLAlchemyError as ex:
            logger.exception("Error running delete command")
            raise TemporaryCacheDeleteFailedError() from ex

    def validate(self) -> None:
        pass
