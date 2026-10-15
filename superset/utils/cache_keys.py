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
    # The embedded fallback credential replaces the connection identity *without*
    # going through impersonation (`Database._get_sqla_engine`), so none of the
    # conditions below would notice it. Its result must never share a DATA-cache
    # entry -- nor, since the async `task_key` is the query cache key, a SHARED
    # chart task -- with a logged-in user's per-user OAuth2 result. That is
    # correctness rather than a caching preference, so it is checked ahead of, and
    # independently of, the opt-in flags.
    #
    # The engine spec owns the key material -- see
    # `BaseEngineSpec.get_embedded_credential_cache_key` for why it is keyed on the
    # configured identity rather than on `g.user.username`.
    # A separate field prevents collisions with a logged-in username that equals
    # the engine-provided guest key.
    if embedded_credentials := database.get_embedded_fallback_credentials():
        cache_dict["embedded_credentials_key"] = (
            database.db_engine_spec.get_embedded_credential_cache_key(
                embedded_credentials
            )
        )
        return

    if (
        database.embedded_fallback_applies()
        or database.embedded_guest_missing_oauth2_client()
    ):
        # Missing credentials -- or a missing OAuth2 client, as after an import --
        # must not allow a warm logged-in cache entry to bypass the refusal at engine
        # creation. Use a separate marker so it cannot collide with an engine's
        # configured credential identity or a user's username.
        cache_dict["embedded_credentials_missing"] = True
        return

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
