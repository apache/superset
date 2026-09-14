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

import uuid
from unittest.mock import MagicMock, patch, PropertyMock

import pytest
from flask import current_app
from parameterized import parameterized

from superset.models.slice import id_or_uuid_filter, Slice


class TestSlice:
    """Test cases for Slice model functionality."""

    @parameterized.expand(
        [
            ("numeric_id", "123"),
            ("uuid_string", "550e8400-e29b-41d4-a716-446655440000"),
        ]
    )
    def test_slice_get_calls_filter_correctly(self, test_name, id_or_uuid):
        """Test Slice.get() calls filter() correctly for ID and UUID."""
        with patch("superset.models.slice.db") as mock_db:
            # Setup mock chain
            mock_query = MagicMock()
            mock_filtered_query = MagicMock()
            mock_db.session.query.return_value = mock_query
            mock_query.filter.return_value = mock_filtered_query
            mock_filtered_query.one_or_none.return_value = None

            # Call the method
            result = Slice.get(id_or_uuid)

            # Verify correct methods called
            mock_db.session.query.assert_called_once_with(Slice)
            mock_query.filter.assert_called_once()  # Not filter_by!
            mock_filtered_query.one_or_none.assert_called_once()
            assert result is None

    @parameterized.expand(
        [
            ("numeric_id", "123"),
            ("large_id", "999999"),
            ("uuid_string", str(uuid.uuid4())),
        ]
    )
    def test_slice_get_no_type_error(self, test_name, input_value):
        """Verify Slice.get() doesn't raise TypeError for various inputs."""
        try:
            result = Slice.get(input_value)
            # Success - no TypeError, result can be None or a Slice
            assert result is None or hasattr(result, "id")
        except TypeError as e:
            if "filter_by() takes 1 positional argument" in str(e):
                pytest.fail(
                    f"filter_by() bug exists: Slice.get('{input_value}') failed with {e}"  # noqa: E501
                )
            else:
                raise

    @parameterized.expand(
        [
            ("numeric_id", "123"),
            ("uuid_format", "550e8400-e29b-41d4-a716-446655440000"),
            ("invalid_string", "not-a-number"),
            ("integer_id", 123),
        ]
    )
    def test_id_or_uuid_filter(self, test_name, input_value):
        """Test id_or_uuid_filter returns correct BinaryExpression."""
        result = id_or_uuid_filter(input_value)
        assert result is not None

    def test_datasource_url_returns_none_when_datasource_lacks_explore_url(self):
        """datasource_url() must not raise when the datasource has no explore_url.

        Charts whose datasource resolves to a Query (or any other type without
        explore_url) used to raise AttributeError, which caused the entire chart
        list API response to fail instead of just skipping that one chart.
        """
        slc = Slice()
        slc.id = 1

        # Simulate a datasource object that does NOT have explore_url (e.g. Query)
        mock_datasource = MagicMock(spec=[])  # spec=[] means no attributes at all
        slc.table = mock_datasource

        result = slc.datasource_url()
        assert result is None

    def test_datasource_url_returns_explore_url_when_present(self):
        """datasource_url() returns the datasource explore_url when it exists."""
        slc = Slice()
        slc.id = 1

        mock_table = MagicMock()
        mock_table.explore_url = "/explore/?datasource_type=table&datasource_id=1"
        slc.table = mock_table

        result = slc.datasource_url()
        assert result == "/explore/?datasource_type=table&datasource_id=1"

    def test_datasource_url_returns_none_when_no_datasource(self):
        """datasource_url() returns None when there is no datasource."""
        slc = Slice()
        slc.id = 1
        slc.table = None

        result = slc.datasource_url()
        assert result is None

    @staticmethod
    def _semantic_view_slice() -> Slice:
        """Build a chart on a semantic view, with a colliding table also attached.

        The table stands in for a regular dataset that happens to share the
        numeric id; it must never leak into the semantic-view chart's display.
        """
        slc = Slice()
        slc.id = 1
        slc.datasource_type = "semantic_view"
        slc.datasource_id = 2
        view = MagicMock()
        view.name = "orders"
        view.url = "/semantic_view/abc/"
        view.explore_url = "/explore/?datasource_type=semantic_view&datasource_id=2"
        view.link = "<a>orders</a>"
        slc.semantic_view = view
        table = MagicMock()
        table.name = "public.colliding_table"
        table.explore_url = "/explore/?datasource_type=table&datasource_id=2"
        slc.table = table
        return slc

    def test_datasource_url_uses_semantic_view_explore_url(self) -> None:
        """A semantic-view chart links to the view's Explore page, not a table's."""
        slc = self._semantic_view_slice()

        assert (
            slc.datasource_url()
            == "/explore/?datasource_type=semantic_view&datasource_id=2"
        )

    def test_datasource_name_text_uses_semantic_view_name(self) -> None:
        """A semantic-view chart is named after the view (no schema prefix)."""
        slc = self._semantic_view_slice()

        assert slc.datasource_name_text() == "orders"

    def test_display_datasource_never_falls_back_across_types(self) -> None:
        """A semantic-view chart with no view resolves to None, not to a table."""
        slc = self._semantic_view_slice()
        slc.semantic_view = None

        assert slc._display_datasource() is None
        assert slc.datasource_url() is None
        assert slc.datasource_name_text() is None

    def test_table_chart_display_is_unchanged_by_semantic_view_relationship(
        self,
    ) -> None:
        """A table chart ignores ``semantic_view`` even if it is populated."""
        slc = self._semantic_view_slice()
        slc.datasource_type = "table"

        assert slc.datasource_url() == "/explore/?datasource_type=table&datasource_id=2"
        assert slc.datasource_name_text() == "public.colliding_table"

    def test_datasource_edit_url_and_link_use_semantic_view(self) -> None:
        """Edit URL and legacy link come from the view for a semantic-view chart."""
        slc = self._semantic_view_slice()

        assert slc.datasource_edit_url == "/semantic_view/abc/"
        assert slc.datasource_link() == "<a>orders</a>"

    def test_datasource_link_is_none_when_unresolved(self) -> None:
        """A chart whose datasource cannot be resolved has no link, no error."""
        slc = self._semantic_view_slice()
        slc.semantic_view = None

        assert slc.datasource_link() is None
        assert slc.datasource_edit_url is None

    def test_icons_names_the_semantic_view(self) -> None:
        """icons uses the semantic view's name and edit URL for its tooltip."""
        slc = self._semantic_view_slice()

        html = slc.icons

        assert 'title="orders"' in html
        assert 'href="/semantic_view/abc/"' in html

    def test_icons_escapes_datasource_html(self):
        """icons must HTML-escape the datasource name and edit URL."""
        slc = Slice()
        with (
            patch.object(
                Slice,
                "datasource_edit_url",
                new_callable=PropertyMock,
                return_value='/x"onmouseover=alert(1)',
            ),
            patch.object(
                Slice,
                "datasource_name_text",
                return_value="<img src=x onerror=alert(1)>",
            ),
        ):
            html = slc.icons

        # The injected tag and attribute-breakout quote are escaped.
        assert "<img" not in html
        assert '"onmouseover' not in html


