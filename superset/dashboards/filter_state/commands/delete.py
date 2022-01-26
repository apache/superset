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
from superset.dashboards.dao import DashboardDAO
from superset.extensions import cache_manager
from superset.key_value.commands.delete import DeleteKeyValueCommand
from superset.key_value.commands.entry import Entry
from superset.key_value.commands.exceptions import KeyValueAccessDeniedError
from superset.key_value.commands.parameters import CommandParameters
from superset.key_value.utils import cache_key


class DeleteFilterStateCommand(DeleteKeyValueCommand):
    def delete(self, cmd_params: CommandParameters) -> bool:
        resource_id = cmd_params.resource_id
        actor = cmd_params.actor
        key = cache_key(resource_id, cmd_params.key)
        dashboard = DashboardDAO.get_by_id_or_slug(str(resource_id))
        if dashboard:
            entry: Entry = cache_manager.filter_state_cache.get(key)
            if entry:
                if entry["owner"] != actor.get_user_id():
                    raise KeyValueAccessDeniedError()
                return cache_manager.filter_state_cache.delete(key)
        return False
