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

from typing import Any
from unittest.mock import MagicMock, patch

import pytest
from babel import Locale
from flask_appbuilder.const import AUTH_DB, AUTH_LDAP, AUTH_OAUTH, AUTH_REMOTE_USER

from superset.views.base import cached_common_bootstrap_data


def get_base_config(**overrides: Any) -> dict[str, Any]:
    """Generate base config dictionary with optional overrides"""
    config = {
        "AUTH_TYPE": AUTH_DB,
        "AUTH_USER_REGISTRATION": True,
        "AUTH_USER_REGISTRATION_ROLE": "Admin",
        "RECAPTCHA_PUBLIC_KEY": "test_recaptcha_key",
        "APPLICATION_ROOT": "/",
        "STATIC_ASSETS_PREFIX": "/static/",
        "D3_FORMAT": ",",
        "D3_TIME_FORMAT": "%Y-%m-%d",
        "CURRENCIES": ["USD", "EUR"],
        "DECKGL_BASE_MAP": "carto",
        "EXTRA_SEQUENTIAL_COLOR_SCHEMES": [],
        "EXTRA_CATEGORICAL_COLOR_SCHEMES": [],
        "PDF_COMPRESSION_LEVEL": 6,
        "COMMON_BOOTSTRAP_OVERRIDES_FUNC": lambda x: x,
        "FRONTEND_CONF_KEYS": [],
    }
    config.update(overrides)
    return config


def setup_mocks(
    mock_g: MagicMock,
    mock_theme_data: MagicMock,
    mock_menu_data: MagicMock,
    mock_feature_flags: MagicMock,
    mock_engine_specs: MagicMock,
    mock_app: MagicMock,
    config: dict[str, Any],
) -> None:
    """Setup common mock return values"""
    mock_app.config = config
    mock_engine_specs.return_value = {}
    mock_feature_flags.return_value = {}
    mock_menu_data.return_value = {}
    mock_theme_data.return_value = {}
    mock_g.user = None


@pytest.mark.parametrize(
    "auth_type,should_show_recaptcha",
    [
        (AUTH_DB, True),
        (AUTH_REMOTE_USER, True),
        (AUTH_LDAP, False),
        (AUTH_OAUTH, False),
    ],
)
@patch("superset.views.base.app")
@patch("superset.views.base.get_available_engine_specs")
@patch("superset.views.base.get_feature_flags")
@patch("superset.views.base.menu_data")
@patch("superset.views.base.get_theme_bootstrap_data")
@patch("superset.views.base.g")
def test_recaptcha_visibility_by_auth_type(
    mock_g: MagicMock,
    mock_theme_data: MagicMock,
    mock_menu_data: MagicMock,
    mock_feature_flags: MagicMock,
    mock_engine_specs: MagicMock,
    mock_app: MagicMock,
    auth_type: int,
    should_show_recaptcha: bool,
) -> None:
    """Test reCAPTCHA visibility based on auth type with user registration enabled"""
    config = get_base_config(AUTH_TYPE=auth_type)
    setup_mocks(
        mock_g,
        mock_theme_data,
        mock_menu_data,
        mock_feature_flags,
        mock_engine_specs,
        mock_app,
        config,
    )

    result = cached_common_bootstrap_data(None, Locale("en", "US"))

    assert result["conf"]["AUTH_USER_REGISTRATION"] is True
    assert result["conf"]["AUTH_TYPE"] == auth_type

    if should_show_recaptcha:
        assert result["conf"]["RECAPTCHA_PUBLIC_KEY"] == "test_recaptcha_key"
    else:
        assert "RECAPTCHA_PUBLIC_KEY" not in result["conf"]


@patch("superset.views.base.app")
@patch("superset.views.base.get_available_engine_specs")
@patch("superset.views.base.get_feature_flags")
@patch("superset.views.base.menu_data")
@patch("superset.views.base.get_theme_bootstrap_data")
@patch("superset.views.base.g")
def test_should_not_show_recaptcha_without_user_registration(
    mock_g: MagicMock,
    mock_theme_data: MagicMock,
    mock_menu_data: MagicMock,
    mock_feature_flags: MagicMock,
    mock_engine_specs: MagicMock,
    mock_app: MagicMock,
) -> None:
    """Test that reCAPTCHA is NOT shown when user registration is disabled"""
    config = get_base_config(AUTH_USER_REGISTRATION=False)
    del config["AUTH_USER_REGISTRATION_ROLE"]
    setup_mocks(
        mock_g,
        mock_theme_data,
        mock_menu_data,
        mock_feature_flags,
        mock_engine_specs,
        mock_app,
        config,
    )

    result = cached_common_bootstrap_data(None, Locale("en", "US"))

    assert result["conf"]["AUTH_USER_REGISTRATION"] is False
    assert result["conf"]["AUTH_TYPE"] == AUTH_DB
    assert "RECAPTCHA_PUBLIC_KEY" not in result["conf"]
    assert "AUTH_USER_REGISTRATION_ROLE" not in result["conf"]


@patch("superset.views.base.app")
@patch("superset.views.base.get_available_engine_specs")
@patch("superset.views.base.get_feature_flags")
@patch("superset.views.base.menu_data")
@patch("superset.views.base.get_theme_bootstrap_data")
@patch("superset.views.base.g")
def test_ldap_auth_with_registration_role_still_set(
    mock_g: MagicMock,
    mock_theme_data: MagicMock,
    mock_menu_data: MagicMock,
    mock_feature_flags: MagicMock,
    mock_engine_specs: MagicMock,
    mock_app: MagicMock,
) -> None:
    """Test AUTH_USER_REGISTRATION_ROLE is set for LDAP auth when registration on"""
    config = get_base_config(
        AUTH_TYPE=AUTH_LDAP,
        AUTH_USER_REGISTRATION_ROLE="Gamma",
    )
    setup_mocks(
        mock_g,
        mock_theme_data,
        mock_menu_data,
        mock_feature_flags,
        mock_engine_specs,
        mock_app,
        config,
    )

    result = cached_common_bootstrap_data(None, Locale("en", "US"))

    assert result["conf"]["AUTH_USER_REGISTRATION"] is True
    assert result["conf"]["AUTH_TYPE"] == AUTH_LDAP
    assert result["conf"]["AUTH_USER_REGISTRATION_ROLE"] == "Gamma"
    assert "RECAPTCHA_PUBLIC_KEY" not in result["conf"]
