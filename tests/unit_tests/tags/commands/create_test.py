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
import pytest
from pytest_mock import MockerFixture
from sqlalchemy.orm.session import Session

from superset import db
from superset.utils.core import DatasourceType


@pytest.fixture
def session_with_data(session: Session):
    from superset.connectors.sqla.models import SqlaTable, TableColumn
    from superset.models.core import Database
    from superset.models.dashboard import Dashboard
    from superset.models.slice import Slice
    from superset.models.sql_lab import SavedQuery

    engine = session.get_bind()
    SqlaTable.metadata.create_all(engine)  # pylint: disable=no-member

    slice_obj = Slice(
        id=1,
        datasource_id=1,
        datasource_type=DatasourceType.TABLE,
        datasource_name="tmp_perm_table",
        slice_name="slice_name",
    )

    database = Database(database_name="my_database", sqlalchemy_uri="postgresql://")

    [  # noqa: F841
        TableColumn(column_name="a", type="INTEGER"),
    ]

    saved_query = SavedQuery(
        label="test_query", database=database, sql="select * from foo"
    )

    dashboard_obj = Dashboard(
        id=100,
        dashboard_title="test_dashboard",
        slug="test_slug",
        slices=[],
        published=True,
    )

    session.add(slice_obj)
    session.add(database)
    session.add(saved_query)
    session.add(dashboard_obj)
    session.commit()
    return session


def test_create_command_success(session_with_data: Session, mocker: MockerFixture):
    from superset.commands.tag.create import CreateCustomTagWithRelationshipsCommand
    from superset.models.dashboard import Dashboard
    from superset.models.slice import Slice
    from superset.models.sql_lab import SavedQuery
    from superset.tags.models import ObjectType, Tag, TaggedObject

    # Define a list of objects to tag
    query = db.session.query(SavedQuery).first()
    chart = db.session.query(Slice).first()
    dashboard = db.session.query(Dashboard).first()

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

    # Scope to the tag under test: with TAGGING_SYSTEM on, saving the fixture's
    # assets also mints implicit `type:` tags, so a global count is unstable.
    tag = db.session.query(Tag).filter_by(name="test_tag").one()
    assert len(db.session.query(TaggedObject).filter_by(tag_id=tag.id).all()) == len(
        objects_to_tag
    )
    for object_type, object_id in objects_to_tag:
        assert (
            db.session.query(TaggedObject)
            .filter(
                TaggedObject.tag_id == tag.id,
                TaggedObject.object_type == object_type,
                TaggedObject.object_id == object_id,
            )
            .one_or_none()
            is not None
        )


def test_validate_object_access_query_malformed_jinja(
    session_with_data: Session, mocker: MockerFixture
):
    """A saved query whose Jinja-templated SQL fails to parse during access
    checks must surface as a validation error, not an unhandled
    ``jinja2.TemplateError`` escaping as a 500.

    When ``raise_for_access(query=...)`` authorizes a saved query via
    per-table permissions it parses the query's Jinja SQL (e.g. an unclosed
    ``{% if %}`` block raises ``TemplateSyntaxError``). Mock that call to raise
    the ``TemplateError`` directly so the test stays hermetic and does not open
    a live DB connection to introspect table-level perms.
    """
    from jinja2.exceptions import TemplateError

    from superset.commands.tag.create import CreateCustomTagCommand
    from superset.commands.tag.exceptions import TagInvalidError
    from superset.models.sql_lab import SavedQuery
    from superset.tags.models import ObjectType

    query = db.session.query(SavedQuery).first()

    mocker.patch("superset.commands.tag.create.to_object_model", return_value=query)
    mocker.patch(
        "superset.commands.tag.create.security_manager.raise_for_access",
        side_effect=TemplateError("unclosed {% if %}"),
    )

    command = CreateCustomTagCommand(ObjectType.query, query.id, ["tag"])

    with pytest.raises(TagInvalidError):
        command.validate()


def test_validate_object_access_query_unresolvable_partition_macro(
    session_with_data: Session, mocker: MockerFixture
):
    """A saved query whose partition macro cannot be resolved statically raises
    ``SupersetParseError`` during access checks. Like ``TemplateError``, it is a
    sibling of ``SupersetSecurityException`` under ``SupersetErrorException`` and
    would otherwise escape as an unhandled 500, so it must also surface as a
    validation error.

    Mock ``raise_for_access`` to raise the error directly so the test stays
    hermetic and does not open a live DB connection to introspect table perms.
    """
    from superset.commands.tag.create import CreateCustomTagCommand
    from superset.commands.tag.exceptions import TagInvalidError
    from superset.exceptions import SupersetParseError
    from superset.models.sql_lab import SavedQuery
    from superset.tags.models import ObjectType

    query = db.session.query(SavedQuery).first()

    mocker.patch("superset.commands.tag.create.to_object_model", return_value=query)
    mocker.patch(
        "superset.commands.tag.create.security_manager.raise_for_access",
        side_effect=SupersetParseError(
            sql="select * from {{ latest_partition('foo') }}",
            message="Unresolvable partition macro",
        ),
    )

    command = CreateCustomTagCommand(ObjectType.query, query.id, ["tag"])

    with pytest.raises(TagInvalidError):
        command.validate()


def test_create_command_success_clear(
    session_with_data: Session, mocker: MockerFixture
):
    from superset.commands.tag.create import CreateCustomTagWithRelationshipsCommand
    from superset.models.dashboard import Dashboard
    from superset.models.slice import Slice
    from superset.models.sql_lab import SavedQuery
    from superset.tags.models import ObjectType, Tag, TaggedObject

    # Define a list of objects to tag
    query = db.session.query(SavedQuery).first()
    chart = db.session.query(Slice).first()
    dashboard = db.session.query(Dashboard).first()

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
    tag = db.session.query(Tag).filter_by(name="test_tag").one()
    assert len(db.session.query(TaggedObject).filter_by(tag_id=tag.id).all()) == len(
        objects_to_tag
    )

    CreateCustomTagWithRelationshipsCommand(
        data={"name": "test_tag", "objects_to_tag": []}
    ).run()

    assert len(db.session.query(TaggedObject).filter_by(tag_id=tag.id).all()) == 0
