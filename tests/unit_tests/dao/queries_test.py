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
    QueryDAO.save_metadata(query=query, query_payload=json.dumps({"columns": []}))
    assert query.extra.get("columns", None) == []
