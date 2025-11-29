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
from typing import Optional

from flask import current_app as app

from superset.commands.dashboard.filter_state.utils import check_access
from superset.commands.temporary_cache.get import GetTemporaryCacheCommand
from superset.commands.temporary_cache.parameters import CommandParameters
from superset.extensions import cache_manager
from superset.temporary_cache.utils import cache_key
from superset.utils import json as json_utils


class GetFilterStateCommand(GetTemporaryCacheCommand):
    def __init__(self, cmd_params: CommandParameters) -> None:
        super().__init__(cmd_params)
        self._refresh_timeout = app.config["FILTER_STATE_CACHE_CONFIG"].get(
            "REFRESH_TIMEOUT_ON_RETRIEVAL"
        )

    def get(self, cmd_params: CommandParameters) -> Optional[str]:
        resource_id = cmd_params.resource_id
        key = cache_key(resource_id, cmd_params.key)
        check_access(resource_id)
        entry = cache_manager.filter_state_cache.get(key) or {}
        if entry and self._refresh_timeout:
            cache_manager.filter_state_cache.set(key, entry)
        return entry.get("value")

    def get_with_name(
        self, cmd_params: CommandParameters
    ) -> Optional[dict[str, Optional[str]]]:
        """
        Get filter state value and extract name from the JSON value.
        Returns a dict with 'value' and 'name' keys.
        """
        value = self.get(cmd_params)
        if not value:
            return None

        name: Optional[str] = None
        try:
            value_dict = json_utils.loads(value)
            # Extract the 'id' field from the JSON value as the name
            name = value_dict.get("id")
        except (json_utils.JSONDecodeError, AttributeError, TypeError):
            # If value is not valid JSON or doesn't have 'id', name remains None
            pass

        return {"value": value, "name": name}
