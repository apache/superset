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


from unittest.mock import call, MagicMock, patch

import pytest

from superset.commands.exceptions import TagForbiddenError, TagNotFoundValidationError
from superset.commands.utils import (
    Tag,
    TagType,
    update_tags,
    validate_tags,
)
from superset.tags.models import ObjectType

OBJECT_TYPES = {ObjectType.chart, ObjectType.chart}
MOCK_TAGS = [
    Tag(
        id=1,
        name="first",
        type=TagType.custom,
    ),
    Tag(
        id=2,
        name="second",
        type=TagType.custom,
    ),
    Tag(
        id=3,
        name="third",
        type=TagType.custom,
    ),
    Tag(
        id=4,
        name="type:dashboard",
        type=TagType.type,
    ),
    Tag(
        id=4,
        name="editor:1",
        type=TagType.editor,
    ),
    Tag(
        id=4,
        name="avorited_by:2",
        type=TagType.favorited_by,
    ),
]


@pytest.mark.parametrize("object_type", OBJECT_TYPES)
@patch("superset.commands.utils.security_manager")
def test_validate_tags_new_tags_is_none(mock_sm, object_type):
    """
    Test the ``validate_tags`` method when new_tags is None.
    """
    validate_tags(object_type, MOCK_TAGS, None)
    mock_sm.can_access.assert_not_called()


@pytest.mark.parametrize("object_type", OBJECT_TYPES)
@patch("superset.commands.utils.security_manager")
def test_validate_tags_empty_list_can_write_on_tag(mock_sm, object_type):
    """
    Test the ``validate_tags`` method when new_tags is an empty list and
    user has permission to write on tag.
    """
    mock_sm.can_access = MagicMock(return_value=True)
    validate_tags(object_type, MOCK_TAGS, [])
    mock_sm.can_access.assert_called_once_with("can_write", "Tag")


@pytest.mark.parametrize("object_type", OBJECT_TYPES)
@patch("superset.commands.utils.security_manager")
def test_validate_tags_empty_list_can_tag_on_object(mock_sm, object_type):
    """
    Test the ``validate_tags`` method when new_tags is an empty list and
    user has permission to tag objects.
    """
    mock_sm.can_access = MagicMock(side_effect=[False, True])
    validate_tags(object_type, MOCK_TAGS, [])
    mock_sm.can_access.assert_has_calls(
        [call("can_write", "Tag"), call("can_tag", object_type.name.capitalize())]
    )


@pytest.mark.parametrize("object_type", OBJECT_TYPES)
@patch("superset.commands.utils.security_manager")
def test_validate_tags_empty_list_missing_permission(mock_sm, object_type):
    """
    Test the ``validate_tags`` method when new_tags is an empty list and
    the user doesn't have the required permission.
    """
    mock_sm.can_access = MagicMock(side_effect=[False, False])
    with pytest.raises(TagForbiddenError):
        validate_tags(object_type, MOCK_TAGS, [])
    mock_sm.can_access.assert_has_calls(
        [call("can_write", "Tag"), call("can_tag", object_type.name.capitalize())]
    )


@pytest.mark.parametrize("object_type", OBJECT_TYPES)
@patch("superset.commands.utils.security_manager")
def test_validate_tags_no_changes_can_write_on_tag(mock_sm, object_type):
    """
    Test the ``validate_tags`` method when new_tags is equal to existing tags
    and user has permission to write on tag.
    """
    new_tags = [tag.id for tag in MOCK_TAGS if tag.type == TagType.custom]
    validate_tags(object_type, MOCK_TAGS, new_tags)
    mock_sm.can_access.assert_not_called()


@pytest.mark.parametrize("object_type", OBJECT_TYPES)
@patch("superset.commands.utils.security_manager")
def test_validate_tags_no_changes_can_tag_on_object(mock_sm, object_type):
    """
    Test the ``validate_tags`` method when new_tags is equal to existing tags
    and user has permission to tag objects.
    """
    new_tags = [tag.id for tag in MOCK_TAGS if tag.type == TagType.custom]
    validate_tags(object_type, MOCK_TAGS, new_tags)
    mock_sm.can_access.assert_not_called()


