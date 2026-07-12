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
from flask import g
from flask_appbuilder.const import (
    AUTH_DB,
    AUTH_LDAP,
    AUTH_OAUTH,
    AUTH_SAML,
)

from superset.views.base import cached_common_bootstrap_data, common_bootstrap_payload


@pytest.fixture(autouse=True)
def mock_user() -> None:
    g.user = MagicMock()


def _get_bootstrap(user_id: int = 1) -> dict[str, Any]:
    with patch("superset.views.base.menu_data", return_value={}):
        return cached_common_bootstrap_data(user_id=user_id, locale=None)


def test_bootstrap_saml_providers(app_context: None) -> None:
    """SAML providers are included in bootstrap data."""
    from flask import current_app

    current_app.config["AUTH_TYPE"] = AUTH_SAML
    current_app.config["AUTH_USER_REGISTRATION"] = False
    current_app.config["SAML_PROVIDERS"] = [
        {"name": "okta", "icon": "fa-okta"},
        {"name": "entra_id", "icon": "fa-microsoft"},
    ]

    payload = _get_bootstrap()

    assert payload["conf"]["AUTH_TYPE"] == AUTH_SAML
    providers = payload["conf"]["AUTH_PROVIDERS"]
    assert len(providers) == 2
    assert providers[0] == {"name": "okta", "icon": "fa-okta"}
    assert providers[1] == {"name": "entra_id", "icon": "fa-microsoft"}


def test_bootstrap_saml_provider_default_icon(app_context: None) -> None:
    """SAML providers without an icon get a default icon."""
    from flask import current_app

    current_app.config["AUTH_TYPE"] = AUTH_SAML
    current_app.config["AUTH_USER_REGISTRATION"] = False
    current_app.config["SAML_PROVIDERS"] = [
        {"name": "onelogin"},
    ]

    payload = _get_bootstrap()

    providers = payload["conf"]["AUTH_PROVIDERS"]
    assert providers[0] == {"name": "onelogin", "icon": "fa-sign-in"}


def test_bootstrap_oauth_providers(app_context: None) -> None:
    """OAuth providers are included in bootstrap data."""
    from flask import current_app

    current_app.config["AUTH_TYPE"] = AUTH_OAUTH
    current_app.config["AUTH_USER_REGISTRATION"] = False
    current_app.config["OAUTH_PROVIDERS"] = [
        {"name": "github", "icon": "fa-github"},
    ]

    payload = _get_bootstrap()

    assert payload["conf"]["AUTH_TYPE"] == AUTH_OAUTH
    providers = payload["conf"]["AUTH_PROVIDERS"]
    assert len(providers) == 1
    assert providers[0] == {"name": "github", "icon": "fa-github"}


@pytest.mark.parametrize(
    "auth_type",
    [AUTH_OAUTH, AUTH_SAML],
)
def test_recaptcha_not_shown_for_federated_auth(
    app_context: None,
    auth_type: int,
) -> None:
    """Recaptcha should not be shown for OAuth or SAML auth types."""
    from flask import current_app

    current_app.config["AUTH_TYPE"] = auth_type
    current_app.config["AUTH_USER_REGISTRATION"] = True
    current_app.config["AUTH_USER_REGISTRATION_ROLE"] = "Public"
    current_app.config.pop("RECAPTCHA_PUBLIC_KEY", None)

    payload = _get_bootstrap()

    assert "RECAPTCHA_PUBLIC_KEY" not in payload["conf"]


@pytest.mark.parametrize(
    "auth_type",
    [AUTH_DB, AUTH_LDAP],
)
def test_recaptcha_shown_for_non_federated_auth(
    app_context: None,
    auth_type: int,
) -> None:
    """Recaptcha should be shown for DB and LDAP auth types when registration is on."""
    from flask import current_app

    current_app.config["AUTH_TYPE"] = auth_type
    current_app.config["AUTH_USER_REGISTRATION"] = True
    current_app.config["AUTH_USER_REGISTRATION_ROLE"] = "Public"
    current_app.config["RECAPTCHA_PUBLIC_KEY"] = "test-key"

    payload = _get_bootstrap()

    assert payload["conf"]["RECAPTCHA_PUBLIC_KEY"] == "test-key"


