import pytest
from sqlalchemy.orm.session import Session

from superset.utils.core import DatasourceType


@pytest.fixture
def session_with_data(session: Session):
    from superset.connectors.sqla.models import SqlaTable, TableColumn
    from superset.models.core import Database
    from superset.models.sql_lab import Query, SavedQuery
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

    saved_query = SavedQuery(database=db, sql="select * from foo")

    session.add(db)
    session.add(saved_query)
    session.add(sqla_table)
    session.flush()
    yield session

def test_create_command_success(session_with_data: Session):
    from superset.models.slice import Slice
    from superset.models.sql_lab import Query, SavedQuery
    from superset.tags.commands.create import CreateCustomTagWithRelationshipsCommand

    # Define a list of objects to tag
    query = session_with_data.query(SavedQuery).first()
    chart = session_with_data.query(Slice).first()
    dataset = session_with_data.query(SqlaTable).first()

    objects_to_tag = [
        (ObjectTypes.query, query.id),
        (ObjectTypes.chart, chart.id),
        (ObjectTypes.dashboard, dataset.id)
    ]

    CreateCustomTagWithRelationshipsCommand(objects_to_tag=objects_to_tag, tag="test_tag")



def test_create_command_failed_validate():
    pass

def test_create_command_failed():
    pass