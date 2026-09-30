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

from unittest.mock import MagicMock, Mock, patch

import pytest

from superset.commands.theme.exceptions import ThemeImportError
from superset.commands.theme.import_themes import import_theme
from superset.models.core import Theme


def _mock_existing(
    is_system: bool = False,
    is_system_default: bool = False,
    is_system_dark: bool = False,
) -> MagicMock:
    theme = MagicMock(spec=Theme)
    theme.id = 1
    theme.is_system = is_system
    theme.is_system_default = is_system_default
    theme.is_system_dark = is_system_dark
    return theme


@patch("superset.security_manager")
@patch("superset.db")
def test_import_theme_refuses_system_theme_overwrite(mock_db, mock_security_manager):
    """overwrite=True must not be able to replace a seeded system theme."""
    mock_security_manager.can_access.return_value = True
    existing = _mock_existing(is_system=True)
    mock_db.session.query.return_value.filter_by.return_value.first.return_value = (
        existing
    )

    config = {"uuid": "some-uuid", "theme_name": "hostile", "json_data": "{}"}

    with pytest.raises(ThemeImportError):
        import_theme(config, overwrite=True)


@patch("superset.security_manager")
@patch("superset.db")
def test_import_theme_refuses_system_default_overwrite(mock_db, mock_security_manager):
    """A non-admin overwrite=True must not replace the active default theme."""
    mock_security_manager.can_access.return_value = True
    # Use a regular Mock for is_admin to avoid AsyncMock auto-detection
    mock_security_manager.is_admin = Mock(return_value=False)
    existing = _mock_existing(is_system_default=True)
    mock_db.session.query.return_value.filter_by.return_value.first.return_value = (
        existing
    )

    config = {"uuid": "some-uuid", "theme_name": "hostile", "json_data": "{}"}

    with pytest.raises(ThemeImportError):
        import_theme(config, overwrite=True)


@patch("superset.security_manager")
@patch("superset.db")
def test_import_theme_refuses_system_dark_overwrite(mock_db, mock_security_manager):
    """A non-admin overwrite=True must not replace the active dark theme."""
    mock_security_manager.can_access.return_value = True
    # Use a regular Mock for is_admin to avoid AsyncMock auto-detection
    mock_security_manager.is_admin = Mock(return_value=False)
    existing = _mock_existing(is_system_dark=True)
    mock_db.session.query.return_value.filter_by.return_value.first.return_value = (
        existing
    )

    config = {"uuid": "some-uuid", "theme_name": "hostile", "json_data": "{}"}

    with pytest.raises(ThemeImportError):
        import_theme(config, overwrite=True)


@patch("superset.utils.core.get_user")
@patch("superset.security_manager")
@patch("superset.db")
def test_import_theme_admin_allows_system_default_overwrite(
    mock_db, mock_security_manager, mock_get_user
):
    """An admin overwrite=True may still replace the active default theme,
    mirroring UpdateThemeCommand's admin carve-out."""
    mock_security_manager.can_access.return_value = True
    # Use a regular Mock for is_admin to avoid AsyncMock auto-detection
    mock_security_manager.is_admin = Mock(return_value=True)
    mock_get_user.return_value = None
    existing = _mock_existing(is_system_default=True)
    mock_db.session.query.return_value.filter_by.return_value.first.return_value = (
        existing
    )

    config = {"uuid": "some-uuid", "theme_name": "updated", "json_data": "{}"}

    with patch("superset.models.core.Theme.import_from_dict") as mock_import_from_dict:
        mock_theme = MagicMock(spec=Theme)
        mock_theme.id = 1
        mock_import_from_dict.return_value = mock_theme

        result = import_theme(config, overwrite=True)

    assert result is mock_theme
    assert config["id"] == existing.id


@patch("superset.utils.core.get_user")
@patch("superset.security_manager")
@patch("superset.db")
def test_import_theme_admin_allows_system_dark_overwrite(
    mock_db, mock_security_manager, mock_get_user
):
    """An admin overwrite=True may still replace the active dark theme,
    mirroring UpdateThemeCommand's admin carve-out."""
    mock_security_manager.can_access.return_value = True
    # Use a regular Mock for is_admin to avoid AsyncMock auto-detection
    mock_security_manager.is_admin = Mock(return_value=True)
    mock_get_user.return_value = None
    existing = _mock_existing(is_system_dark=True)
    mock_db.session.query.return_value.filter_by.return_value.first.return_value = (
        existing
    )

    config = {"uuid": "some-uuid", "theme_name": "updated", "json_data": "{}"}

    with patch("superset.models.core.Theme.import_from_dict") as mock_import_from_dict:
        mock_theme = MagicMock(spec=Theme)
        mock_theme.id = 1
        mock_import_from_dict.return_value = mock_theme

        result = import_theme(config, overwrite=True)

    assert result is mock_theme
    assert config["id"] == existing.id


@patch("superset.utils.core.get_user")
@patch("superset.security_manager")
@patch("superset.db")
def test_import_theme_allows_regular_theme_overwrite(
    mock_db, mock_security_manager, mock_get_user
):
    """A regular (non-system) theme can still be overwritten as before."""
    mock_security_manager.can_access.return_value = True
    mock_get_user.return_value = None
    existing = _mock_existing()
    mock_db.session.query.return_value.filter_by.return_value.first.return_value = (
        existing
    )

    config = {"uuid": "some-uuid", "theme_name": "updated", "json_data": "{}"}

    with patch("superset.models.core.Theme.import_from_dict") as mock_import_from_dict:
        mock_theme = MagicMock(spec=Theme)
        mock_theme.id = 1
        mock_import_from_dict.return_value = mock_theme

        result = import_theme(config, overwrite=True)

    assert result is mock_theme
    assert config["id"] == existing.id


@patch("superset.security_manager")
@patch("superset.db")
def test_import_theme_no_overwrite_returns_existing(mock_db, mock_security_manager):
    """Without overwrite=True, the existing theme is returned untouched."""
    mock_security_manager.can_access.return_value = True
    existing = _mock_existing(is_system_default=True)
    mock_db.session.query.return_value.filter_by.return_value.first.return_value = (
        existing
    )

    config = {"uuid": "some-uuid", "theme_name": "hostile", "json_data": "{}"}

    result = import_theme(config, overwrite=False)

    assert result is existing
