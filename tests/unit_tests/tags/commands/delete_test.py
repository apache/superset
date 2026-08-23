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
from jinja2.exceptions import TemplateSyntaxError
from pytest_mock import MockerFixture
from sqlalchemy.orm.session import Session


@pytest.fixture
def session_with_data(session: Session):
    from superset.models.core import Database
    from superset.models.sql_lab import SavedQuery
    from superset.tags.models import ObjectType, Tag, TaggedObject

    engine = session.get_bind()
    Tag.metadata.create_all(engine)  # pylint: disable=no-member

    database = Database(database_name="my_database", sqlalchemy_uri="postgresql://")

    saved_query = SavedQuery(
        id=1, label="test_query", database=database, sql="select {{ unclosed"
    )

    tag = Tag(name="test_name", description="test_description")

    session.add(database)
    session.add(saved_query)
    session.add(tag)
    session.commit()

    session.add(
        TaggedObject(object_id=saved_query.id, object_type=ObjectType.query, tag=tag)
    )
    session.commit()

    return session


def test_delete_command_query_template_error_becomes_validation_error(
    session_with_data: Session, mocker: MockerFixture
):
    """Regression test: a Jinja ``TemplateError`` raised while authorizing a
    query must surface as ``TagInvalidError`` (422), not an opaque 500.

    ``raise_for_access`` is mocked directly so the test stays hermetic and does
    not depend on a live database to reach ``process_jinja_sql``.
    """
    from superset.commands.tag.delete import DeleteTaggedObjectCommand
    from superset.commands.tag.exceptions import TagInvalidError
    from superset.models.sql_lab import SavedQuery
    from superset.tags.models import ObjectType

    query = session_with_data.query(SavedQuery).first()

    template_error_message = "unexpected end of template"
    mocker.patch(
        "superset.security.SupersetSecurityManager.raise_for_access",
        side_effect=TemplateSyntaxError(template_error_message, lineno=1),
    )

    with pytest.raises(TagInvalidError) as excinfo:
        DeleteTaggedObjectCommand(
            object_type=ObjectType.query,
            object_id=query.id,
            tag="test_name",
        ).validate()

    # The real template error text must be preserved in the collected exceptions
    collected = " ".join(
        str(ex)
        for ex in excinfo.value._exceptions  # noqa: SLF001
    )
    assert template_error_message in collected
