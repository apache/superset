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
import json
from typing import Iterator

import pytest
from sqlalchemy.orm.session import Session


def test_query_dao_save_metadata(app_context: None, session: Session) -> None:
    from superset.models.core import Database
    from superset.models.sql_lab import Query

    engine = session.get_bind()
    Query.metadata.create_all(engine)  # pylint: disable=no-member

    db = Database(database_name="my_database", sqlalchemy_uri="sqlite://")

    query_obj = Query(
        client_id="foo",
        database=db,
        tab_name="test_tab",
        sql_editor_id="test_editor_id",
        sql="select * from bar",
        select_sql="select * from bar",
        executed_sql="select * from bar",
        limit=100,
        select_as_cta=False,
        rows=100,
        error_message="none",
        results_key="abc",
    )

    session.add(db)
    session.add(query_obj)

    from superset.queries.dao import QueryDAO

    query = session.query(Query).one()
    QueryDAO.save_metadata(query=query, payload={"columns": []})
    assert query.extra.get("columns", None) == []
