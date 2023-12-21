import pytest
from pytest_mock import MockFixture
from sqlalchemy.orm.session import Session

from superset.utils.core import DatasourceType


@pytest.fixture
def session_with_data(session: Session):
    from superset.connectors.sqla.models import SqlaTable, TableColumn
    from superset.models.core import Database
    from superset.models.dashboard import Dashboard
    from superset.models.slice import Slice
    from superset.models.sql_lab import Query, SavedQuery

    engine = session.get_bind()
    SqlaTable.metadata.create_all(engine)  # pylint: disable=no-member

    slice_obj = Slice(
        id=1,
        datasource_id=1,
        datasource_type=DatasourceType.TABLE,
        datasource_name="tmp_perm_table",
        slice_name="slice_name",
    )

    db = Database(database_name="my_database", sqlalchemy_uri="postgresql://")

    columns = [
        TableColumn(column_name="a", type="INTEGER"),
    ]

    saved_query = SavedQuery(label="test_query", database=db, sql="select * from foo")

    dashboard_obj = Dashboard(
        id=100,
        dashboard_title="test_dashboard",
        slug="test_slug",
        slices=[],
        published=True,
    )

    session.add(slice_obj)
    session.add(db)
    session.add(saved_query)
    session.add(dashboard_obj)
    session.commit()
    yield session


def test_create_command_success(session_with_data: Session, mocker: MockFixture):
    from superset.commands.tag.create import CreateCustomTagWithRelationshipsCommand
    from superset.connectors.sqla.models import SqlaTable
    from superset.daos.tag import TagDAO
    from superset.models.dashboard import Dashboard
    from superset.models.slice import Slice
    from superset.models.sql_lab import Query, SavedQuery
    from superset.tags.models import ObjectType, TaggedObject

    # Define a list of objects to tag
    query = session_with_data.query(SavedQuery).first()
    chart = session_with_data.query(Slice).first()
    dashboard = session_with_data.query(Dashboard).first()

    mocker.patch(
        "superset.security.SupersetSecurityManager.is_admin", return_value=True
    )
    mocker.patch("superset.daos.chart.ChartDAO.find_by_id", return_value=chart)
    mocker.patch("superset.daos.query.SavedQueryDAO.find_by_id", return_value=query)

    objects_to_tag = [
        (ObjectType.query, query.id),
        (ObjectType.chart, chart.id),
        (ObjectType.dashboard, dashboard.id),
    ]

    CreateCustomTagWithRelationshipsCommand(
        data={"name": "test_tag", "objects_to_tag": objects_to_tag}
    ).run()

    assert len(session_with_data.query(TaggedObject).all()) == len(objects_to_tag)
    for object_type, object_id in objects_to_tag:
        assert (
            session_with_data.query(TaggedObject)
            .filter(
                TaggedObject.object_type == object_type,
                TaggedObject.object_id == object_id,
            )
            .one_or_none()
            is not None
        )


def test_create_command_success_clear(session_with_data: Session, mocker: MockFixture):
    from superset.commands.tag.create import CreateCustomTagWithRelationshipsCommand
    from superset.connectors.sqla.models import SqlaTable
    from superset.daos.tag import TagDAO
    from superset.models.dashboard import Dashboard
    from superset.models.slice import Slice
    from superset.models.sql_lab import Query, SavedQuery
    from superset.tags.models import ObjectType, TaggedObject

    # Define a list of objects to tag
    query = session_with_data.query(SavedQuery).first()
    chart = session_with_data.query(Slice).first()
    dashboard = session_with_data.query(Dashboard).first()

    mocker.patch(
        "superset.security.SupersetSecurityManager.is_admin", return_value=True
    )
    mocker.patch("superset.daos.chart.ChartDAO.find_by_id", return_value=chart)
    mocker.patch("superset.daos.query.SavedQueryDAO.find_by_id", return_value=query)

    objects_to_tag = [
        (ObjectType.query, query.id),
        (ObjectType.chart, chart.id),
        (ObjectType.dashboard, dashboard.id),
    ]

    CreateCustomTagWithRelationshipsCommand(
        data={"name": "test_tag", "objects_to_tag": objects_to_tag}
    ).run()
    assert len(session_with_data.query(TaggedObject).all()) == len(objects_to_tag)

    CreateCustomTagWithRelationshipsCommand(
        data={"name": "test_tag", "objects_to_tag": []}
    ).run()

    assert len(session_with_data.query(TaggedObject).all()) == 0
