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
from typing import Any, Optional

from flask import current_app as app

from superset.commands.dashboard.filter_state.utils import check_access
from superset.commands.temporary_cache.get import GetTemporaryCacheCommand
from superset.commands.temporary_cache.parameters import CommandParameters
from superset.daos.dashboard import DashboardDAO
from superset.extensions import cache_manager
from superset.temporary_cache.utils import cache_key
from superset.utils import json


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

    @staticmethod
    def get_filter_names(resource_id: int, value: Optional[str]) -> dict[str, str]:
        """
        Cross-reference the filter ids present in a cached filter_state
        ``value`` (a ``DataMaskStateWithId``, i.e. a map keyed by filter id)
        against the dashboard's ``native_filter_configuration`` to build a
        map of filter id -> human-readable filter label.

        The cached blob itself has no notion of a filter's label: that only
        lives in the dashboard's filter configuration metadata (#36053).
        """
        if not value:
            return {}
        try:
            parsed_value = json.loads(value)
        except (json.JSONDecodeError, TypeError):
            return {}
        if not isinstance(parsed_value, dict):
            return {}

        dashboard = DashboardDAO.get_by_id_or_slug(str(resource_id))
        try:
            metadata = json.loads(dashboard.json_metadata or "{}")
        except (json.JSONDecodeError, TypeError):
            return {}
        if not isinstance(metadata, dict):
            return {}

        native_filters: list[dict[str, Any]] = (
            metadata.get("native_filter_configuration") or []
        )
        id_to_name = {
            native_filter["id"]: native_filter["name"]
            for native_filter in native_filters
            if isinstance(native_filter, dict)
            and native_filter.get("id") is not None
            and native_filter.get("name") is not None
        }

        return {
            filter_id: id_to_name[filter_id]
            for filter_id in parsed_value
            if filter_id in id_to_name
        }
