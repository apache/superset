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
"""
Tests for list endpoint localization.

List API endpoints (/api/v1/dashboard/, /api/v1/chart/) must return
localized field values (dashboard_title, slice_name, description)
when ENABLE_CONTENT_LOCALIZATION is enabled.

localize_list_response fetches translations from the DB and applies
them to serialized list items in-place, using the same get_translation
fallback chain (exact match → base language) as GET endpoints.
"""

from __future__ import annotations

from types import SimpleNamespace
from typing import Any
from unittest.mock import patch

from superset.localization.api_utils import localize_list_response


def _mock_query_result(
    rows: list[tuple[int, dict[str, dict[str, str]] | None]],
) -> Any:
    """Build mock for db.session.query().filter().all() chain."""
    return [SimpleNamespace(id=row_id, translations=t) for row_id, t in rows]


def test_localize_list_response_translates_single_field(
    app_context: None,
) -> None:
    """
    Dashboard list items receive localized dashboard_title.

    Given items with translations {"dashboard_title": {"de": "..."}},
    and user locale="de", localize_list_response replaces the original
    title with the German translation.
    """
    items = [
        {"id": 1, "dashboard_title": "Sales Dashboard"},
        {"id": 2, "dashboard_title": "Revenue Overview"},
    ]

    with patch(
        "superset.localization.api_utils.is_feature_enabled", return_value=True
    ), patch(
        "superset.localization.api_utils.get_user_locale", return_value="de"
    ), patch("superset.localization.api_utils.db") as mock_db:
        mock_db.session.query.return_value.filter.return_value.all.return_value = (
            _mock_query_result(
                [
                    (1, {"dashboard_title": {"de": "Verkaufs-Dashboard"}}),
                    (2, {"dashboard_title": {"de": "Umsatzübersicht"}}),
                ]
            )
        )
        from superset.models.dashboard import Dashboard

        localize_list_response(items, Dashboard, ["dashboard_title"])

    assert items[0]["dashboard_title"] == "Verkaufs-Dashboard"
    assert items[1]["dashboard_title"] == "Umsatzübersicht"


def test_localize_list_response_translates_multiple_fields(
    app_context: None,
) -> None:
    """
    Chart list items receive localized slice_name and description.

    Both fields are translated independently using their respective
    translations entries.
    """
    items = [
        {"id": 1, "slice_name": "Revenue Chart", "description": "Shows revenue"},
    ]

    with patch(
        "superset.localization.api_utils.is_feature_enabled", return_value=True
    ), patch(
        "superset.localization.api_utils.get_user_locale", return_value="fr"
    ), patch("superset.localization.api_utils.db") as mock_db:
        mock_db.session.query.return_value.filter.return_value.all.return_value = (
            _mock_query_result(
                [
                    (
                        1,
                        {
                            "slice_name": {"fr": "Graphique du chiffre d'affaires"},
                            "description": {"fr": "Affiche le chiffre d'affaires"},
                        },
                    ),
                ]
            )
        )
        from superset.models.slice import Slice

        localize_list_response(items, Slice, ["slice_name", "description"])

    assert items[0]["slice_name"] == "Graphique du chiffre d'affaires"
    assert items[0]["description"] == "Affiche le chiffre d'affaires"


def test_localize_list_response_preserves_untranslated(
    app_context: None,
) -> None:
    """
    Items without translations for the user's locale keep original values.

    Given translations only for "fr" and user locale="de",
    the original English value is preserved.
    """
    items = [
        {"id": 1, "dashboard_title": "Sales Dashboard"},
    ]

    with patch(
        "superset.localization.api_utils.is_feature_enabled", return_value=True
    ), patch(
        "superset.localization.api_utils.get_user_locale", return_value="de"
    ), patch("superset.localization.api_utils.db") as mock_db:
        mock_db.session.query.return_value.filter.return_value.all.return_value = (
            _mock_query_result(
                [
                    (1, {"dashboard_title": {"fr": "Tableau de vente"}}),
                ]
            )
        )
        from superset.models.dashboard import Dashboard

        localize_list_response(items, Dashboard, ["dashboard_title"])

    assert items[0]["dashboard_title"] == "Sales Dashboard"


def test_localize_list_response_uses_base_locale_fallback(
    app_context: None,
) -> None:
    """
    Locale de-AT falls back to base language "de" translation.

    get_translation splits on hyphen/underscore and tries base locale.
    """
    items = [
        {"id": 1, "slice_name": "Revenue Chart"},
    ]

    with patch(
        "superset.localization.api_utils.is_feature_enabled", return_value=True
    ), patch(
        "superset.localization.api_utils.get_user_locale", return_value="de-AT"
    ), patch("superset.localization.api_utils.db") as mock_db:
        mock_db.session.query.return_value.filter.return_value.all.return_value = (
            _mock_query_result(
                [
                    (1, {"slice_name": {"de": "Umsatzdiagramm"}}),
                ]
            )
        )
        from superset.models.slice import Slice

        localize_list_response(items, Slice, ["slice_name"])

    assert items[0]["slice_name"] == "Umsatzdiagramm"


