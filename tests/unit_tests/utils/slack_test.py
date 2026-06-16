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

import pytest
from slack_sdk.errors import SlackApiError, SlackClientNotConnectedError

from superset.utils.slack import (
    _emit_v1_flag_off_deprecation,
    _emit_v1_scope_missing_deprecation,
    _SLACK_V1_DEPRECATION_MESSAGE,
    get_channels_with_search,
    should_use_v2_api,
    SlackChannelTypes,
)


class MockResponse:
    def __init__(self, data):
        self._data = data

    @property
    def data(self):
        return self._data


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
            assert should_use_v2_api() is False
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

    def test_propagates_non_slack_api_errors_from_probe(self, mocker):
        """Any non-`SlackApiError` exception from the probe (network issue,
        unexpected SDK error) propagates out of `should_use_v2_api` rather than
        silently falling back to v1. Falling back on a non-API error would
        mask real bugs as "you don't have channels:read", which is misleading.
        """
        mocker.patch(
            "superset.utils.slack.feature_flag_manager.is_feature_enabled",
            return_value=True,
        )
        mock_client = mocker.Mock()
        mock_client.conversations_list.side_effect = SlackClientNotConnectedError(
            "transport closed"
        )
        mocker.patch("superset.utils.slack.get_slack_client", return_value=mock_client)

        with pytest.raises(SlackClientNotConnectedError):
            should_use_v2_api()
