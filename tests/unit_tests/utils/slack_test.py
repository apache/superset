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

import warnings
from email.message import Message
from http.client import RemoteDisconnected
from urllib.error import HTTPError, URLError

import pytest
from slack_sdk.errors import (
    SlackApiError,
    SlackClientConfigurationError,
    SlackClientNotConnectedError,
    SlackRequestError,
    SlackTokenRotationError,
)
from slack_sdk.http_retry.builtin_handlers import (
    ConnectionErrorRetryHandler,
    RateLimitErrorRetryHandler,
)

from superset.constants import CACHE_DISABLED_TIMEOUT
from superset.exceptions import SupersetException
from superset.utils.slack import (
    _emit_v1_flag_off_deprecation,
    _emit_v1_scope_missing_deprecation,
    _is_transient_slack_api_error,
    _SLACK_V1_DEPRECATION_MESSAGE,
    get_channels_with_search,
    get_slack_client,
    refresh_cached_slack_channels_with_search,
    should_use_v2_api,
    SlackChannelListingClientError,
    SlackChannelListingError,
    SlackChannelTypes,
    SlackV2ProbeClientError,
    SlackV2ProbeError,
)


class MockResponse:
    def __init__(self, data, status_code: int | None = None):
        self._data = data
        self.status_code = status_code

    @property
    def data(self):
        return self._data


def test_delivery_client_disables_outcome_unknown_connection_retries(mocker) -> None:
    mocker.patch.dict(
        "superset.utils.slack.app.config",
        {
            "SLACK_API_TOKEN": "xoxb-test",
            "SLACK_PROXY": None,
            "SLACK_API_TIMEOUT": 30,
            "SLACK_API_RATE_LIMIT_RETRY_COUNT": 2,
        },
    )

    delivery_client = get_slack_client(for_delivery=True)
    discovery_client = get_slack_client()

    assert not any(
        isinstance(handler, RateLimitErrorRetryHandler)
        for handler in delivery_client.retry_handlers
    )
    assert not any(
        isinstance(handler, ConnectionErrorRetryHandler)
        for handler in delivery_client.retry_handlers
    )
    assert any(
        isinstance(handler, ConnectionErrorRetryHandler)
        for handler in discovery_client.retry_handlers
    )
    assert any(
        isinstance(handler, RateLimitErrorRetryHandler)
        for handler in discovery_client.retry_handlers
    )


