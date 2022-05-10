import pytest
from sqlalchemy.orm.session import Session


def create_test_data(session: Session):
    from superset.columns.models import Column
    from superset.connectors.sqla.models import SqlaTable, TableColumn
    from superset.models.core import Database
    from superset.models.sql_lab import Query, SavedQuery

    engine = session.get_bind()
    SqlaTable.metadata.create_all(engine)  # pylint: disable=no-member

    db = Database(database_name="my_database", sqlalchemy_uri="sqlite://")

    columns = [
        TableColumn(column_name="a", type="INTEGER"),
    ]

    sqla_table = SqlaTable(
        table_name="my_sqla_table",
        columns=columns,
        metrics=[],
        database=db,
    )

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

    saved_query = SavedQuery(database=db, sql="select * from foo")

    session.add(saved_query)
    session.add(query_obj)
    session.add(db)
    session.add(sqla_table)
    session.flush()


def test_get_datasource_sqlatable(app_context: None, session: Session) -> None:
    from superset.connectors.sqla.models import SqlaTable
    from superset.dao.datasource.dao import DatasourceDAO

    create_test_data(session)

    result = DatasourceDAO.get_datasource(
        datasource_type="table", datasource_id=1, session=session
    )

    assert 1 == result.id
    assert "my_sqla_table" == result.table_name
    assert isinstance(result, SqlaTable)


def test_get_datasource_query(app_context: None, session: Session) -> None:
    from superset.dao.datasource.dao import DatasourceDAO
    from superset.models.sql_lab import Query

    create_test_data(session)

    result = DatasourceDAO.get_datasource(
        datasource_type="query", datasource_id=1, session=session
    )

    assert result.id == 1
    assert isinstance(result, Query)


def test_get_datasource_saved_query(app_context: None, session: Session) -> None:
    from superset.dao.datasource.dao import DatasourceDAO
    from superset.models.sql_lab import SavedQuery

    create_test_data(session)

    result = DatasourceDAO.get_datasource(
        datasource_type="saved_query", datasource_id=1, session=session
    )

    assert result.id == 1
    assert isinstance(result, SavedQuery)


def test_get_datasource_sl_table(app_context: None, session: Session) -> None:
    pass


def test_get_datasource_sl_dataset(app_context: None, session: Session) -> None:
    pass
