import copy
from pytest_mock import MockFixture
from sqlalchemy.orm.session import Session
from superset.tags.models import ObjectTypes, TaggedObject
from superset.tags.utils import add_custom_object_tags, update_custom_object_tags, validate_custom_tags


def test_add_custom_object_tags(
    mocker: MockFixture,
    session: Session,
) -> None:
    from superset import security_manager
    from superset.connectors.sqla.models import SqlaTable
    from superset.datasets.commands.importers.v1.utils import import_dataset
    from superset.models.core import Database
    from tests.integration_tests.fixtures.importexport import dataset_config
    # create a dataset
    mocker.patch.object(security_manager, "can_access", return_value=True)

    engine = session.get_bind()
    SqlaTable.metadata.create_all(engine)  # pylint: disable=no-member

    database = Database(database_name="my_database", sqlalchemy_uri="sqlite://")
    session.add(database)
    session.flush()

    config = copy.deepcopy(dataset_config)
    config["database_id"] = database.id

    sqla_table = import_dataset(session, config)
    
    add_custom_object_tags(
        tags=['test_tag1', 'test_tag2'],
        object_type=ObjectTypes.dataset,
        object_id=sqla_table.id
    )
    
    tags = session.query(TaggedObject).filter(
                TaggedObject.object_id == sqla_table.id,
                TaggedObject.object_type == ObjectTypes.dataset,
            ).all()

    assert len(tags) == 2

    # attempt to add duplicates

    add_custom_object_tags(
        tags=['test_tag1', 'test_tag2'],
        object_type=ObjectTypes.dataset,
        object_id=sqla_table.id
    )
    tags = session.query(TaggedObject).filter(
                TaggedObject.object_id == sqla_table.id,
                TaggedObject.object_type == ObjectTypes.dataset,
            ).all()

    assert len(tags) == 2

    # add different custom tags

    add_custom_object_tags(
        tags=['test_tag3', 'test_tag4'],
        object_type=ObjectTypes.dataset,
        object_id=sqla_table.id
    )
    tags = session.query(TaggedObject).filter(
                TaggedObject.object_id == sqla_table.id,
                TaggedObject.object_type == ObjectTypes.dataset,
            ).all()
    
    assert len(tags) == 4


def test_update_custom_object_tags(
    mocker: MockFixture,
    session: Session,
) -> None:
    from superset import security_manager
    from superset.connectors.sqla.models import SqlaTable
    from superset.datasets.commands.importers.v1.utils import import_dataset
    from superset.models.core import Database
    from tests.integration_tests.fixtures.importexport import dataset_config
    # create a dataset
    mocker.patch.object(security_manager, "can_access", return_value=True)

    engine = session.get_bind()
    SqlaTable.metadata.create_all(engine)  # pylint: disable=no-member

    database = Database(database_name="my_database", sqlalchemy_uri="sqlite://")
    session.add(database)
    session.flush()

    config = copy.deepcopy(dataset_config)
    config["database_id"] = database.id

    sqla_table = import_dataset(session, config)
    
    # add some tags using update tags
    update_custom_object_tags(
        tags=['test_tag1', 'test_tag2'],
        object_type=ObjectTypes.dataset,
        object_id=sqla_table.id
    )

    tags = session.query(TaggedObject).filter(
                TaggedObject.object_id == sqla_table.id,
                TaggedObject.object_type == ObjectTypes.dataset,
            ).all()

    assert len(tags) == 2

    # attempt to add duplicates
    update_custom_object_tags(
        tags=['test_tag1', 'test_tag2'],
        object_type=ObjectTypes.dataset,
        object_id=sqla_table.id
    )
    tags = session.query(TaggedObject).filter(
                TaggedObject.object_id == sqla_table.id,
                TaggedObject.object_type == ObjectTypes.dataset,
            ).all()

    assert len(tags) == 2

    # add more custom tags
    update_custom_object_tags(
        tags=['test_tag3', 'test_tag4'],
        object_type=ObjectTypes.dataset,
        object_id=sqla_table.id
    )
    tags = session.query(TaggedObject).filter(
                TaggedObject.object_id == sqla_table.id,
                TaggedObject.object_type == ObjectTypes.dataset,
            ).all()
    
    assert len(tags) == 4

    # add duplicate custom tags with overwrite on
    update_custom_object_tags(
        tags=['test_tag1', 'test_tag2'],
        object_type=ObjectTypes.dataset,
        object_id=sqla_table.id,
        overwrite=True
    )
    tags = session.query(TaggedObject).filter(
                TaggedObject.object_id == sqla_table.id,
                TaggedObject.object_type == ObjectTypes.dataset,
            ).all()

    assert len(tags) == 2

    # add new custom tags with overwrite on
    update_custom_object_tags(
        tags=['test_tag5', 'test_tag6'],
        object_type=ObjectTypes.dataset,
        object_id=sqla_table.id,
        overwrite=True
    )
    tags = session.query(TaggedObject).filter(
                TaggedObject.object_id == sqla_table.id,
                TaggedObject.object_type == ObjectTypes.dataset,
            ).all()

    assert len(tags) == 2

def test_validate_custom_tags():
    fail_tags = ['tag:1', 'tag:2', 'tag3']
    pass_tags = ['tag1', "tag2", 'tag3']

    assert not validate_custom_tags(fail_tags)
    assert validate_custom_tags(pass_tags)
