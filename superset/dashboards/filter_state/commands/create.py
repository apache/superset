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
from typing import cast
import logging
from flask import session

from superset.dashboards.filter_state.commands.utils import check_access
from superset.extensions import cache_manager
from superset.key_value.utils import random_key
from superset.temporary_cache.commands.create import CreateTemporaryCacheCommand
from superset.temporary_cache.commands.entry import Entry
from superset.temporary_cache.commands.parameters import CommandParameters
from superset.temporary_cache.utils import cache_key
from superset.utils.core import get_user_id


logger = logging.getLogger(__name__)


class CreateFilterStateCommand(CreateTemporaryCacheCommand):
    def create(self, cmd_params: CommandParameters) -> str:
        logger.error("CreateFilterStateCommand.create")
        resource_id = cmd_params.resource_id
        logger.error(f"resource_id = {resource_id}")
        tab_id = cmd_params.tab_id
        logger.error(f"tab_id = {tab_id}")
        contextual_key = cache_key(session.get("_id"), tab_id, resource_id)
        logger.error(f"contextual_key = {contextual_key}")
        key = cache_manager.filter_state_cache.get(contextual_key)
        logger.debug(f"key = {key}")
        if not key or not tab_id:
            logger.debug(f"we dont have key or tab_id")
            key = random_key()
            logger.debug(f"new_key = {key}")
        value = cast(str, cmd_params.value)  # schema ensures that value is not optional
        logger.debug(f"value = {value}")
        check_access(resource_id)
        logger.debug(f"after check_access")
        entry: Entry = {"owner": get_user_id(), "value": value}
        logger.debug(f"entry = {entry.items()}")
        cache_manager.filter_state_cache.set(cache_key(resource_id, key), entry)
        logger.debug(f"after filter_state_cache-1")
        cache_manager.filter_state_cache.set(contextual_key, key)
        logger.debug(f"after filter_state_cache-2")        
        return key
