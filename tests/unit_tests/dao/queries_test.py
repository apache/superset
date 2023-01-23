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
from datetime import datetime, timedelta
from typing import Any, Iterator

import pytest
from pytest_mock import MockFixture
from sqlalchemy.orm.session import Session

from superset.exceptions import QueryNotFoundException, SupersetCancelQueryException


def test_query_dao_save_metadata(session: Session) -> None:
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


def test_query_dao_get_queries_changed_after(session: Session) -> None:
    from superset.models.core import Database
    from superset.models.sql_lab import Query

    engine = session.get_bind()
    Query.metadata.create_all(engine)  # pylint: disable=no-member

    db = Database(database_name="my_database", sqlalchemy_uri="sqlite://")

    now = datetime.utcnow()

    old_query_obj = Query(
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
        changed_on=now - timedelta(days=3),
    )

    updated_query_obj = Query(
        client_id="updated_foo",
        database=db,
        tab_name="test_tab",
        sql_editor_id="test_editor_id",
        sql="select * from foo",
        select_sql="select * from foo",
        executed_sql="select * from foo",
        limit=100,
        select_as_cta=False,
        rows=100,
        error_message="none",
        results_key="abc",
        changed_on=now - timedelta(days=1),
    )

    session.add(db)
    session.add(old_query_obj)
    session.add(updated_query_obj)

    from superset.queries.dao import QueryDAO

    timestamp = datetime.timestamp(now - timedelta(days=2)) * 1000
    result = QueryDAO.get_queries_changed_after(timestamp)
    assert len(result) == 1
    assert result[0].client_id == "updated_foo"


def test_query_dao_stop_query_not_found(
    mocker: MockFixture, app: Any, session: Session
) -> None:
    from superset.common.db_query_status import QueryStatus
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
        status=QueryStatus.RUNNING,
    )

    session.add(db)
    session.add(query_obj)

    mocker.patch("superset.sql_lab.cancel_query", return_value=False)

    from superset.queries.dao import QueryDAO

    with pytest.raises(QueryNotFoundException):
        QueryDAO.stop_query("foo2")

    query = session.query(Query).one()
    assert query.status == QueryStatus.RUNNING


def test_query_dao_stop_query_not_running(
    mocker: MockFixture, app: Any, session: Session
) -> None:
    from superset.common.db_query_status import QueryStatus
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
        status=QueryStatus.FAILED,
    )

    session.add(db)
    session.add(query_obj)

    from superset.queries.dao import QueryDAO

    QueryDAO.stop_query(query_obj.client_id)
    query = session.query(Query).one()
    assert query.status == QueryStatus.FAILED


def test_query_dao_stop_query_failed(
    mocker: MockFixture, app: Any, session: Session
) -> None:
    from superset.common.db_query_status import QueryStatus
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
        status=QueryStatus.RUNNING,
    )

    session.add(db)
    session.add(query_obj)

    mocker.patch("superset.sql_lab.cancel_query", return_value=False)

    from superset.queries.dao import QueryDAO

    with pytest.raises(SupersetCancelQueryException):
        QueryDAO.stop_query(query_obj.client_id)

    query = session.query(Query).one()
    assert query.status == QueryStatus.RUNNING


def test_query_dao_stop_query(mocker: MockFixture, app: Any, session: Session) -> None:
    from superset.common.db_query_status import QueryStatus
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
        status=QueryStatus.RUNNING,
    )

    session.add(db)
    session.add(query_obj)

    mocker.patch("superset.sql_lab.cancel_query", return_value=True)

    from superset.queries.dao import QueryDAO

    QueryDAO.stop_query(query_obj.client_id)
    query = session.query(Query).one()
    assert query.status == QueryStatus.STOPPED
