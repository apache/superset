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
from collections.abc import Iterator

import pytest
from sqlalchemy.orm.session import Session


def test_user_favorite_tag(mocker):
    from superset.daos.tag import TagDAO

    # Mock the behavior of TagDAO and g
    mock_session = mocker.patch("superset.daos.tag.db.session")
    mock_TagDAO = mocker.patch(
        "superset.daos.tag.TagDAO"
    )  # Replace with the actual path to TagDAO
    mock_TagDAO.find_by_id.return_value = mocker.MagicMock(users_favorited=[])

    mock_g = mocker.patch("superset.daos.tag.g")  # Replace with the actual path to g
    mock_g.user = mocker.MagicMock()

    # Call the function with a test tag_id
    TagDAO.favorite_tag_by_id_for_current_user(123)

    # Check that find_by_id was called with the right argument
    mock_TagDAO.find_by_id.assert_called_once_with(123)

    # Check that users_favorited was updated correctly
    assert mock_TagDAO.find_by_id().users_favorited == [mock_g.user]

    mock_session.commit.assert_called_once()


def test_remove_user_favorite_tag(mocker):
    from superset.daos.tag import TagDAO

    # Mock the behavior of TagDAO and g
    mock_session = mocker.patch("superset.daos.tag.db.session")
    mock_TagDAO = mocker.patch("superset.daos.tag.TagDAO")
    mock_tag = mocker.MagicMock(users_favorited=[])
    mock_TagDAO.find_by_id.return_value = mock_tag

    mock_g = mocker.patch("superset.daos.tag.g")  # Replace with the actual path to g
    mock_user = mocker.MagicMock()
    mock_g.user = mock_user

    # Append the mock user to the tag's list of favorited users
    mock_tag.users_favorited.append(mock_user)

    # Call the function with a test tag_id
    TagDAO.remove_user_favorite_tag(123)

    # Check that find_by_id was called with the right argument
    mock_TagDAO.find_by_id.assert_called_once_with(123)

    # Check that users_favorited no longer contains the user
    assert mock_user not in mock_tag.users_favorited

    # Check that the session was committed
    mock_session.commit.assert_called_once()


def test_remove_user_favorite_tag_no_user(mocker):
    from superset.daos.tag import TagDAO
    from superset.exceptions import MissingUserContextException

    # Mock the behavior of TagDAO and g
    mock_session = mocker.patch("superset.daos.tag.db.session")
    mock_TagDAO = mocker.patch("superset.daos.tag.TagDAO")
    mock_tag = mocker.MagicMock(users_favorited=[])
    mock_TagDAO.find_by_id.return_value = mock_tag

    mock_g = mocker.patch("superset.daos.tag.g")  # Replace with the actual path to g

    # Test with no user
    mock_g.user = None
    with pytest.raises(MissingUserContextException):
        TagDAO.remove_user_favorite_tag(1)


def test_remove_user_favorite_tag_exc_raise(mocker):
    from superset.daos.tag import TagDAO
    from superset.exceptions import MissingUserContextException

    # Mock the behavior of TagDAO and g
    mock_session = mocker.patch("superset.daos.tag.db.session")
    mock_TagDAO = mocker.patch("superset.daos.tag.TagDAO")
    mock_tag = mocker.MagicMock(users_favorited=[])
    mock_TagDAO.find_by_id.return_value = mock_tag

    mock_g = mocker.patch("superset.daos.tag.g")  # Replace with the actual path to g

    # Test that exception is raised when commit fails
    mock_session.commit.side_effect = Exception("DB Error")
    with pytest.raises(Exception):
        TagDAO.remove_user_favorite_tag(1)


def test_user_favorite_tag_no_user(mocker):
    from superset.daos.tag import TagDAO
    from superset.exceptions import MissingUserContextException

    # Mock the behavior of TagDAO and g
    mock_session = mocker.patch("superset.daos.tag.db.session")
    mock_TagDAO = mocker.patch("superset.daos.tag.TagDAO")
    mock_tag = mocker.MagicMock(users_favorited=[])
    mock_TagDAO.find_by_id.return_value = mock_tag

    mock_g = mocker.patch("superset.daos.tag.g")  # Replace with the actual path to g

    # Test with no user
    mock_g.user = None
    with pytest.raises(MissingUserContextException):
        TagDAO.favorite_tag_by_id_for_current_user(1)


def test_user_favorite_tag_exc_raise(mocker):
    from superset.daos.tag import TagDAO
    from superset.exceptions import MissingUserContextException

    # Mock the behavior of TagDAO and g
    mock_session = mocker.patch("superset.daos.tag.db.session")
    mock_TagDAO = mocker.patch("superset.daos.tag.TagDAO")
    mock_tag = mocker.MagicMock(users_favorited=[])
    mock_TagDAO.find_by_id.return_value = mock_tag

    mock_g = mocker.patch("superset.daos.tag.g")  # Replace with the actual path to g

    # Test that exception is raised when commit fails
    mock_session.commit.side_effect = Exception("DB Error")
    with pytest.raises(Exception):
        TagDAO.remove_user_favorite_tag(1)


def test_create_tag_relationship(mocker):
    from superset.daos.tag import TagDAO
    from superset.tags.models import (  # Assuming these are defined in the same module
        ObjectType,
        TaggedObject,
    )

    mock_session = mocker.patch("superset.daos.tag.db.session")

    # Define a list of objects to tag
    objects_to_tag = [
        (ObjectType.query, 1),
        (ObjectType.chart, 2),
        (ObjectType.dashboard, 3),
    ]

    # Call the function
    tag = TagDAO.get_by_name("test_tag")
    TagDAO.create_tag_relationship(objects_to_tag, tag)

    # Verify that the correct number of TaggedObjects are added to the session
    assert mock_session.add_all.call_count == 1
    assert len(mock_session.add_all.call_args[0][0]) == len(objects_to_tag)
