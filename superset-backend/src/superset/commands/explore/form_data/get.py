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

from flask import current_app as app
from sqlalchemy.exc import SQLAlchemyError

from superset.commands.base import BaseCommand
from superset.commands.explore.form_data.parameters import CommandParameters
from superset.commands.explore.form_data.state import TemporaryExploreState
from superset.commands.explore.form_data.utils import check_access
from superset.commands.temporary_cache.exceptions import TemporaryCacheGetFailedError
from superset.extensions import cache_manager
from superset.utils.core import DatasourceType

logger = logging.getLogger(__name__)


class GetFormDataCommand(BaseCommand, ABC):
    def __init__(self, cmd_params: CommandParameters) -> None:
        self._cmd_params = cmd_params
        config = app.config["EXPLORE_FORM_DATA_CACHE_CONFIG"]
        self._refresh_timeout = config.get("REFRESH_TIMEOUT_ON_RETRIEVAL")

    def run(self) -> Optional[str]:
        try:
            key = self._cmd_params.key
            state: TemporaryExploreState = cache_manager.explore_form_data_cache.get(
                key
            )
            if state:
                check_access(
                    state["datasource_id"],
                    state["chart_id"],
                    DatasourceType(state["datasource_type"]),
                )
                if self._refresh_timeout:
                    cache_manager.explore_form_data_cache.set(key, state)
                return state["form_data"]
            return None
        except SQLAlchemyError as ex:
            logger.exception("Error running get command")
            raise TemporaryCacheGetFailedError() from ex

    def validate(self) -> None:
        pass
