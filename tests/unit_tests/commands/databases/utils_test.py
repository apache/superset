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
from __future__ import annotations

import datetime
import sqlite3
from unittest.mock import MagicMock

import pytest
from flask_appbuilder.security.sqla.models import (
    Permission,
    PermissionView,
    ViewMenu,
)
from pytest_mock import MockerFixture
from sqlalchemy.orm import Session

from superset.commands.database.utils import (
    add_perm,
    add_pvm,
    add_vm,
    ping,
)
from tests.conftest import with_config


@pytest.fixture
def mock_engine(mocker: MockerFixture) -> tuple[MagicMock, MagicMock, MagicMock]:
    mock_connection = mocker.MagicMock()
    mock_engine = mocker.MagicMock()
    mock_dialect = mocker.MagicMock()
    mock_engine.raw_connection.return_value = mock_connection
    mock_engine.dialect = mock_dialect
    return mock_engine, mock_connection, mock_dialect


@with_config({"TEST_DATABASE_CONNECTION_TIMEOUT": datetime.timedelta(seconds=10)})
def test_ping_success(mock_engine: MockerFixture):
    """
    Test the ``ping`` method.
    """
    mock_engine, mock_connection, mock_dialect = mock_engine
    mock_dialect.do_ping.return_value = True

    result = ping(mock_engine)

    assert result is True

    mock_engine.raw_connection.assert_called_once()
    mock_dialect.do_ping.assert_called_once_with(mock_connection)


@with_config({"TEST_DATABASE_CONNECTION_TIMEOUT": datetime.timedelta(seconds=10)})
def test_ping_sqlite_exception(mocker: MockerFixture, mock_engine: MockerFixture):
    """
    Test the ``ping`` method when a sqlite3.ProgrammingError is raised.
    """
    mock_engine, mock_connection, mock_dialect = mock_engine
    mock_dialect.do_ping.side_effect = [sqlite3.ProgrammingError, True]

    result = ping(mock_engine)

    assert result is True

    mock_dialect.do_ping.assert_has_calls(
        [mocker.call(mock_connection), mocker.call(mock_engine)]
    )


def test_ping_runtime_exception(mocker: MockerFixture, mock_engine: MockerFixture):
    """
    Test the ``ping`` method when a RuntimeError is raised.
    """
    mock_engine, _, mock_dialect = mock_engine
    mock_timeout = mocker.patch("superset.commands.database.utils.timeout")
    mock_timeout.side_effect = RuntimeError("timeout")
    mock_dialect.do_ping.return_value = True

    result = ping(mock_engine)

    assert result is True
    mock_dialect.do_ping.assert_called_once_with(mock_engine)


@pytest.fixture
def db_session(mocker: MockerFixture) -> Session:
    return mocker.MagicMock(spec=Session)


def test_add_vm(db_session: Session, mocker: MockerFixture):
    """
    Thest ``add_vm`` when the ViewMenu does not exist.
    """
    sm = mocker.MagicMock()
    sm.find_view_menu.return_value = None
    sm.viewmenu_model = ViewMenu

    result = add_vm(db_session, sm, "new_view_menu")

    assert result.name == "new_view_menu"
    sm.find_view_menu.assert_called_once_with("new_view_menu")
    db_session.add.assert_called_once_with(result)


def test_add_vm_existing(db_session: Session, mocker: MockerFixture):
    """
    Thest ``add_vm`` when the ViewMenu already exists.
    """
    mock_vm = mocker.MagicMock()
    sm = mocker.MagicMock()
    sm.find_view_menu.return_value = mock_vm

    result = add_vm(db_session, sm, "existing_view_menu")

    assert result == mock_vm
    sm.find_view_menu.assert_called_once_with("existing_view_menu")
    db_session.add.assert_not_called()


def test_add_perm(db_session: Session, mocker: MockerFixture):
    """
    Thest ``add_perm`` when the Permission does not exist.
    """
    sm = mocker.MagicMock()
    sm.find_permission.return_value = None
    sm.permission_model = Permission

    result = add_perm(db_session, sm, "new_perm")

    assert result.name == "new_perm"
    sm.find_permission.assert_called_once_with("new_perm")
    db_session.add.assert_called_once_with(result)


def test_add_perm_existing(db_session: Session, mocker: MockerFixture):
    """
    Thest ``add_perm`` when the Permission already exists.
    """
    mock_perm = mocker.MagicMock()
    sm = mocker.MagicMock()
    sm.find_permission.return_value = mock_perm

    result = add_perm(db_session, sm, "existing_perm")

    assert result == mock_perm
    sm.find_permission.assert_called_once_with("existing_perm")
    db_session.add.assert_not_called()


def test_add_pvm(db_session: Session, mocker: MockerFixture):
    """
    Thest ``add_pvm`` when the PermissionView does not exist.
    """
    sm = mocker.MagicMock()
    sm.find_permission_view_menu.return_value = None
    sm.permissionview_model = PermissionView

    mock_vm = mocker.MagicMock()
    mock_perm = mocker.MagicMock()
    mock_add_vm = mocker.patch("superset.commands.database.utils.add_vm")
    mock_add_vm.return_value = mock_vm
    mock_add_perm = mocker.patch("superset.commands.database.utils.add_perm")
    mock_add_perm.return_value = mock_perm

    result = add_pvm(db_session, sm, "new_perm", "new_view_menu")

    assert result is not None
    assert result.view_menu == mock_vm
    assert result.permission == mock_perm
    sm.find_permission_view_menu.assert_called_once_with("new_perm", "new_view_menu")
    mock_add_vm.assert_called_once_with(db_session, sm, "new_view_menu")
    mock_add_perm.assert_called_once_with(db_session, sm, "new_perm")
    db_session.add.assert_called_once_with(result)


def test_add_pvm_missing_data(db_session: Session, mocker: MockerFixture):
    """
    Thest ``add_pvm`` when permission_name and view_menu_name are empty.
    """
    sm = mocker.MagicMock()
    result = add_pvm(db_session, sm, None, None)

    assert result is None


def test_add_pvm_existing(db_session: Session, mocker: MockerFixture):
    """
    Thest ``add_pvm`` when the PermissionView already exists.
    """
    mock_pvm = mocker.MagicMock()
    sm = mocker.MagicMock()
    sm.find_permission_view_menu.return_value = mock_pvm

    result = add_pvm(db_session, sm, "existinf_perm", "existing_vm")

    assert result == mock_pvm
    sm.find_permission_view_menu.assert_called_once_with("existinf_perm", "existing_vm")
    db_session.add.assert_not_called()
