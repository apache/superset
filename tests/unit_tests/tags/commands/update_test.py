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
    from superset.tags.models import Tag

    engine = session.get_bind()
    Tag.metadata.create_all(engine)  # pylint: disable=no-member

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

    sqla_table = SqlaTable(
        table_name="my_sqla_table",
        columns=columns,
        metrics=[],
        database=db,
    )

    dashboard_obj = Dashboard(
        id=100,
        dashboard_title="test_dashboard",
        slug="test_slug",
        slices=[],
        published=True,
    )

    saved_query = SavedQuery(label="test_query", database=db, sql="select * from foo")

    tag = Tag(name="test_name", description="test_description")

    session.add(slice_obj)
    session.add(dashboard_obj)
    session.add(tag)
    session.commit()
    yield session


def test_update_command_success(session_with_data: Session, mocker: MockFixture):
    from superset.commands.tag.update import UpdateTagCommand
    from superset.daos.tag import TagDAO
    from superset.models.dashboard import Dashboard
    from superset.tags.models import ObjectType, TaggedObject

    dashboard = session_with_data.query(Dashboard).first()
    mocker.patch(
        "superset.security.SupersetSecurityManager.is_admin", return_value=True
    )
    mocker.patch(
        "superset.daos.dashboard.DashboardDAO.find_by_id", return_value=dashboard
    )

    objects_to_tag = [
        (ObjectType.dashboard, dashboard.id),
    ]

    tag_to_update = TagDAO.find_by_name("test_name")
    changed_model = UpdateTagCommand(
        tag_to_update.id,
        {
            "name": "new_name",
            "description": "new_description",
            "objects_to_tag": objects_to_tag,
        },
    ).run()

    updated_tag = TagDAO.find_by_name("new_name")
    assert updated_tag is not None
    assert updated_tag.description == "new_description"
    assert len(session_with_data.query(TaggedObject).all()) == len(objects_to_tag)


def test_update_command_success_duplicates(
    session_with_data: Session, mocker: MockFixture
):
    from superset.commands.tag.create import CreateCustomTagWithRelationshipsCommand
    from superset.commands.tag.update import UpdateTagCommand
    from superset.daos.tag import TagDAO
    from superset.models.dashboard import Dashboard
    from superset.models.slice import Slice
    from superset.tags.models import ObjectType, TaggedObject

    dashboard = session_with_data.query(Dashboard).first()
    chart = session_with_data.query(Slice).first()

    mocker.patch(
        "superset.security.SupersetSecurityManager.is_admin", return_value=True
    )
    mocker.patch("superset.daos.chart.ChartDAO.find_by_id", return_value=chart)
    mocker.patch(
        "superset.daos.dashboard.DashboardDAO.find_by_id", return_value=dashboard
    )

    objects_to_tag = [
        (ObjectType.dashboard, dashboard.id),
    ]

    CreateCustomTagWithRelationshipsCommand(
        data={"name": "test_tag", "objects_to_tag": objects_to_tag}
    ).run()

    tag_to_update = TagDAO.find_by_name("test_tag")

    objects_to_tag = [
        (ObjectType.chart, chart.id),
    ]
    changed_model = UpdateTagCommand(
        tag_to_update.id,
        {
            "name": "new_name",
            "description": "new_description",
            "objects_to_tag": objects_to_tag,
        },
    ).run()

    updated_tag = TagDAO.find_by_name("new_name")
    assert updated_tag is not None
    assert updated_tag.description == "new_description"
    assert len(session_with_data.query(TaggedObject).all()) == len(objects_to_tag)
    assert changed_model.objects[0].object_id == chart.id


def test_update_command_failed_validation(
    session_with_data: Session, mocker: MockFixture
):
    from superset.commands.tag.create import CreateCustomTagWithRelationshipsCommand
    from superset.commands.tag.exceptions import TagInvalidError
    from superset.commands.tag.update import UpdateTagCommand
    from superset.daos.tag import TagDAO
    from superset.models.dashboard import Dashboard
    from superset.models.slice import Slice
    from superset.tags.models import ObjectType

    dashboard = session_with_data.query(Dashboard).first()
    chart = session_with_data.query(Slice).first()
    objects_to_tag = [
        (ObjectType.chart, chart.id),
    ]

    mocker.patch(
        "superset.security.SupersetSecurityManager.is_admin", return_value=True
    )
    mocker.patch("superset.daos.chart.ChartDAO.find_by_id", return_value=chart)
    mocker.patch(
        "superset.daos.dashboard.DashboardDAO.find_by_id", return_value=dashboard
    )

    CreateCustomTagWithRelationshipsCommand(
        data={"name": "test_tag", "objects_to_tag": objects_to_tag}
    ).run()

    tag_to_update = TagDAO.find_by_name("test_tag")

    objects_to_tag = [
        (0, dashboard.id),  # type: ignore
    ]

    with pytest.raises(TagInvalidError):
        UpdateTagCommand(
            tag_to_update.id,
            {
                "name": "new_name",
                "description": "new_description",
                "objects_to_tag": objects_to_tag,
            },
        ).run()
