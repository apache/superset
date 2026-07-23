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
from __future__ import annotations

import logging
from typing import Any, TYPE_CHECKING

from flask import g

from superset import feature_flag_manager
from superset.utils.json import loads as json_loads

if TYPE_CHECKING:
    from superset.models.core import Database

logger = logging.getLogger(__name__)


def add_impersonation_cache_key_if_needed(
    database: Database,
    cache_dict: dict[str, Any],
) -> None:
    """
    Add a per-user cache-key when the DB connection is configured for
    per-user caching, no-op otherwise.
    """
    extra = json_loads(database.extra or "{}")
    if (
        (
            feature_flag_manager.is_feature_enabled("CACHE_IMPERSONATION")
            and database.impersonate_user
        )
        or feature_flag_manager.is_feature_enabled("CACHE_QUERY_BY_USER")
        or extra.get("per_user_caching", False)
    ):
        if key := database.db_engine_spec.get_impersonation_key(
            getattr(g, "user", None)
        ):
            logger.debug("Adding impersonation key to cache dict: %s", key)
            cache_dict["impersonation_key"] = key
