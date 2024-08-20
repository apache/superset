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
from unittest.mock import MagicMock

import pytest
from flask_appbuilder.security.sqla.models import User
from sqlalchemy.orm.exc import NoResultFound

from superset.daos.user import UserDAO
from superset.models.user_attributes import UserAttribute


@pytest.fixture
def mock_db_session(mocker):
    db = mocker.patch("superset.daos.user.db", autospec=True)
    db.session = MagicMock()
    db.session.query = MagicMock()
    db.session.commit = MagicMock()
    db.session.query.return_value = MagicMock()
    return db.session


def test_get_by_id_found(mock_db_session):
    # Setup
    user_id = 1
    mock_user = User()
    mock_user.id = user_id
    mock_query = mock_db_session.query.return_value
    mock_query.filter_by.return_value.one.return_value = mock_user

    # Execute
    UserDAO.get_by_id(user_id)  # noqa: F841

    # Assert
    mock_db_session.query.assert_called_with(User)
    mock_query.filter_by.assert_called_with(id=user_id)


def test_get_by_id_not_found(mock_db_session):
    # Setup
    user_id = 1
    mock_query = mock_db_session.query.return_value
    mock_query.filter_by.return_value.one.side_effect = NoResultFound

    # Execute & Assert
    with pytest.raises(NoResultFound):
        UserDAO.get_by_id(user_id)


def test_set_avatar_url_with_existing_attributes(mock_db_session):
    # Setup
    user = User()
    user.id = 1
    user.extra_attributes = [UserAttribute(user_id=user.id, avatar_url="old_url")]

    # Execute
    new_url = "http://newurl.com"
    UserDAO.set_avatar_url(user, new_url)

    # Assert
    assert user.extra_attributes[0].avatar_url == new_url
    mock_db_session.add.assert_not_called()  # No new attributes should be added


def test_set_avatar_url_without_existing_attributes(mock_db_session):
    # Setup
    user = User()
    user.id = 1
    user.extra_attributes = []

    # Execute
    new_url = "http://newurl.com"
    UserDAO.set_avatar_url(user, new_url)

    # Assert
    assert len(user.extra_attributes) == 1
    assert user.extra_attributes[0].avatar_url == new_url
    mock_db_session.add.assert_called()  # New attribute should be added
