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
from typing import Any, Dict, Optional

from superset import db, is_feature_enabled
from superset.databases.dao import DatabaseDAO
from superset.models.sql_lab import Query, TabState

DATABASE_KEYS = [
    "allow_file_upload",
    "allow_ctas",
    "allow_cvas",
    "allow_dml",
    "allow_run_async",
    "allows_subquery",
    "backend",
    "database_name",
    "expose_in_sqllab",
    "force_ctas_schema",
    "id",
    "disable_data_preview",
]


def _get_sqllab_tabs(user_id: Optional[int]) -> Dict[str, Any]:
    # send list of tab state ids
    tabs_state = (
        db.session.query(TabState.id, TabState.label).filter_by(user_id=user_id).all()
    )
    tab_state_ids = [str(tab_state[0]) for tab_state in tabs_state]
    # return first active tab, or fallback to another one if no tab is active
    active_tab = (
        db.session.query(TabState)
        .filter_by(user_id=user_id)
        .order_by(TabState.active.desc())
        .first()
    )

    databases: Dict[int, Any] = {}
    for database in DatabaseDAO.find_all():
        databases[database.id] = {
            k: v for k, v in database.to_json().items() if k in DATABASE_KEYS
        }
        databases[database.id]["backend"] = database.backend
    queries: Dict[str, Any] = {}

    # These are unnecessary if sqllab backend persistence is disabled
    if is_feature_enabled("SQLLAB_BACKEND_PERSISTENCE"):
        # return all user queries associated with existing SQL editors
        user_queries = (
            db.session.query(Query)
            .filter_by(user_id=user_id)
            .filter(Query.sql_editor_id.in_(tab_state_ids))
            .all()
        )
        queries = {
            query.client_id: dict(query.to_dict().items()) for query in user_queries
        }

    return {
        "tab_state_ids": tabs_state,
        "active_tab": active_tab.to_dict() if active_tab else None,
        "databases": databases,
        "queries": queries,
    }
