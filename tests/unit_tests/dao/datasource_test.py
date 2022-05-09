from sqlalchemy.orm.session import Session


def test_get_datasource(app_context: None, session: Session) -> None:
    from superset.columns.models import Column
    from superset.connectors.sqla.models import SqlaTable, TableColumn
    from superset.dao.datasource.dao import DatasourceDAO
    from superset.models.core import Database

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
    session.add(db)
    session.add(sqla_table)
    session.flush()

    result = DatasourceDAO.get_datasource(
        datasource_type="table", datasource_id=1, session=session
    )

    assert sqla_table.id == result.id
    assert sqla_table.table_name == "my_sqla_table"