@pytest.mark.parametrize(
    "auth_type",
    [AUTH_DB, AUTH_LDAP],
)
def test_bootstrap_does_not_crash_without_recaptcha_key(
    app_context: None,
    auth_type: int,
) -> None:
    """Missing RECAPTCHA_PUBLIC_KEY must not crash bootstrap (#37008/#39364)."""
    from flask import current_app

    current_app.config["AUTH_TYPE"] = auth_type
    current_app.config["AUTH_USER_REGISTRATION"] = True
    current_app.config["AUTH_USER_REGISTRATION_ROLE"] = "Public"
    current_app.config.pop("RECAPTCHA_PUBLIC_KEY", None)

    payload = _get_bootstrap()

    assert "RECAPTCHA_PUBLIC_KEY" not in payload["conf"]


# --- language pack delivery ----------------------------------------------
#
# The pack is NOT embedded in the bootstrap payload; spa.html loads it via a
# content-addressed script tag whose URL comes from
# `get_language_pack_template_context`. A pack supplied through
# COMMON_BOOTSTRAP_OVERRIDES_FUNC still rides the payload and suppresses the
# script tag.


def test_common_bootstrap_payload_does_not_embed_language_pack(
    app_context: None,
) -> None:
    """The payload stays small: no full pack even for non-English locales."""
    with (
        patch(
            "superset.views.base.cached_common_bootstrap_data",
            return_value={"locale": "fr"},
        ),
        patch("superset.views.base.utils.get_user_id", return_value=1),
        patch("superset.views.base.get_locale", return_value="fr"),
    ):
        payload: dict[str, Any] = common_bootstrap_payload()

    assert payload["language_pack"] is None


def test_common_bootstrap_payload_preserves_override_pack(
    app_context: None,
) -> None:
    """A pack from COMMON_BOOTSTRAP_OVERRIDES_FUNC is passed through."""
    fake_pack: dict[str, Any] = {"domain": "superset", "locale_data": {"superset": {}}}
    with (
        patch(
            "superset.views.base.cached_common_bootstrap_data",
            return_value={"locale": "fr", "language_pack": fake_pack},
        ),
        patch("superset.views.base.utils.get_user_id", return_value=1),
        patch("superset.views.base.get_locale", return_value="fr"),
    ):
        payload: dict[str, Any] = common_bootstrap_payload()

    assert payload["language_pack"] == fake_pack


def test_common_bootstrap_payload_does_not_mutate_memoized_dict(
    app_context: None,
) -> None:
    """Defaulting language_pack must not write back into the memoize cache."""
    cached: dict[str, Any] = {"locale": "fr"}
    with (
        patch(
            "superset.views.base.cached_common_bootstrap_data",
            return_value=cached,
        ),
        patch("superset.views.base.utils.get_user_id", return_value=1),
        patch("superset.views.base.get_locale", return_value="fr"),
    ):
        common_bootstrap_payload()

    assert "language_pack" not in cached


def _language_pack_context(
    locale: str, payload_extra: dict[str, Any]
) -> dict[str, Any]:
    from superset.views.base import get_language_pack_template_context

    with (
        patch(
            "superset.views.base.get_language_pack_version",
            return_value="abc123def456",
        ),
        patch(
            "superset.views.base.url_for",
            return_value="/language_pack/fr/abc123def456/script.js",
        ),
    ):
        return get_language_pack_template_context({"locale": locale, **payload_extra})


def test_language_pack_template_context_versioned_src_for_non_english(
    app_context: None,
) -> None:
    context = _language_pack_context("fr", {})
    assert context == {
        "language_pack_src": "/language_pack/fr/abc123def456/script.js",
        "language_pack_inline": False,
    }


def test_language_pack_template_context_none_for_english(
    app_context: None,
) -> None:
    context = _language_pack_context("en", {})
    assert context == {"language_pack_src": None, "language_pack_inline": False}


def test_language_pack_template_context_inline_for_override_pack(
    app_context: None,
) -> None:
    """An operator-supplied pack suppresses the script tag; spa.html inlines."""
    context = _language_pack_context("fr", {"language_pack": {"domain": "superset"}})
    assert context == {"language_pack_src": None, "language_pack_inline": True}
