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
"""Object-level authorization on the saved-query import path."""

from unittest.mock import MagicMock

import pytest
from pytest_mock import MockerFixture

from superset.commands.exceptions import ImportFailedError
from superset.commands.query.importers.v1 import utils


def _wire_existing(mocker: MockerFixture, existing: MagicMock | None) -> None:
    mocker.patch.object(utils, "db")
    utils.db.session.query.return_value.filter_by.return_value.first.return_value = (
        existing
    )


def test_overwrite_of_another_users_saved_query_is_rejected(
    mocker: MockerFixture,
) -> None:
    """Regression: ``import_saved_query`` used to overwrite any SavedQuery
    matched by UUID with zero ownership checks, letting an importer replace
    a victim's saved query with attacker SQL."""
    attacker = MagicMock(name="attacker")
    victim = MagicMock(name="victim")
    existing = MagicMock(id=1, created_by=victim)
    _wire_existing(mocker, existing)
    mocker.patch.object(utils.security_manager, "can_access", return_value=True)
    mocker.patch.object(utils.security_manager, "is_admin", return_value=False)
    mocker.patch.object(utils, "get_user", return_value=attacker)
    import_from_dict = mocker.patch.object(utils.SavedQuery, "import_from_dict")

    with pytest.raises(ImportFailedError):
        utils.import_saved_query({"uuid": "some-uuid"}, overwrite=True)

    import_from_dict.assert_not_called()


def test_owner_can_overwrite_own_saved_query(mocker: MockerFixture) -> None:
    owner = MagicMock(name="owner")
    existing = MagicMock(id=1, created_by=owner)
    _wire_existing(mocker, existing)
    mocker.patch.object(utils.security_manager, "can_access", return_value=True)
    mocker.patch.object(utils.security_manager, "is_admin", return_value=False)
    mocker.patch.object(utils, "get_user", return_value=owner)
    import_from_dict = mocker.patch.object(utils.SavedQuery, "import_from_dict")
    import_from_dict.return_value = MagicMock(id=1)

    config = {"uuid": "some-uuid"}
    utils.import_saved_query(config, overwrite=True)

    assert config["id"] == 1
    import_from_dict.assert_called_once()


def test_admin_can_overwrite_another_users_saved_query(mocker: MockerFixture) -> None:
    admin = MagicMock(name="admin")
    victim = MagicMock(name="victim")
    existing = MagicMock(id=1, created_by=victim)
    _wire_existing(mocker, existing)
    mocker.patch.object(utils.security_manager, "can_access", return_value=True)
    mocker.patch.object(utils.security_manager, "is_admin", return_value=True)
    mocker.patch.object(utils, "get_user", return_value=admin)
    import_from_dict = mocker.patch.object(utils.SavedQuery, "import_from_dict")
    import_from_dict.return_value = MagicMock(id=1)

    config = {"uuid": "some-uuid"}
    utils.import_saved_query(config, overwrite=True)

    assert config["id"] == 1
    import_from_dict.assert_called_once()


def test_overwrite_without_can_write_returns_existing(
    mocker: MockerFixture,
) -> None:
    existing = MagicMock(id=1)
    _wire_existing(mocker, existing)
    mocker.patch.object(utils.security_manager, "can_access", return_value=False)
    import_from_dict = mocker.patch.object(utils.SavedQuery, "import_from_dict")

    result = utils.import_saved_query({"uuid": "some-uuid"}, overwrite=True)

    assert result is existing
    import_from_dict.assert_not_called()


def test_create_without_can_write_is_rejected(mocker: MockerFixture) -> None:
    _wire_existing(mocker, None)
    mocker.patch.object(utils.security_manager, "can_access", return_value=False)

    with pytest.raises(ImportFailedError):
        utils.import_saved_query({"uuid": "some-uuid"}, overwrite=False)


def test_background_import_skips_ownership_check(mocker: MockerFixture) -> None:
    """With no request user (CLI/background) and ignore_permissions, trust is
    established by the caller — mirroring the chart importer."""
    existing = MagicMock(id=1)
    _wire_existing(mocker, existing)
    mocker.patch.object(utils, "get_user", return_value=None)
    import_from_dict = mocker.patch.object(utils.SavedQuery, "import_from_dict")
    import_from_dict.return_value = MagicMock(id=1)

    utils.import_saved_query(
        {"uuid": "some-uuid"}, overwrite=True, ignore_permissions=True
    )

    import_from_dict.assert_called_once()
