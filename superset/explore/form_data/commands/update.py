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
from superset.explore.form_data.commands.parameters import CommandParameters
from superset.explore.form_data.commands.state import TemporaryExploreState
from superset.explore.utils import check_access
from superset.extensions import cache_manager
from superset.temporary_cache.commands.exceptions import (
    TemporaryCacheAccessDeniedError,
    TemporaryCacheUpdateFailedError,
)
from superset.temporary_cache.utils import cache_key, random_key
from superset.utils.schema import validate_json

logger = logging.getLogger(__name__)


class UpdateFormDataCommand(BaseCommand, ABC):
    def __init__(
        self, cmd_params: CommandParameters,
    ):
        self._cmd_params = cmd_params

    def run(self) -> Optional[str]:
        self.validate()
        try:
            dataset_id = self._cmd_params.dataset_id
            chart_id = self._cmd_params.chart_id
            actor = self._cmd_params.actor
            key = self._cmd_params.key
            form_data = self._cmd_params.form_data
            check_access(dataset_id, chart_id, actor)
            state: TemporaryExploreState = cache_manager.explore_form_data_cache.get(
                key
            )
            if state and form_data:
                user_id = actor.get_user_id()
                if state["owner"] != user_id:
                    raise TemporaryCacheAccessDeniedError()

                # Generate a new key if tab_id changes or equals 0
                tab_id = self._cmd_params.tab_id
                contextual_key = cache_key(
                    session.get("_id"), tab_id, dataset_id, chart_id
                )
                key = cache_manager.explore_form_data_cache.get(contextual_key)
                if not key or not tab_id:
                    key = random_key()
                    cache_manager.explore_form_data_cache.set(contextual_key, key)

                new_state: TemporaryExploreState = {
                    "owner": actor.get_user_id(),
                    "dataset_id": dataset_id,
                    "chart_id": chart_id,
                    "form_data": form_data,
                }
                cache_manager.explore_form_data_cache.set(key, new_state)
            return key
        except SQLAlchemyError as ex:
            logger.exception("Error running update command")
            raise TemporaryCacheUpdateFailedError() from ex

    def validate(self) -> None:
        if self._cmd_params.form_data:
            validate_json(self._cmd_params.form_data)