def test_thumbnail_url_is_router_relative_at_root(app_context: None) -> None:
    """thumbnail_url uses url_for, so at root it keeps the legacy shape."""
    slc = Slice()
    slc.id = 42

    with patch.object(
        Slice, "digest", new_callable=PropertyMock, return_value="abc123"
    ):
        with current_app.test_request_context("/"):
            url = slc.thumbnail_url

    assert url == "/api/v1/chart/42/thumbnail/abc123/"


def test_thumbnail_url_carries_app_root_prefix(app_context: None) -> None:
    """Under a subdirectory deployment the serialized thumbnail URL must carry
    the application root, because the frontend treats thumbnail_url as an
    already-prefixed raw fetch target (it is excluded from
    normalizeBackendUrls and never passed through ensureAppRoot)."""
    slc = Slice()
    slc.id = 42

    with patch.object(
        Slice, "digest", new_callable=PropertyMock, return_value="abc123"
    ):
        with current_app.test_request_context(
            "/", base_url="http://example.com/superset/"
        ):
            url = slc.thumbnail_url

    assert url == "/superset/api/v1/chart/42/thumbnail/abc123/"


def test_thumbnail_url_is_none_without_digest(app_context: None) -> None:
    slc = Slice()
    slc.id = 42

    with patch.object(Slice, "digest", new_callable=PropertyMock, return_value=None):
        with current_app.test_request_context("/"):
            assert slc.thumbnail_url is None


def test_thumbnail_url_works_outside_request_context(app_context: None) -> None:
    """The property must stay callable from out-of-request callers (CLI,
    celery tasks): with no request there is no SCRIPT_NAME to honor, so it
    falls back to the router-relative shape instead of raising."""
    slc = Slice()
    slc.id = 42

    with patch.object(
        Slice, "digest", new_callable=PropertyMock, return_value="abc123"
    ):
        url = slc.thumbnail_url

    assert url == "/api/v1/chart/42/thumbnail/abc123/"