class TestGetChannelsWithSearch:
    # Fetch all channels when no search string is provided
    def test_fetch_all_channels_no_search_string(self, mocker):
        # Mock data
        mock_data = {
            "channels": [{"name": "general", "id": "C12345"}],
            "response_metadata": {"next_cursor": None},
        }

        # Mock class instance with data property
        mock_response_instance = MockResponse(mock_data)

        mock_client = mocker.Mock()
        mock_client.conversations_list.return_value = mock_response_instance
        mocker.patch("superset.utils.slack.get_slack_client", return_value=mock_client)

        result = get_channels_with_search()
        assert result == [{"name": "general", "id": "C12345"}]

    # Handle an empty search string gracefully
    def test_handle_empty_search_string(self, mocker):
        mock_data = {
            "channels": [{"name": "general", "id": "C12345"}],
            "response_metadata": {"next_cursor": None},
        }

        mock_response_instance = MockResponse(mock_data)
        mock_client = mocker.Mock()
        mock_client.conversations_list.return_value = mock_response_instance
        mocker.patch("superset.utils.slack.get_slack_client", return_value=mock_client)

        result = get_channels_with_search(search_string="")
        assert result == [{"name": "general", "id": "C12345"}]

    def test_handle_exact_match_search_string_single_channel(self, mocker):
        # Mock data with multiple channels
        mock_data = {
            "channels": [
                {"name": "general", "id": "C12345"},
                {"name": "general2", "id": "C13454"},
                {"name": "random", "id": "C67890"},
            ],
            "response_metadata": {"next_cursor": None},
        }

        # Mock response and client setup
        mock_response_instance = MockResponse(mock_data)
        mock_client = mocker.Mock()
        mock_client.conversations_list.return_value = mock_response_instance
        mocker.patch("superset.utils.slack.get_slack_client", return_value=mock_client)

        # Call the function with a search string that matches a single channel
        result = get_channels_with_search(search_string="general", exact_match=True)

        # Assert that the result is a list with a single channel dictionary
        assert result == [{"name": "general", "id": "C12345"}]

    def test_handle_exact_match_search_string_multiple_channels(self, mocker):
        mock_data = {
            "channels": [
                {"name": "general", "id": "C12345"},
                {"name": "general2", "id": "C13454"},
                {"name": "random", "id": "C67890"},
            ],
            "response_metadata": {"next_cursor": None},
        }

        mock_response_instance = MockResponse(mock_data)
        mock_client = mocker.Mock()
        mock_client.conversations_list.return_value = mock_response_instance
        mocker.patch("superset.utils.slack.get_slack_client", return_value=mock_client)

        result = get_channels_with_search(
            search_string="general,random", exact_match=True
        )
        assert result == [
            {"name": "general", "id": "C12345"},
            {"name": "random", "id": "C67890"},
        ]

    def test_handle_loose_match_search_string_multiple_channels(self, mocker):
        mock_data = {
            "channels": [
                {"name": "general", "id": "C12345"},
                {"name": "general2", "id": "C13454"},
                {"name": "random", "id": "C67890"},
            ],
            "response_metadata": {"next_cursor": None},
        }

        mock_response_instance = MockResponse(mock_data)
        mock_client = mocker.Mock()
        mock_client.conversations_list.return_value = mock_response_instance
        mocker.patch("superset.utils.slack.get_slack_client", return_value=mock_client)

        result = get_channels_with_search(search_string="general,random")
        assert result == [
            {"name": "general", "id": "C12345"},
            {"name": "general2", "id": "C13454"},
            {"name": "random", "id": "C67890"},
        ]

    def test_handle_slack_client_error_listing_channels(self, mocker):
        from slack_sdk.errors import SlackApiError

        from superset.exceptions import SupersetException

        mock_client = mocker.Mock()
        mock_client.conversations_list.side_effect = SlackApiError(
            "foo", "missing scope: channels:read"
        )
        mocker.patch("superset.utils.slack.get_slack_client", return_value=mock_client)

        with pytest.raises(SupersetException) as ex:
            get_channels_with_search()

        assert str(ex.value) == (
            """Failed to list channels: foo
The server responded with: missing scope: channels:read"""
        )

    @pytest.mark.parametrize(
        ("error_code", "expected_exception"),
        [
            ("invalid_auth", SlackChannelListingClientError),
            ("service_unavailable", SlackChannelListingError),
        ],
    )
    def test_channel_listing_preserves_slack_error_classification(
        self,
        mocker,
        error_code: str,
        expected_exception: type[Exception],
    ) -> None:
        mock_client = mocker.Mock()
        mock_client.conversations_list.side_effect = SlackApiError(
            "listing failed",
            {"ok": False, "error": error_code},
        )
        mocker.patch("superset.utils.slack.get_slack_client", return_value=mock_client)

        with pytest.raises(expected_exception):
            get_channels_with_search(force=True)

    @pytest.mark.parametrize(
        "types, expected_channel_ids",
        [
            ([SlackChannelTypes.PUBLIC], {"public_channel_id"}),
            ([SlackChannelTypes.PRIVATE], {"private_channel_id"}),
            (
                [SlackChannelTypes.PUBLIC, SlackChannelTypes.PRIVATE],
                {"public_channel_id", "private_channel_id"},
            ),
            ([], {"public_channel_id", "private_channel_id"}),
        ],
    )
    def test_filter_channels_by_specified_types(
        self, types: list[SlackChannelTypes], expected_channel_ids: set[str], mocker
    ):
        mock_data = {
            "channels": [
                {
                    "id": "public_channel_id",
                    "name": "open",
                    "is_member": False,
                    "is_private": False,
                },
                {
                    "id": "private_channel_id",
                    "name": "secret",
                    "is_member": False,
                    "is_private": True,
                },
            ],
            "response_metadata": {"next_cursor": None},
        }

        mock_response_instance = MockResponse(mock_data)
        mock_client = mocker.Mock()
        mock_client.conversations_list.return_value = mock_response_instance
        mocker.patch("superset.utils.slack.get_slack_client", return_value=mock_client)

        result = get_channels_with_search(types=types)
        assert {channel["id"] for channel in result} == expected_channel_ids

    def test_passes_team_id_to_conversations_list_when_configured(self, mocker):
        # When SLACK_TEAM_ID is set (org-scoped token on an Enterprise Grid org),
        # it must be forwarded to conversations.list so Slack knows which
        # workspace to target.
        mock_data = {
            "channels": [{"name": "general", "id": "C12345"}],
            "response_metadata": {"next_cursor": None},
        }
        mock_client = mocker.Mock()
        mock_client.conversations_list.return_value = MockResponse(mock_data)
        mocker.patch("superset.utils.slack.get_slack_client", return_value=mock_client)
        mocker.patch.dict(
            "superset.utils.slack.app.config", {"SLACK_TEAM_ID": "T123456"}
        )

        get_channels_with_search(force=True)

        assert mock_client.conversations_list.call_args.kwargs["team_id"] == "T123456"

    def test_cache_hit_and_channels_come_from_one_read(self, mocker) -> None:
        cached_channels = [{"id": "C1", "name": "cached"}]
        cache_get = mocker.patch(
            "superset.utils.slack.cache_manager.cache.get",
            return_value=cached_channels,
        )
        channel_fetch = mocker.patch("superset.utils.slack._get_channels")
        mocker.patch.dict(
            "superset.utils.slack.app.config", {"SLACK_TEAM_ID": "T123456"}
        )

        channels, used_cache = get_channels_with_search(return_cache_status=True)

        assert channels == cached_channels
        assert used_cache is True
        cache_get.assert_called_once_with("slack_conversations_list_T123456")
        channel_fetch.assert_not_called()

    def test_disabled_cache_default_search_ignores_stale_entry(self, mocker) -> None:
        cache_get = mocker.patch(
            "superset.utils.slack.cache_manager.cache.get",
            return_value=[{"id": "C0", "name": "stale"}],
        )
        cache_set = mocker.patch("superset.utils.slack.cache_manager.cache.set")
        channel_fetch = mocker.patch(
            "superset.utils.slack._get_channels",
            side_effect=[
                [{"id": "C1", "name": "first"}],
                [{"id": "C2", "name": "second"}],
            ],
        )
        mocker.patch.dict(
            "superset.utils.slack.app.config",
            {"SLACK_CACHE_TIMEOUT": CACHE_DISABLED_TIMEOUT},
        )

        assert get_channels_with_search() == [{"id": "C1", "name": "first"}]
        assert get_channels_with_search() == [{"id": "C2", "name": "second"}]

        cache_get.assert_not_called()
        cache_set.assert_not_called()
        assert channel_fetch.call_count == 2

    def test_cache_miss_fetches_once_and_reports_live_provenance(self, mocker) -> None:
        live_channels = [{"id": "C2", "name": "live"}]
        cache_get = mocker.patch(
            "superset.utils.slack.cache_manager.cache.get",
            return_value=None,
        )
        channel_fetch = mocker.patch(
            "superset.utils.slack._get_channels",
            return_value=live_channels,
        )
        cache_set = mocker.patch("superset.utils.slack.cache_manager.cache.set")
        mocker.patch(
            "superset.utils.slack._slack_channel_cache_uses_report_session",
            return_value=False,
        )

        channels, used_cache = get_channels_with_search(return_cache_status=True)

        assert channels == live_channels
        assert used_cache is False
        cache_get.assert_called_once_with("slack_conversations_list")
        channel_fetch.assert_called_once_with(
            "slack_conversations_list",
            team_id=None,
            cache=False,
        )
        cache_set.assert_called_once_with(
            "slack_conversations_list",
            live_channels,
            timeout=mocker.ANY,
        )

    def test_metastore_cache_miss_fetches_without_cache_write(self, mocker) -> None:
        live_channels = [{"id": "C2", "name": "live"}]
        mocker.patch("superset.utils.slack.cache_manager.cache.get", return_value=None)
        channel_fetch = mocker.patch(
            "superset.utils.slack._get_channels",
            return_value=live_channels,
        )
        cache_set = mocker.patch("superset.utils.slack.cache_manager.cache.set")
        mocker.patch(
            "superset.utils.slack._slack_channel_cache_uses_report_session",
            return_value=True,
        )

        channels, used_cache = get_channels_with_search(return_cache_status=True)

        assert channels == live_channels
        assert used_cache is False
        channel_fetch.assert_called_once_with(
            "slack_conversations_list",
            team_id=None,
            cache=False,
        )
        cache_set.assert_not_called()

    def test_refreshes_cached_channels_once_per_workspace_cooldown(
        self, mocker
    ) -> None:
        refreshed_channels = [{"id": "C2", "name": "new", "is_private": False}]
        mocker.patch(
            "superset.utils.slack._slack_channel_cache_uses_report_session",
            return_value=False,
        )
        channel_search = mocker.patch(
            "superset.utils.slack.get_channels_with_search",
            return_value=refreshed_channels,
        )
        cache_get = mocker.patch(
            "superset.utils.slack.cache_manager.cache.get",
            return_value=None,
        )
        cache_set = mocker.patch(
            "superset.utils.slack.cache_manager.cache.set",
            return_value=True,
        )
        mocker.patch.dict(
            "superset.utils.slack.app.config", {"SLACK_TEAM_ID": "T123456"}
        )

        assert (
            refresh_cached_slack_channels_with_search(
                search_string="new",
                types=[SlackChannelTypes.PUBLIC],
                exact_match=True,
            )
            == refreshed_channels
        )

        channel_search.assert_called_once_with(
            force=True,
            cache=False,
        )
        cache_get.assert_called_once_with(
            "slack_conversations_list_T123456_refresh_cooldown"
        )
        assert cache_set.call_args_list == [
            mocker.call(
                "slack_conversations_list_T123456",
                refreshed_channels,
                timeout=mocker.ANY,
            ),
            mocker.call(
                "slack_conversations_list_T123456_refresh_cooldown",
                True,
                timeout=300,
            ),
        ]

    def test_failed_channel_cache_write_does_not_record_cooldown(self, mocker) -> None:
        refreshed_channels = [{"id": "C2", "name": "new"}]
        mocker.patch(
            "superset.utils.slack._slack_channel_cache_uses_report_session",
            return_value=False,
        )
        channel_search = mocker.patch(
            "superset.utils.slack.get_channels_with_search",
            return_value=refreshed_channels,
        )
        mocker.patch(
            "superset.utils.slack.cache_manager.cache.get",
            return_value=None,
        )
        cache_set = mocker.patch(
            "superset.utils.slack.cache_manager.cache.set",
            return_value=False,
        )

        assert refresh_cached_slack_channels_with_search(search_string="new") == [
            {"id": "C2", "name": "new"}
        ]
        assert refresh_cached_slack_channels_with_search(search_string="new") == [
            {"id": "C2", "name": "new"}
        ]

        assert channel_search.call_count == 2
        assert cache_set.call_args_list == [
            mocker.call(
                "slack_conversations_list",
                refreshed_channels,
                timeout=mocker.ANY,
            ),
            mocker.call(
                "slack_conversations_list",
                refreshed_channels,
                timeout=mocker.ANY,
            ),
        ]

    def test_disabled_cache_refresh_ignores_stale_cooldown(self, mocker) -> None:
        mocker.patch(
            "superset.utils.slack._slack_channel_cache_uses_report_session",
            return_value=False,
        )
        cache_get = mocker.patch(
            "superset.utils.slack.cache_manager.cache.get",
            return_value=True,
        )
        cache_set = mocker.patch("superset.utils.slack.cache_manager.cache.set")
        channel_search = mocker.patch(
            "superset.utils.slack.get_channels_with_search",
            return_value=[{"id": "C2", "name": "new"}],
        )
        mocker.patch.dict(
            "superset.utils.slack.app.config",
            {"SLACK_CACHE_TIMEOUT": CACHE_DISABLED_TIMEOUT},
        )

        assert refresh_cached_slack_channels_with_search(search_string="new") == [
            {"id": "C2", "name": "new"}
        ]
        assert refresh_cached_slack_channels_with_search(search_string="new") == [
            {"id": "C2", "name": "new"}
        ]

        assert channel_search.call_args_list == [
            mocker.call(
                search_string="new",
                types=None,
                exact_match=False,
                force=True,
                cache=False,
            ),
            mocker.call(
                search_string="new",
                types=None,
                exact_match=False,
                force=True,
                cache=False,
            ),
        ]
        cache_get.assert_not_called()
        cache_set.assert_not_called()

    def test_recent_refresh_uses_cached_channels_without_another_force(
        self, mocker
    ) -> None:
        mocker.patch(
            "superset.utils.slack._slack_channel_cache_uses_report_session",
            return_value=False,
        )
        mocker.patch("superset.utils.slack.cache_manager.cache.get", return_value=True)
        channel_search = mocker.patch(
            "superset.utils.slack.get_channels_with_search",
            return_value=[{"id": "C2", "name": "new"}],
        )

        assert refresh_cached_slack_channels_with_search(search_string="new") == [
            {"id": "C2", "name": "new"}
        ]

        channel_search.assert_called_once_with(
            search_string="new",
            types=None,
            exact_match=False,
            force=False,
        )

    def test_session_backed_cache_uses_uncached_refresh(self, mocker) -> None:
        mocker.patch(
            "superset.utils.slack._slack_channel_cache_uses_report_session",
            return_value=True,
        )
        cache_get = mocker.patch("superset.utils.slack.cache_manager.cache.get")
        cache_set = mocker.patch("superset.utils.slack.cache_manager.cache.set")
        channel_search = mocker.patch(
            "superset.utils.slack.get_channels_with_search",
            return_value=[{"id": "C2", "name": "new"}],
        )

        assert refresh_cached_slack_channels_with_search(search_string="new") == [
            {"id": "C2", "name": "new"}
        ]

        channel_search.assert_called_once_with(
            search_string="new",
            types=None,
            exact_match=False,
            force=True,
            cache=False,
        )
        cache_get.assert_not_called()
        cache_set.assert_not_called()

    def test_failed_forced_refresh_does_not_record_cooldown(self, mocker) -> None:
        mocker.patch(
            "superset.utils.slack._slack_channel_cache_uses_report_session",
            return_value=False,
        )
        channel_search = mocker.patch(
            "superset.utils.slack.get_channels_with_search",
            side_effect=SupersetException("Slack listing failed"),
        )
        mocker.patch(
            "superset.utils.slack.cache_manager.cache.get",
            return_value=None,
        )
        cache_set = mocker.patch("superset.utils.slack.cache_manager.cache.set")

        with pytest.raises(SupersetException, match="Slack listing failed"):
            refresh_cached_slack_channels_with_search(search_string="new")

        channel_search.assert_called_once_with(
            force=True,
            cache=False,
        )
        cache_set.assert_not_called()

    def test_resolves_callable_team_id(self, mocker):
        # SLACK_TEAM_ID may be a callable (e.g. to fetch from a secrets store),
        # mirroring SLACK_API_TOKEN; it is resolved before being forwarded.
        mock_data = {
            "channels": [{"name": "general", "id": "C12345"}],
            "response_metadata": {"next_cursor": None},
        }
        mock_client = mocker.Mock()
        mock_client.conversations_list.return_value = MockResponse(mock_data)
        mocker.patch("superset.utils.slack.get_slack_client", return_value=mock_client)
        mocker.patch.dict(
            "superset.utils.slack.app.config",
            {"SLACK_TEAM_ID": lambda: "T999999"},
        )

        get_channels_with_search(force=True)

        assert mock_client.conversations_list.call_args.kwargs["team_id"] == "T999999"

    def test_omits_team_id_from_conversations_list_when_not_configured(self, mocker):
        # Default behavior (workspace-level token): no team_id is sent.
        mock_data = {
            "channels": [{"name": "general", "id": "C12345"}],
            "response_metadata": {"next_cursor": None},
        }
        mock_client = mocker.Mock()
        mock_client.conversations_list.return_value = MockResponse(mock_data)
        mocker.patch("superset.utils.slack.get_slack_client", return_value=mock_client)
        mocker.patch.dict("superset.utils.slack.app.config", {"SLACK_TEAM_ID": None})

        get_channels_with_search(force=True)

        assert "team_id" not in mock_client.conversations_list.call_args.kwargs

    def test_should_use_v2_api_passes_team_id_when_configured(self, mocker):
        mock_client = mocker.Mock()
        mocker.patch("superset.utils.slack.get_slack_client", return_value=mock_client)
        mocker.patch(
            "superset.utils.slack.feature_flag_manager.is_feature_enabled",
            return_value=True,
        )
        mocker.patch.dict(
            "superset.utils.slack.app.config", {"SLACK_TEAM_ID": "T123456"}
        )

        assert should_use_v2_api() is True
        assert mock_client.conversations_list.call_args.kwargs["team_id"] == "T123456"

    def test_handle_pagination_multiple_pages(self, mocker):
        mock_data_page1 = {
            "channels": [{"name": "general", "id": "C12345"}],
            "response_metadata": {"next_cursor": "page2"},
        }
        mock_data_page2 = {
            "channels": [{"name": "random", "id": "C67890"}],
            "response_metadata": {"next_cursor": None},
        }

        mock_response_instance_page1 = MockResponse(mock_data_page1)
        mock_response_instance_page2 = MockResponse(mock_data_page2)

        mock_client = mocker.Mock()
        mock_client.conversations_list.side_effect = [
            mock_response_instance_page1,
            mock_response_instance_page2,
        ]
        mocker.patch("superset.utils.slack.get_slack_client", return_value=mock_client)

        result = get_channels_with_search()
        assert result == [
            {"name": "general", "id": "C12345"},
            {"name": "random", "id": "C67890"},
        ]


