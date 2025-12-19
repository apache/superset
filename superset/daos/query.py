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
from datetime import datetime
from typing import Any, Union

from superset import sql_lab
from superset.common.db_query_status import QueryStatus
from superset.daos.base import BaseDAO
from superset.exceptions import QueryNotFoundException, SupersetCancelQueryException
from superset.extensions import db
from superset.models.sql_lab import Query, SavedQuery
from superset.queries.filters import QueryFilter
from superset.queries.saved_queries.filters import SavedQueryFilter
from superset.utils.core import get_user_id
from superset.utils.dates import now_as_float

logger = logging.getLogger(__name__)


class QueryDAO(BaseDAO[Query]):
    base_filter = QueryFilter

    @staticmethod
    def save_metadata(query: Query, payload: dict[str, Any]) -> None:
        # pull relevant data from payload and store in extra_json
        columns = payload.get("columns", {})
        for col in columns:
            if "name" in col:
                col["column_name"] = col.get("name")
        db.session.add(query)
        query.set_extra_json_key("columns", columns)

    @staticmethod
    def get_queries_changed_after(last_updated_ms: Union[float, int]) -> list[Query]:
        # UTC date time, same that is stored in the DB.
        last_updated_dt = datetime.utcfromtimestamp(last_updated_ms / 1000)

        return (
            db.session.query(Query)
            .filter(Query.user_id == get_user_id(), Query.changed_on >= last_updated_dt)
            .all()
        )

    @staticmethod
    def stop_query(client_id: str) -> None:
        query = db.session.query(Query).filter_by(client_id=client_id).one_or_none()
        if not query:
            raise QueryNotFoundException(f"Query with client_id {client_id} not found")

        if query.status in [
            QueryStatus.FAILED,
            QueryStatus.SUCCESS,
            QueryStatus.TIMED_OUT,
        ]:
            logger.warning(
                "Query with client_id could not be stopped: query already complete",
            )
            return

        if not sql_lab.cancel_query(query):
            raise SupersetCancelQueryException("Could not cancel query")

        query.status = QueryStatus.STOPPED
        query.end_time = now_as_float()


class SavedQueryDAO(BaseDAO[SavedQuery]):
    base_filter = SavedQueryFilter
