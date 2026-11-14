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
from datetime import datetime, timezone
from typing import Any, Union

from superset import sql_lab
from superset.common.db_query_status import QueryStatus
from superset.daos.base import BaseDAO
from superset.exceptions import QueryNotFoundException
from superset.extensions import db
from superset.models.sql_lab import Query, SavedQuery
from superset.queries.filters import QueryFilter
from superset.queries.saved_queries.filters import SavedQueryFilter
from superset.sql.execution.utils import finish_query_stop, set_query_stopped
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
        last_updated_dt: datetime = datetime.fromtimestamp(
            last_updated_ms / 1000, timezone.utc
        ).replace(tzinfo=None)

        return (
            db.session.query(Query)
            .filter(Query.user_id == get_user_id(), Query.changed_on >= last_updated_dt)
            .all()
        )

    @staticmethod
    def stop_query(client_id: str) -> Query:
        """Stop a query and return its recorded outcome, including a lost race."""
        query = (
            db.session.query(Query)
            .filter(Query.client_id == client_id, Query.user_id == get_user_id())
            .one_or_none()
        )
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
            return query

        with db.session.no_autoflush:
            if not set_query_stopped(query, now_as_float()):
                db.session.commit()  # pylint: disable=consider-using-transaction
                return query
            finish_query_stop(query, lambda: sql_lab.cancel_query(query))
        return query


class SavedQueryDAO(BaseDAO[SavedQuery]):
    base_filter = SavedQueryFilter

    @staticmethod
    def validate_label_uniqueness(
        label: str,
        owner_id: int | None,
        db_id: int | None,
        saved_query_id: int | None = None,
    ) -> bool:
        """
        Validate that no other saved query of the same owner and database uses
        this label. The comparison is exact on the label as stored.

        The check is best-effort: there is no database constraint behind it, so
        truly concurrent requests can still race and create a duplicate.

        :param label: The (already stripped) saved query label
        :param owner_id: The id of the user owning the saved query
        :param db_id: The id of the database the saved query targets
        :param saved_query_id: The saved query's own id, excluded from the
            comparison (only for validating on updates)
        :return: True when the label is not taken
        """
        query = db.session.query(SavedQuery).filter(
            SavedQuery.label == label,
            SavedQuery.created_by_fk == owner_id,
            SavedQuery.db_id.is_(None) if db_id is None else SavedQuery.db_id == db_id,
        )
        if saved_query_id is not None:
            query = query.filter(SavedQuery.id != saved_query_id)
        return not db.session.query(query.exists()).scalar()