# ---------------------------------------------------------------------------
# should_use_v2_api: drives the v1→v2 auto-upgrade decision and emits
# DeprecationWarning + logger.warning for both no-flag and missing-scope cases.
# ---------------------------------------------------------------------------


@pytest.fixture(autouse=True)
def _reset_v1_warning_caches():
    """Each test sees fresh once-per-process warning state.

    The deprecation emitters are wrapped in `functools.cache` to give
    thread-safe one-shot semantics in production. Tests need them to fire
    again, so we clear the cache before and after each case.
    """
    _emit_v1_flag_off_deprecation.cache_clear()
    _emit_v1_scope_missing_deprecation.cache_clear()
    yield
    _emit_v1_flag_off_deprecation.cache_clear()
    _emit_v1_scope_missing_deprecation.cache_clear()


class TestShouldUseV2Api:
    def test_returns_true_when_flag_on_and_scopes_present(self, mocker):
        mocker.patch(
            "superset.utils.slack.feature_flag_manager.is_feature_enabled",
            return_value=True,
        )
        mock_client = mocker.Mock()
        mock_client.conversations_list.return_value = {
            "channels": [{"id": "C1", "name": "general"}]
        }
        mocker.patch("superset.utils.slack.get_slack_client", return_value=mock_client)

        with warnings.catch_warnings(record=True) as caught:
            warnings.simplefilter("always")
            assert should_use_v2_api() is True
            assert not any(issubclass(w.category, DeprecationWarning) for w in caught)
        mock_client.conversations_list.assert_called_once_with(
            limit=1,
            exclude_archived=True,
            types="public_channel,private_channel",
        )

    def test_returns_false_when_flag_off_and_emits_deprecation_once(self, mocker):
        mocker.patch(
            "superset.utils.slack.feature_flag_manager.is_feature_enabled",
            return_value=False,
        )
        logger_mock = mocker.patch("superset.utils.slack.logger")

        with warnings.catch_warnings(record=True) as caught:
            warnings.simplefilter("always")
            assert should_use_v2_api() is False
            assert should_use_v2_api() is False  # second call: no new warning
            assert should_use_v2_api() is False  # third call: no new warning

        deprecation_warnings = [
            w for w in caught if issubclass(w.category, DeprecationWarning)
        ]
        # Exactly one DeprecationWarning across three calls.
        assert len(deprecation_warnings) == 1
        assert str(deprecation_warnings[0].message) == _SLACK_V1_DEPRECATION_MESSAGE
        # logger.warning fires only once for the same reason.
        assert logger_mock.warning.call_count == 1
        assert (
            "ALERT_REPORT_SLACK_V2 is disabled" in logger_mock.warning.call_args.args[0]
        )

    def test_returns_false_when_scope_missing_and_emits_deprecation_once(self, mocker):
        mocker.patch(
            "superset.utils.slack.feature_flag_manager.is_feature_enabled",
            return_value=True,
        )
        mock_client = mocker.Mock()
        # The Slack SDK exposes the error code as `response["error"]`; that is
        # what `should_use_v2_api` branches on to decide whether the v1
        # deprecation warning is the appropriate signal.
        mock_client.conversations_list.side_effect = SlackApiError(
            message="missing_scope", response={"ok": False, "error": "missing_scope"}
        )
        mocker.patch("superset.utils.slack.get_slack_client", return_value=mock_client)
        logger_mock = mocker.patch("superset.utils.slack.logger")

        with warnings.catch_warnings(record=True) as caught:
            warnings.simplefilter("always")
            assert should_use_v2_api(raise_on_error=True) is False
            assert should_use_v2_api() is False
            assert should_use_v2_api() is False

        deprecation_warnings = [
            w for w in caught if issubclass(w.category, DeprecationWarning)
        ]
        # DeprecationWarning emitted exactly once across multiple calls.
        assert len(deprecation_warnings) == 1
        assert str(deprecation_warnings[0].message) == _SLACK_V1_DEPRECATION_MESSAGE
        # The user-visible scope-missing log fires every time, since operators
        # need to see the actionable message in their report-execution logs.
        assert logger_mock.warning.call_count == 3
        for c in logger_mock.warning.call_args_list:
            assert "channels:read" in c.args[0]
            assert "groups:read" in c.args[0]

    def test_scope_missing_detected_via_slack_response_data_shape(self, mocker):
        """The real Slack SDK sets `SlackApiError.response` to a `SlackResponse`
        whose payload lives in `.data` — not a plain dict. This is the
        production-default code path, so it must be exercised directly:
        `should_use_v2_api` reads the error code via `getattr(response, "data")`
        and the scope-missing branch must still fire.
        """
        mocker.patch(
            "superset.utils.slack.feature_flag_manager.is_feature_enabled",
            return_value=True,
        )
        mock_client = mocker.Mock()
        # MockResponse mirrors SlackResponse: the error payload is on `.data`,
        # exactly as the live SDK delivers it.
        mock_client.conversations_list.side_effect = SlackApiError(
            message="missing_scope",
            response=MockResponse({"ok": False, "error": "missing_scope"}),
        )
        mocker.patch("superset.utils.slack.get_slack_client", return_value=mock_client)
        logger_mock = mocker.patch("superset.utils.slack.logger")

        with warnings.catch_warnings(record=True) as caught:
            warnings.simplefilter("always")
            assert should_use_v2_api() is False

        deprecation_warnings = [
            w for w in caught if issubclass(w.category, DeprecationWarning)
        ]
        assert len(deprecation_warnings) == 1
        assert logger_mock.warning.call_count == 1
        assert "channels:read" in logger_mock.warning.call_args.args[0]

    @pytest.mark.parametrize("status_code", [429, 503])
    def test_transient_probe_error_detected_from_http_status(
        self,
        status_code: int,
    ) -> None:
        """Rate-limit and server HTTP statuses remain system failures."""
        error = SlackApiError(
            message="probe failed",
            response=MockResponse({"ok": False}, status_code=status_code),
        )

        assert _is_transient_slack_api_error(error, "") is True

    @pytest.mark.parametrize(
        "error_code",
        ["invalid_auth", "ratelimited", "fatal_error", "account_inactive", ""],
    )
    def test_returns_false_without_scope_warning_on_other_slack_errors(
        self, error_code: str, mocker
    ):
        """Non-scope `SlackApiError` codes must NOT be reported as a missing
        scope — that mislabels invalid_auth, ratelimited, or server-side
        failures as a permission problem and sends operators chasing the wrong
        fix. The probe still falls back to v1 so the send isn't lost, but the
        log line is generic and no DeprecationWarning fires.
        """
        mocker.patch(
            "superset.utils.slack.feature_flag_manager.is_feature_enabled",
            return_value=True,
        )
        mock_client = mocker.Mock()
        mock_client.conversations_list.side_effect = SlackApiError(
            message=error_code or "unknown",
            response={"ok": False, "error": error_code}
            if error_code
            else {"ok": False},
        )
        mocker.patch("superset.utils.slack.get_slack_client", return_value=mock_client)
        logger_mock = mocker.patch("superset.utils.slack.logger")

        with warnings.catch_warnings(record=True) as caught:
            warnings.simplefilter("always")
            assert should_use_v2_api() is False

        deprecation_warnings = [
            w for w in caught if issubclass(w.category, DeprecationWarning)
        ]
        assert deprecation_warnings == []
        assert logger_mock.warning.call_count == 1
        msg = logger_mock.warning.call_args.args[0]
        assert "probe failed" in msg
        assert "channels:read" not in msg

    @pytest.mark.parametrize(
        "exception",
        [
            SlackClientNotConnectedError("transport closed"),
            SlackRequestError("bad request args"),
            URLError("connection reset"),
        ],
    )
    def test_returns_false_on_slack_client_or_transport_error_from_probe(
        self, exception: Exception, mocker
    ):
        """Non-`SlackApiError` SDK failures (e.g. `SlackClientNotConnectedError`,
        `SlackRequestError`) are not subclasses of `SlackApiError`, so before the
        fix they escaped the probe raw. Because `should_use_v2_api` runs *before*
        the mapped Slack send `try`, that aborted the whole recipient loop instead
        of failing a single recipient. The probe must now treat any SDK client
        error as "v2 unavailable" and fall back to the deprecated v1 API so the
        send still flows through the per-recipient error handling.
        """
        mocker.patch(
            "superset.utils.slack.feature_flag_manager.is_feature_enabled",
            return_value=True,
        )
        mock_client = mocker.Mock()
        mock_client.conversations_list.side_effect = exception
        mocker.patch("superset.utils.slack.get_slack_client", return_value=mock_client)
        logger_mock = mocker.patch("superset.utils.slack.logger")

        assert should_use_v2_api() is False
        assert logger_mock.warning.call_count == 1
        assert "probe failed" in logger_mock.warning.call_args.args[0]

    @pytest.mark.parametrize(
        "exception",
        [
            SlackApiError(
                message="service unavailable",
                response={"ok": False, "error": "service_unavailable"},
            ),
            SlackApiError(
                message="rate limited",
                response={"ok": False, "error": "ratelimited"},
            ),
            SlackClientNotConnectedError("transport closed"),
            URLError("connection reset"),
            ConnectionResetError("connection reset"),
            RemoteDisconnected("connection closed"),
            TimeoutError("timed out"),
            HTTPError("https://slack.com", 504, "unavailable", Message(), None),
        ],
    )
    def test_raises_system_error_for_transient_probe_when_requested(
        self,
        exception: Exception,
        mocker,
    ) -> None:
        """File sends preserve transient probe failures for system handling."""
        mocker.patch(
            "superset.utils.slack.feature_flag_manager.is_feature_enabled",
            return_value=True,
        )
        mock_client = mocker.Mock()
        mock_client.conversations_list.side_effect = exception
        mocker.patch("superset.utils.slack.get_slack_client", return_value=mock_client)

        with pytest.raises(SlackV2ProbeError, match="probe failed"):
            should_use_v2_api(raise_on_error=True)

    @pytest.mark.parametrize(
        "exception",
        [
            SlackApiError(
                message="invalid auth",
                response={"ok": False, "error": "invalid_auth"},
            ),
            SlackRequestError("bad request args"),
            SlackClientConfigurationError("invalid client configuration"),
            SlackTokenRotationError("token rotation failed"),
            HTTPError("https://slack.com", 413, "too large", Message(), None),
        ],
    )
    def test_raises_client_error_for_permanent_probe_failure_when_requested(
        self,
        exception: Exception,
        mocker,
    ) -> None:
        """Permanent probe failures remain operator-fixable client errors."""
        mocker.patch(
            "superset.utils.slack.feature_flag_manager.is_feature_enabled",
            return_value=True,
        )
        mock_client = mocker.Mock()
        mock_client.conversations_list.side_effect = exception
        mocker.patch("superset.utils.slack.get_slack_client", return_value=mock_client)

        with pytest.raises(SlackV2ProbeClientError, match="probe failed") as exc_info:
            should_use_v2_api(raise_on_error=True)

        assert exc_info.value.status == 422

    def test_client_probe_error_has_common_probe_error_parent(self) -> None:
        assert issubclass(SlackV2ProbeClientError, SlackV2ProbeError)

    def test_propagates_non_sdk_errors_from_probe(self, mocker):
        """A truly unexpected, non-SDK exception (e.g. a programming error) still
        propagates out of `should_use_v2_api` rather than being silently swallowed
        as a v1 fallback — only Slack SDK client errors are treated as a graceful
        "v2 unavailable" signal.
        """
        mocker.patch(
            "superset.utils.slack.feature_flag_manager.is_feature_enabled",
            return_value=True,
        )
        mock_client = mocker.Mock()
        mock_client.conversations_list.side_effect = RuntimeError("unexpected boom")
        mocker.patch("superset.utils.slack.get_slack_client", return_value=mock_client)

        with pytest.raises(RuntimeError):
            should_use_v2_api()
