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
from unittest.mock import PropertyMock

import pytest
from pytest_mock import MockerFixture
from sqlalchemy.orm.session import Session

from superset import db


@pytest.fixture
def session_with_tags(session: Session):
    from flask_appbuilder.security.sqla.models import User

    from superset.tags.models import Tag, TagType

    engine = session.get_bind()
    Tag.metadata.create_all(engine)  # pylint: disable=no-member
    User.metadata.create_all(engine)  # pylint: disable=no-member

    owner = User(
        first_name="owner", last_name="owner", username="owner", email="owner@x.com"
    )
    other = User(
        first_name="other", last_name="other", username="other", email="other@x.com"
    )
    session.add(owner)
    session.add(other)
    session.flush()

    owned_tag = Tag(
        name="owned_tag",
        type=TagType.custom,
        created_by_fk=owner.id,
        created_by=owner,
    )
    system_tag = Tag(name="type:some_type", type=TagType.type)

    session.add(owned_tag)
    session.add(system_tag)
    session.commit()
    return session


def test_delete_tags_command_admin_can_delete_any_custom_tag(
    session_with_tags: Session, mocker: MockerFixture
):
    from superset.commands.tag.delete import DeleteTagsCommand
    from superset.tags.models import Tag

    mocker.patch(
        "superset.security.SupersetSecurityManager.is_admin", return_value=True
    )

    DeleteTagsCommand(["owned_tag"]).run()

    assert db.session.query(Tag).filter_by(name="owned_tag").one_or_none() is None


def test_delete_tags_command_creator_can_delete_own_tag(
    session_with_tags: Session, mocker: MockerFixture
):
    from flask_appbuilder.security.sqla.models import User

    from superset.commands.tag.delete import DeleteTagsCommand
    from superset.tags.models import Tag

    owner = db.session.query(User).filter_by(username="owner").one()

    mocker.patch(
        "superset.security.SupersetSecurityManager.is_admin", return_value=False
    )
    mocker.patch(
        "superset.security.SupersetSecurityManager.current_user",
        new_callable=PropertyMock,
        return_value=owner,
    )

    DeleteTagsCommand(["owned_tag"]).run()

    assert db.session.query(Tag).filter_by(name="owned_tag").one_or_none() is None


def test_delete_tags_command_non_creator_non_admin_denied(
    session_with_tags: Session, mocker: MockerFixture
):
    """Regression test: DeleteTagsCommand.validate previously checked only
    that each named tag existed, letting any user with can_delete on Tag
    (default Gamma) bulk-delete tags -- and every association they carry --
    they neither created nor own.
    """
    from flask_appbuilder.security.sqla.models import User

    from superset.commands.tag.delete import DeleteTagsCommand
    from superset.commands.tag.exceptions import TagInvalidError
    from superset.tags.models import Tag

    other = db.session.query(User).filter_by(username="other").one()

    mocker.patch(
        "superset.security.SupersetSecurityManager.is_admin", return_value=False
    )
    mocker.patch(
        "superset.security.SupersetSecurityManager.current_user",
        new_callable=PropertyMock,
        return_value=other,
    )

    with pytest.raises(TagInvalidError):
        DeleteTagsCommand(["owned_tag"]).run()

    # the tag must survive the denied deletion
    assert db.session.query(Tag).filter_by(name="owned_tag").one_or_none() is not None


def test_delete_tags_command_refuses_system_tag_even_for_admin(
    session_with_tags: Session, mocker: MockerFixture
):
    """System-generated tags (type:*, editor:*, favorited_by:*) are
    maintained by Superset itself and must not be deletable through the
    bulk route, regardless of the caller's role.
    """
    from superset.commands.tag.delete import DeleteTagsCommand
    from superset.commands.tag.exceptions import TagInvalidError
    from superset.tags.models import Tag

    mocker.patch(
        "superset.security.SupersetSecurityManager.is_admin", return_value=True
    )

    with pytest.raises(TagInvalidError):
        DeleteTagsCommand(["type:some_type"]).run()

    assert (
        db.session.query(Tag).filter_by(name="type:some_type").one_or_none() is not None
    )


def test_delete_tags_command_refused_tag_reports_normalized_messages(
    session_with_tags: Session, mocker: MockerFixture
):
    """Regression test: DeleteTagsCommand.validate previously appended a
    plain CommandException (TagDeleteFailedError) into the TagInvalidError
    it raises, which crashed with AttributeError as soon as anything called
    .normalized_messages() on that TagInvalidError (as the single-object
    DELETE /api/v1/tag/<pk> route does). Every exception composited into
    TagInvalidError must be a ValidationError so normalized_messages() can
    aggregate it.
    """
    from superset.commands.tag.delete import DeleteTagsCommand
    from superset.commands.tag.exceptions import TagInvalidError

    mocker.patch(
        "superset.security.SupersetSecurityManager.is_admin", return_value=True
    )

    with pytest.raises(TagInvalidError) as excinfo:
        DeleteTagsCommand(["type:some_type"]).run()

    messages = excinfo.value.normalized_messages()
    assert "tags" in messages
    assert "system tag" in messages["tags"][0]


def test_delete_tags_command_not_found_reports_normalized_messages(
    session_with_tags: Session, mocker: MockerFixture
):
    """A nonexistent tag name is also composited into TagInvalidError; it
    must likewise support normalized_messages() without raising.
    """
    from superset.commands.tag.delete import DeleteTagsCommand
    from superset.commands.tag.exceptions import TagInvalidError

    mocker.patch(
        "superset.security.SupersetSecurityManager.is_admin", return_value=True
    )

    with pytest.raises(TagInvalidError) as excinfo:
        DeleteTagsCommand(["does_not_exist"]).run()

    messages = excinfo.value.normalized_messages()
    assert "tags" in messages
    assert "not found" in messages["tags"][0]
