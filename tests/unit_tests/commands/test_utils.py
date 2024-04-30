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

from unittest.mock import MagicMock, patch


from superset.commands.utils import compute_owner_list, populate_owner_list, User


@patch("superset.commands.utils.g")
def test_populate_owner_list_default_to_user(mock_user):
    owner_list = populate_owner_list([], True)
    assert owner_list == [mock_user.user]


@patch("superset.commands.utils.g")
def test_populate_owner_list_default_to_user_handle_none(mock_user):
    owner_list = populate_owner_list(None, True)
    assert owner_list == [mock_user.user]


@patch("superset.commands.utils.g")
@patch("superset.commands.utils.security_manager")
@patch("superset.commands.utils.get_user_id")
def test_populate_owner_list_admin_user(mock_user_id, mock_sm, mock_g):
    test_user = User(id=1, first_name="First", last_name="Last")
    mock_g.user = User(id=4, first_name="Admin", last_name="User")
    mock_user_id.return_value = 4
    mock_sm.is_admin = MagicMock(return_value=True)
    mock_sm.get_user_by_id = MagicMock(return_value=test_user)

    owner_list = populate_owner_list([1], False)
    assert owner_list == [test_user]


@patch("superset.commands.utils.g")
@patch("superset.commands.utils.security_manager")
@patch("superset.commands.utils.get_user_id")
def test_populate_owner_list_admin_user_empty_list(mock_user_id, mock_sm, mock_g):
    mock_g.user = User(id=4, first_name="Admin", last_name="User")
    mock_user_id.return_value = 4
    mock_sm.is_admin = MagicMock(return_value=True)
    owner_list = populate_owner_list([], False)
    assert owner_list == []


@patch("superset.commands.utils.g")
@patch("superset.commands.utils.security_manager")
@patch("superset.commands.utils.get_user_id")
def test_populate_owner_list_non_admin(mock_user_id, mock_sm, mock_g):
    test_user = User(id=1, first_name="First", last_name="Last")
    mock_g.user = User(id=4, first_name="Non", last_name="admin")
    mock_user_id.return_value = 4
    mock_sm.is_admin = MagicMock(return_value=False)
    mock_sm.get_user_by_id = MagicMock(return_value=test_user)

    owner_list = populate_owner_list([1], False)
    assert owner_list == [mock_g.user, test_user]


@patch("superset.commands.utils.populate_owner_list")
def test_compute_owner_list_new_owners(mock_populate_owner_list):
    current_owners = [User(id=1), User(id=2), User(id=3)]
    new_owners = [4, 5, 6]

    compute_owner_list(current_owners, new_owners)
    mock_populate_owner_list.assert_called_once_with(new_owners, default_to_user=False)


@patch("superset.commands.utils.populate_owner_list")
def test_compute_owner_list_no_new_owners(mock_populate_owner_list):
    current_owners = [User(id=1), User(id=2), User(id=3)]
    new_owners = None

    compute_owner_list(current_owners, new_owners)
    mock_populate_owner_list.assert_called_once_with([1, 2, 3], default_to_user=False)


@patch("superset.commands.utils.populate_owner_list")
def test_compute_owner_list_new_owner_empty_list(mock_populate_owner_list):
    current_owners = [User(id=1), User(id=2), User(id=3)]
    new_owners = []

    compute_owner_list(current_owners, new_owners)
    mock_populate_owner_list.assert_called_once_with(new_owners, default_to_user=False)


@patch("superset.commands.utils.populate_owner_list")
def test_compute_owner_list_no_owners(mock_populate_owner_list):
    current_owners = []
    new_owners = [4, 5, 6]

    compute_owner_list(current_owners, new_owners)
    mock_populate_owner_list.assert_called_once_with(new_owners, default_to_user=False)


@patch("superset.commands.utils.populate_owner_list")
def test_compute_owner_list_no_owners_handle_none(mock_populate_owner_list):
    current_owners = None
    new_owners = [4, 5, 6]

    compute_owner_list(current_owners, new_owners)
    mock_populate_owner_list.assert_called_once_with(new_owners, default_to_user=False)
