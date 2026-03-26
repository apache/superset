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

"""
MCP-specific form data command that extends the base CreateFormDataCommand
"""

from sqlalchemy.exc import SQLAlchemyError

from superset.commands.explore.form_data.create import CreateFormDataCommand
from superset.commands.explore.form_data.state import TemporaryExploreState
from superset.commands.explore.form_data.utils import check_access
from superset.commands.temporary_cache.exceptions import TemporaryCacheCreateFailedError
from superset.extensions import cache_manager
from superset.key_value.utils import random_key
from superset.temporary_cache.utils import cache_key
from superset.utils.core import DatasourceType, get_user_id


class MCPCreateFormDataCommand(CreateFormDataCommand):
    """
    MCP-specific CreateFormDataCommand that avoids Flask request context.

    The base class calls flask.session.get("_id") inside run(), which requires
    an active HTTP request context. MCP tools execute outside of any HTTP
    request, so calling the base run() raises "Working outside of request
    context". This override replaces the session ID with get_user_id(), which
    is available via Flask g and does not require a request context.
    """

    def run(self) -> str:
        self.validate()
        try:
            datasource_id = self._cmd_params.datasource_id
            datasource_type = self._cmd_params.datasource_type
            chart_id = self._cmd_params.chart_id
            tab_id = self._cmd_params.tab_id
            form_data = self._cmd_params.form_data
            check_access(datasource_id, chart_id, datasource_type)
            # Use user_id in place of flask.session.get("_id"). The session ID
            # is only used as part of a cache key for contextual form data
            # deduplication; substituting the user ID preserves that behaviour
            # without requiring an HTTP request context.
            session_id = str(get_user_id())
            contextual_key = cache_key(
                session_id, tab_id, datasource_id, chart_id, datasource_type
            )
            key = cache_manager.explore_form_data_cache.get(contextual_key)
            if not key or not tab_id:
                key = random_key()
            if form_data:
                state: TemporaryExploreState = {
                    "owner": get_user_id(),
                    "datasource_id": datasource_id,
                    "datasource_type": DatasourceType(datasource_type),
                    "chart_id": chart_id,
                    "form_data": form_data,
                }
                cache_manager.explore_form_data_cache.set(key, state)
                cache_manager.explore_form_data_cache.set(contextual_key, key)
            return key
        except SQLAlchemyError as ex:
            raise TemporaryCacheCreateFailedError() from ex