@pytest.mark.parametrize("object_type", OBJECT_TYPES)
@patch("superset.commands.utils.security_manager")
def test_validate_tags_no_changes_missing_permission(mock_sm, object_type):
    """
    Test the ``validate_tags`` method when new_tags is equal to existing tags
    the user doens't have the required perms.
    """
    new_tags = [tag.id for tag in MOCK_TAGS if tag.type == TagType.custom]
    validate_tags(object_type, MOCK_TAGS, new_tags)
    mock_sm.can_access.assert_not_called()


@pytest.mark.parametrize("object_type", OBJECT_TYPES)
@patch("superset.commands.utils.security_manager")
@patch("superset.commands.utils.TagDAO.find_by_id")
def test_validate_tags_add_new_tags_can_write_on_tag(
    mock_tag_find_by_id, mock_sm, object_type
):
    """
    Test the ``validate_tags`` method when new_tags are added and user has
    permission to write on tag.
    """
    new_tag_ids = [tag.id for tag in MOCK_TAGS if tag.type == TagType.custom]
    new_tag = {
        "id": 10,
        "name": "New test tag",
        "type": TagType.custom,
    }
    new_tag_ids.append(new_tag["id"])

    mock_tag_find_by_id.return_value = new_tag
    mock_sm.can_access = MagicMock(return_value=True)

    validate_tags(object_type, MOCK_TAGS, new_tag_ids)

    mock_sm.can_access.assert_called_once_with("can_write", "Tag")


@pytest.mark.parametrize("object_type", OBJECT_TYPES)
@patch("superset.commands.utils.security_manager")
@patch("superset.commands.utils.TagDAO.find_by_id")
def test_validate_tags_add_new_tags_can_tag_on_object(
    mock_tag_find_by_id, mock_sm, object_type
):
    """
    Test the ``validate_tags`` method when new_tags are added and user has
    permission to tag objects.
    """
    current_tags = [tag for tag in MOCK_TAGS if tag.type == TagType.custom]
    new_tag = current_tags.pop()
    new_tag_ids = [tag.id for tag in current_tags]
    new_tag_ids.append(new_tag.id)

    mock_sm.can_access = MagicMock(side_effect=[False, True])
    mock_tag_find_by_id.return_value = new_tag

    validate_tags(object_type, current_tags, new_tag_ids)

    mock_sm.can_access.assert_has_calls(
        [call("can_write", "Tag"), call("can_tag", object_type.name.capitalize())]
    )


@pytest.mark.parametrize("object_type", OBJECT_TYPES)
@patch("superset.commands.utils.security_manager")
@patch("superset.commands.utils.TagDAO.find_by_name")
def test_validate_tags_can_write_on_tag_unable_to_find_tag(
    mock_tag_find_by_id, mock_sm, object_type
):
    """
    Test the ``validate_tags`` method when an un-existing tag is being
    added and user has permission to write on tag.
    """
    fake_id = 100
    mock_sm.can_access = MagicMock(return_value=True)
    mock_tag_find_by_id.return_value = None
    with pytest.raises(TagNotFoundValidationError):
        validate_tags(object_type, MOCK_TAGS, [fake_id])
    mock_sm.can_access.assert_called_once_with("can_write", "Tag")


@pytest.mark.parametrize("object_type", OBJECT_TYPES)
@patch("superset.commands.utils.security_manager")
@patch("superset.commands.utils.TagDAO.find_by_name")
def test_validate_tags_can_tag_on_object_unable_to_find_tag(
    mock_tag_find_by_id, mock_sm, object_type
):
    """
    Test the ``validate_tags`` method when an un-existing tag is being
    added and user has permission to tag on object.
    """
    fake_id = 100
    mock_sm.can_access = MagicMock(side_effect=[False, True])
    mock_tag_find_by_id.return_value = None
    with pytest.raises(TagNotFoundValidationError):
        validate_tags(object_type, MOCK_TAGS, [fake_id])
    mock_sm.can_access.assert_has_calls(
        [call("can_write", "Tag"), call("can_tag", object_type.name.capitalize())]
    )


