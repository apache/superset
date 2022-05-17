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
from typing import Any, Dict

from superset.dao.base import BaseDAO
from superset.extensions import db
from superset.models.sql_lab import Query, SavedQuery
from superset.queries.filters import QueryFilter

logger = logging.getLogger(__name__)


class QueryDAO(BaseDAO):
    model_cls = Query
    base_filter = QueryFilter

    @staticmethod
    def update_saved_query_exec_info(query_id: int) -> None:
        """
        Propagates query execution info back to saved query if applicable

        :param query_id: The query id
        :return:
        """
        query = db.session.query(Query).get(query_id)
        related_saved_queries = (
            db.session.query(SavedQuery)
            .filter(SavedQuery.database == query.database)
            .filter(SavedQuery.sql == query.sql)
        ).all()
        if related_saved_queries:
            for saved_query in related_saved_queries:
                saved_query.rows = query.rows
                saved_query.last_run = datetime.now()
            db.session.commit()

    @staticmethod
    def save_metadata(query: Query, payload: Dict[str, Any]) -> None:
        # pull relevant data from payload and store in extra_json
        columns = payload.get("columns", {})
        db.session.add(query)
        query.set_extra_json_key("columns", columns)
