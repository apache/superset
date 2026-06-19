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
"""Tests for superset.views.base module"""

from unittest.mock import MagicMock, patch

import pytest


@patch("superset.views.base.utils.get_user_id", return_value=1)
@patch(
    "superset.views.base.cached_common_bootstrap_data", return_value={"test": "data"}
)
@patch("superset.views.base.get_locale")
def test_common_bootstrap_payload_converts_locale_to_string(
    mock_get_locale: MagicMock,
    mock_cached: MagicMock,
    mock_user_id: MagicMock,
) -> None:
    """Test that common_bootstrap_payload converts locale to string for cache key"""

    # Mock get_locale to return a Locale-like object
    # Use a simple class with __str__ since MagicMock's __str__ doesn't work with str()
    class MockLocale:
        def __str__(self) -> str:
            return "de_DE"

    mock_get_locale.return_value = MockLocale()

    # Import here to avoid initialization issues
    from superset.views.base import common_bootstrap_payload

    result = common_bootstrap_payload()

    # Verify cached_common_bootstrap_data was called with string locale
    mock_cached.assert_called_once_with(1, "de_DE")
    assert result == {"test": "data"}


@patch("superset.views.base.utils.get_user_id", return_value=1)
@patch(
    "superset.views.base.cached_common_bootstrap_data", return_value={"test": "data"}
)
@patch("superset.views.base.get_locale", return_value=None)
def test_common_bootstrap_payload_handles_none_locale(
    mock_get_locale: MagicMock,
    mock_cached: MagicMock,
    mock_user_id: MagicMock,
) -> None:
    """Test that None locale is passed through correctly"""
    from superset.views.base import common_bootstrap_payload

    common_bootstrap_payload()

    mock_cached.assert_called_once_with(1, None)


def test_default_map_renderer_is_exposed_to_frontend_config() -> None:
    from superset.views.base import FRONTEND_CONF_KEYS

    assert "DEFAULT_MAP_RENDERER" in FRONTEND_CONF_KEYS


def _extract_language(
    locale_str: str | None,
    languages: dict[str, dict[str, object]] | None = None,
) -> str:
    """Helper that mirrors the logic in cached_common_bootstrap_data"""
    if locale_str:
        normalized = locale_str.replace("-", "_")
        if languages and normalized in languages:
            return normalized
        return normalized.split("_")[0]
    return "en"


@pytest.mark.parametrize(
    "locale_str,expected_language",
    [
        ("de_DE", "de"),  # underscore format
        ("en_US", "en"),
        ("fr_FR", "fr"),
        ("de-DE", "de"),  # hyphen format
        ("en-US", "en"),
        ("zh-Hans", "zh"),
        ("fr", "fr"),  # no separator
        ("es", "es"),
        ("en", "en"),
        (None, "en"),  # None defaults to "en"
    ],
)
def test_locale_language_extraction(
    locale_str: str | None, expected_language: str
) -> None:
    """Test that language is correctly extracted from various locale formats"""
    result = _extract_language(locale_str)
    assert result == expected_language


@pytest.mark.parametrize(
    "locale_str,expected_language",
    [
        # Region-specific locales configured as distinct language packs are
        # preserved rather than collapsed to the base language code.
        ("zh_TW", "zh_TW"),
        ("zh-TW", "zh_TW"),
        ("pt_BR", "pt_BR"),
        ("pt-BR", "pt_BR"),
        # Base language codes still resolve to themselves.
        ("zh", "zh"),
        ("pt", "pt"),
        # Unknown region codes fall back to the base language.
        ("zh_HK", "zh"),
        ("de_DE", "de"),
        ("en_US", "en"),
    ],
)
def test_locale_language_extraction_preserves_region_when_configured(
    locale_str: str, expected_language: str
) -> None:
    """Region-specific locales (e.g. zh_TW, pt_BR) are preserved when they
    appear in the configured LANGUAGES mapping."""
    languages: dict[str, dict[str, object]] = {
        "en": {},
        "zh": {},
        "zh_TW": {},
        "pt": {},
        "pt_BR": {},
        "de": {},
    }
    assert _extract_language(locale_str, languages) == expected_language


def test_api_query_returns_json_content_type() -> None:
    """``Api.query`` returns a response with a JSON content type.

    The handler should use ``json_response`` (like its ``query_form_data`` and
    ``time_range`` siblings) so the ``Content-Type`` header is set consistently
    instead of returning a raw JSON string.
    """
    from flask import current_app

    from superset.views.api import Api

    # Unwrap the decorator stack (event logger, auth, etc.) to exercise the
    # handler body directly without app/DB auth context.
    handler = Api.query
    while hasattr(handler, "__wrapped__"):
        handler = handler.__wrapped__

    query_context = MagicMock()
    query_context.get_payload.return_value = {"queries": [{"data": [{"a": 1}]}]}
    factory = MagicMock()
    factory.create.return_value = query_context

    api_view = Api()

    with patch.object(api_view, "get_query_context_factory", return_value=factory):
        with current_app.test_request_context(
            data={"query_context": '{"datasource": {"id": 1}}'}
        ):
            response = handler(api_view)

    assert response.mimetype == "application/json"
    assert response.content_type.startswith("application/json")


@pytest.mark.parametrize(
    "encoding, payload, expected",
    [
        ("utf-8-sig", "Ürün,Şehir\n", "Ürün,Şehir\n".encode("utf-8-sig")),
        ("utf-8", "Ürün,Şehir\n", "Ürün,Şehir\n".encode()),
    ],
)
def test_csv_response_applies_csv_export_encoding(
    encoding: str, payload: str, expected: bytes
) -> None:
    """str bodies are encoded with CSV_EXPORT["encoding"]."""
    from flask import current_app

    from superset.views.base import CsvResponse

    original = current_app.config["CSV_EXPORT"]
    try:
        current_app.config["CSV_EXPORT"] = {"encoding": encoding}
        response = CsvResponse(payload)
        assert response.get_data() == expected
        assert response.mimetype == "text/csv"
    finally:
        current_app.config["CSV_EXPORT"] = original


def test_csv_response_leaves_bytes_untouched() -> None:
    from superset.views.base import CsvResponse

    payload = "Ürün\n".encode("utf-8-sig")
    assert CsvResponse(payload).get_data() == payload