@pytest.mark.parametrize("object_type", OBJECT_TYPES)
@patch("superset.commands.utils.TagDAO")
def test_update_tags_adding_tags(mock_tag_dao, object_type):
    """
    Test the ``update_tags`` method when adding tags.
    """
    current_tags = [tag for tag in MOCK_TAGS if tag.type == TagType.custom]
    new_tag = current_tags.pop()
    new_tags = [tag for tag in MOCK_TAGS if tag.type == TagType.custom]
    new_tag_ids = [tag.id for tag in new_tags]

    mock_tag_dao.find_by_ids.return_value = [new_tag]

    update_tags(object_type, 1, current_tags, new_tag_ids)

    mock_tag_dao.find_by_ids.assert_called_once_with([new_tag.id])
    mock_tag_dao.delete_tagged_object.assert_not_called()
    mock_tag_dao.create_custom_tagged_objects.assert_called_once_with(
        object_type, 1, [new_tag.name]
    )


@pytest.mark.parametrize("object_type", OBJECT_TYPES)
@patch("superset.commands.utils.TagDAO")
def test_update_tags_removing_tags(mock_tag_dao, object_type):
    """
    Test the ``update_tags`` method when removing existing tags.
    """
    new_tags = [tag for tag in MOCK_TAGS if tag.type == TagType.custom]
    tag_to_be_removed = new_tags.pop()
    new_tag_ids = [tag.id for tag in new_tags]

    update_tags(object_type, 1, MOCK_TAGS, new_tag_ids)

    mock_tag_dao.delete_tagged_object.assert_called_once_with(
        object_type, 1, tag_to_be_removed.name
    )
    mock_tag_dao.create_custom_tagged_objects.assert_not_called()


@pytest.mark.parametrize("object_type", OBJECT_TYPES)
@patch("superset.commands.utils.TagDAO")
def test_update_tags_adding_and_removing_tags(mock_tag_dao, object_type):
    """
    Test the ``update_tags`` method when adding and removing existing tags.
    """
    new_tags = [tag for tag in MOCK_TAGS if tag.type == TagType.custom]
    tag_to_be_removed = new_tags.pop()
    new_tag = Tag(id=10, name="my new tag", type=TagType.custom)
    new_tags.append(new_tag)
    new_tag_ids = [tag.id for tag in new_tags]

    mock_tag_dao.find_by_ids.return_value = [new_tag]

    update_tags(object_type, 1, MOCK_TAGS, new_tag_ids)

    mock_tag_dao.delete_tagged_object.assert_called_once_with(
        object_type, 1, tag_to_be_removed.name
    )
    mock_tag_dao.find_by_ids.assert_called_once_with([new_tag.id])
    mock_tag_dao.create_custom_tagged_objects.assert_called_once_with(
        object_type, 1, ["my new tag"]
    )


@pytest.mark.parametrize("object_type", OBJECT_TYPES)
@patch("superset.commands.utils.TagDAO")
def test_update_tags_removing_all_tags(mock_tag_dao, object_type):
    """
    Test the ``update_tags`` method when removing all tags.
    """
    update_tags(object_type, 1, MOCK_TAGS, [])

    mock_tag_dao.delete_tagged_object.assert_has_calls(
        [
            call(object_type, 1, tag.name)
            for tag in MOCK_TAGS
            if tag.type == TagType.custom
        ]
    )
    mock_tag_dao.create_custom_tagged_objects.assert_not_called()


@pytest.mark.parametrize("object_type", OBJECT_TYPES)
@patch("superset.commands.utils.TagDAO")
def test_update_tags_no_tags(mock_tag_dao, object_type):
    """
    Test the ``update_tags`` method when the asset only has system tags.
    """
    system_tags = [tag for tag in MOCK_TAGS if tag.type != TagType.custom]
    new_tags = [tag for tag in MOCK_TAGS if tag.type == TagType.custom]
    new_tag_ids = [tag.id for tag in new_tags]
    new_tag_names = [tag.name for tag in new_tags]

    mock_tag_dao.find_by_ids.return_value = new_tags

    update_tags(object_type, 1, system_tags, new_tag_ids)

    mock_tag_dao.delete_tagged_object.assert_not_called()
    mock_tag_dao.find_by_ids.assert_called_once_with(new_tag_ids)
    mock_tag_dao.create_custom_tagged_objects.assert_called_once_with(
        object_type, 1, new_tag_names
    )
