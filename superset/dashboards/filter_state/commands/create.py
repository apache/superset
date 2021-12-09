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

from flask_appbuilder.security.sqla.models import User

from superset.dashboards.dao import DashboardDAO
from superset.dashboards.filter_state.commands.entry import Entry
from superset.extensions import cache_manager
from superset.key_value.commands.create import CreateKeyValueCommand
from superset.key_value.utils import cache_key


class CreateFilterStateCommand(CreateKeyValueCommand):
    def create(
        self, actor: User, resource_id: int, key: str, value: str
    ) -> Optional[bool]:
        dashboard = DashboardDAO.get_by_id_or_slug(str(resource_id))
        if dashboard:
            entry: Entry = {"owner": actor.get_user_id(), "value": value}
            return cache_manager.filter_state_cache.set(
                cache_key(resource_id, key), entry
            )
        return False