def test_localize_list_response_skips_when_feature_disabled(
    app_context: None,
) -> None:
    """
    No-op when ENABLE_CONTENT_LOCALIZATION is disabled.

    Items remain unchanged, no DB query executed.
    """
    items = [
        {"id": 1, "dashboard_title": "Sales Dashboard"},
    ]

    with patch(
        "superset.localization.api_utils.is_feature_enabled", return_value=False
    ), patch("superset.localization.api_utils.db") as mock_db:
        from superset.models.dashboard import Dashboard

        localize_list_response(items, Dashboard, ["dashboard_title"])

    assert items[0]["dashboard_title"] == "Sales Dashboard"
    mock_db.session.query.assert_not_called()


def test_localize_list_response_handles_empty_items(
    app_context: None,
) -> None:
    """
    Empty items list results in no DB query and no-op.
    """
    items: list[dict[str, Any]] = []

    with patch(
        "superset.localization.api_utils.is_feature_enabled", return_value=True
    ), patch("superset.localization.api_utils.db") as mock_db:
        from superset.models.dashboard import Dashboard

        localize_list_response(items, Dashboard, ["dashboard_title"])

    mock_db.session.query.assert_not_called()


def test_localize_list_response_handles_null_translations(
    app_context: None,
) -> None:
    """
    Items with NULL translations column preserve original values.
    """
    items = [
        {"id": 1, "dashboard_title": "Sales Dashboard"},
        {"id": 2, "dashboard_title": "Revenue Overview"},
    ]

    with patch(
        "superset.localization.api_utils.is_feature_enabled", return_value=True
    ), patch(
        "superset.localization.api_utils.get_user_locale", return_value="de"
    ), patch("superset.localization.api_utils.db") as mock_db:
        mock_db.session.query.return_value.filter.return_value.all.return_value = (
            _mock_query_result(
                [
                    (1, None),
                    (2, {"dashboard_title": {"de": "Umsatzübersicht"}}),
                ]
            )
        )
        from superset.models.dashboard import Dashboard

        localize_list_response(items, Dashboard, ["dashboard_title"])

    assert items[0]["dashboard_title"] == "Sales Dashboard"  # NULL → original
    assert items[1]["dashboard_title"] == "Umsatzübersicht"  # translated


def test_localize_list_response_partial_field_translations(
    app_context: None,
) -> None:
    """
    When translations exist for some fields but not others,
    only translated fields are updated; rest keep original values.
    """
    items = [
        {"id": 1, "slice_name": "Revenue Chart", "description": "Shows revenue"},
    ]

    with patch(
        "superset.localization.api_utils.is_feature_enabled", return_value=True
    ), patch(
        "superset.localization.api_utils.get_user_locale", return_value="de"
    ), patch("superset.localization.api_utils.db") as mock_db:
        # Only slice_name has translation, description does not
        mock_db.session.query.return_value.filter.return_value.all.return_value = (
            _mock_query_result(
                [
                    (1, {"slice_name": {"de": "Umsatzdiagramm"}}),
                ]
            )
        )
        from superset.models.slice import Slice

        localize_list_response(items, Slice, ["slice_name", "description"])

    assert items[0]["slice_name"] == "Umsatzdiagramm"
    assert items[0]["description"] == "Shows revenue"  # unchanged


def test_dashboard_pre_get_list_localizes_and_renames_tags(
    app_context: None,
) -> None:
    """
    DashboardRestApi.pre_get_list must both localize titles AND preserve
    CustomTagsOptimizationMixin's custom_tags → tags renaming.

    DashboardRestApi inherits CustomTagsOptimizationMixin which renames
    custom_tags to tags in pre_get_list. Our override must call super()
    to keep that chain intact, otherwise frontend receives wrong key.
    """
    from superset.dashboards.api import DashboardRestApi

    instance = object.__new__(DashboardRestApi)
    instance._custom_tags_only = True

    response = {
        "result": [
            {
                "id": 1,
                "dashboard_title": "Sales",
                "custom_tags": [{"id": 10, "name": "finance"}],
            },
        ]
    }

    with patch("superset.dashboards.api.localize_list_response") as mock_localize:
        instance.pre_get_list(response)

    # Localization was invoked with correct args
    from superset.models.dashboard import Dashboard

    mock_localize.assert_called_once_with(
        response["result"], Dashboard, ["dashboard_title"]
    )

    # Mixin's custom_tags → tags renaming happened (requires super() call)
    item = response["result"][0]
    assert "tags" in item
    assert "custom_tags" not in item
    assert item["tags"] == [{"id": 10, "name": "finance"}]
