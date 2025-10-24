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

import pytest

from superset.utils.slack import get_channels_with_search, SlackChannelTypes


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
            "channels": [
                {
                    "name": "general",
                    "id": "C12345",
                    "is_private": False,
                    "is_member": True,
                }
            ],
            "response_metadata": {"next_cursor": None},
        }

        # Mock class instance with data property
        mock_response_instance = MockResponse(mock_data)

        mock_client = mocker.Mock()
        mock_client.conversations_list.return_value = mock_response_instance
        mocker.patch("superset.utils.slack.get_slack_client", return_value=mock_client)

        result = get_channels_with_search()
        assert result == {
            "result": [
                {
                    "name": "general",
                    "id": "C12345",
                    "is_private": False,
                    "is_member": True,
                }
            ],
            "next_cursor": None,
            "has_more": False,
        }

    # Handle an empty search string gracefully
    def test_handle_empty_search_string(self, mocker):
        mock_data = {
            "channels": [
                {
                    "name": "general",
                    "id": "C12345",
                    "is_private": False,
                    "is_member": True,
                }
            ],
            "response_metadata": {"next_cursor": None},
        }

        mock_response_instance = MockResponse(mock_data)
        mock_client = mocker.Mock()
        mock_client.conversations_list.return_value = mock_response_instance
        mocker.patch("superset.utils.slack.get_slack_client", return_value=mock_client)

        result = get_channels_with_search(search_string="")
        assert result == {
            "result": [
                {
                    "name": "general",
                    "id": "C12345",
                    "is_private": False,
                    "is_member": True,
                }
            ],
            "next_cursor": None,
            "has_more": False,
        }

    def test_handle_exact_match_search_string_single_channel(self, mocker):
        # Mock data with multiple channels
        mock_data = {
            "channels": [
                {
                    "name": "general",
                    "id": "C12345",
                    "is_private": False,
                    "is_member": True,
                },
                {
                    "name": "general2",
                    "id": "C13454",
                    "is_private": False,
                    "is_member": True,
                },
                {
                    "name": "random",
                    "id": "C67890",
                    "is_private": False,
                    "is_member": True,
                },
            ],
            "response_metadata": {"next_cursor": None},
        }

        # Mock response and client setup
        mock_response_instance = MockResponse(mock_data)
        mock_client = mocker.Mock()
        mock_client.conversations_list.return_value = mock_response_instance
        mocker.patch("superset.utils.slack.get_slack_client", return_value=mock_client)

        # Call the function with a search string that matches a single channel
        result = get_channels_with_search(
            search_string="general", exact_match=True, limit=100
        )

        # Assert that the result is a dict with proper structure
        assert result == {
            "result": [
                {
                    "name": "general",
                    "id": "C12345",
                    "is_private": False,
                    "is_member": True,
                }
            ],
            "next_cursor": None,
            "has_more": False,
        }

    def test_handle_exact_match_search_string_multiple_channels(self, mocker):
        mock_data = {
            "channels": [
                {
                    "name": "general",
                    "id": "C12345",
                    "is_private": False,
                    "is_member": True,
                },
                {
                    "name": "general2",
                    "id": "C13454",
                    "is_private": False,
                    "is_member": True,
                },
                {
                    "name": "random",
                    "id": "C67890",
                    "is_private": False,
                    "is_member": True,
                },
            ],
            "response_metadata": {"next_cursor": None},
        }

        mock_response_instance = MockResponse(mock_data)
        mock_client = mocker.Mock()
        mock_client.conversations_list.return_value = mock_response_instance
        mocker.patch("superset.utils.slack.get_slack_client", return_value=mock_client)

        result = get_channels_with_search(
            search_string="general", exact_match=True, limit=100
        )
        assert result == {
            "result": [
                {
                    "name": "general",
                    "id": "C12345",
                    "is_private": False,
                    "is_member": True,
                },
            ],
            "next_cursor": None,
            "has_more": False,
        }

    def test_handle_loose_match_search_string_multiple_channels(self, mocker):
        mock_data = {
            "channels": [
                {
                    "name": "general",
                    "id": "C12345",
                    "is_private": False,
                    "is_member": True,
                },
                {
                    "name": "general2",
                    "id": "C13454",
                    "is_private": False,
                    "is_member": True,
                },
                {
                    "name": "random",
                    "id": "C67890",
                    "is_private": False,
                    "is_member": True,
                },
            ],
            "response_metadata": {"next_cursor": None},
        }

        mock_response_instance = MockResponse(mock_data)
        mock_client = mocker.Mock()
        mock_client.conversations_list.return_value = mock_response_instance
        mocker.patch("superset.utils.slack.get_slack_client", return_value=mock_client)

        result = get_channels_with_search(search_string="general", limit=100)
        assert result == {
            "result": [
                {
                    "name": "general",
                    "id": "C12345",
                    "is_private": False,
                    "is_member": True,
                },
                {
                    "name": "general2",
                    "id": "C13454",
                    "is_private": False,
                    "is_member": True,
                },
            ],
            "next_cursor": None,
            "has_more": False,
        }

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
        # Determine which channels to return based on types parameter
        public_channel = {
            "id": "public_channel_id",
            "name": "open",
            "is_member": False,
            "is_private": False,
        }
        private_channel = {
            "id": "private_channel_id",
            "name": "secret",
            "is_member": False,
            "is_private": True,
        }

        # Mock should return channels matching the requested types
        # (simulating Slack API's type filtering)
        channels = []
        if not types or SlackChannelTypes.PUBLIC in types:
            channels.append(public_channel)
        if not types or SlackChannelTypes.PRIVATE in types:
            channels.append(private_channel)

        mock_data = {
            "channels": channels,
            "response_metadata": {"next_cursor": None},
        }

        mock_response_instance = MockResponse(mock_data)
        mock_client = mocker.Mock()
        mock_client.conversations_list.return_value = mock_response_instance
        mocker.patch("superset.utils.slack.get_slack_client", return_value=mock_client)

        result = get_channels_with_search(types=types)
        assert {channel["id"] for channel in result["result"]} == expected_channel_ids

    def test_handle_pagination_without_search(self, mocker):
        """Test pagination returns single page with cursor"""
        mock_data_page1 = {
            "channels": [
                {
                    "name": "general",
                    "id": "C12345",
                    "is_private": False,
                    "is_member": True,
                }
            ],
            "response_metadata": {"next_cursor": "page2_cursor"},
        }

        mock_response_instance_page1 = MockResponse(mock_data_page1)
        mock_client = mocker.Mock()
        mock_client.conversations_list.return_value = mock_response_instance_page1
        mocker.patch("superset.utils.slack.get_slack_client", return_value=mock_client)

        result = get_channels_with_search(limit=100)
        assert result == {
            "result": [
                {
                    "name": "general",
                    "id": "C12345",
                    "is_private": False,
                    "is_member": True,
                }
            ],
            "next_cursor": "page2_cursor",
            "has_more": True,
        }

    def test_handle_pagination_with_cursor(self, mocker):
        """Test pagination with cursor fetches next page"""
        mock_data_page2 = {
            "channels": [
                {
                    "name": "random",
                    "id": "C67890",
                    "is_private": False,
                    "is_member": True,
                }
            ],
            "response_metadata": {"next_cursor": None},
        }

        mock_response_instance_page2 = MockResponse(mock_data_page2)
        mock_client = mocker.Mock()
        mock_client.conversations_list.return_value = mock_response_instance_page2
        mocker.patch("superset.utils.slack.get_slack_client", return_value=mock_client)

        result = get_channels_with_search(cursor="page2_cursor", limit=100)
        assert result == {
            "result": [
                {
                    "name": "random",
                    "id": "C67890",
                    "is_private": False,
                    "is_member": True,
                }
            ],
            "next_cursor": None,
            "has_more": False,
        }

    def test_streaming_search_pagination(self, mocker):
        """Test search mode streams through pages until limit is reached"""
        mock_data_page1 = {
            "channels": [
                {"name": "general", "id": "C1", "is_private": False, "is_member": True},
                {"name": "random", "id": "C2", "is_private": False, "is_member": True},
            ],
            "response_metadata": {"next_cursor": "page2"},
        }
        mock_data_page2 = {
            "channels": [
                {
                    "name": "general-2",
                    "id": "C3",
                    "is_private": False,
                    "is_member": True,
                },
                {"name": "other", "id": "C4", "is_private": False, "is_member": True},
            ],
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

        # Search for "general" - should find 2 channels across 2 pages
        result = get_channels_with_search(search_string="general", limit=100)
        assert result == {
            "result": [
                {"name": "general", "id": "C1", "is_private": False, "is_member": True},
                {
                    "name": "general-2",
                    "id": "C3",
                    "is_private": False,
                    "is_member": True,
                },
            ],
            "next_cursor": None,
            "has_more": False,
        }

    def test_streaming_search_max_pages_safety_limit(self, mocker):
        """Test streaming search stops after 50 pages to prevent runaway requests"""

        # Create a response that always has a next cursor (infinite pagination)
        mock_data = {
            "channels": [
                {"name": "channel", "id": "C1", "is_private": False, "is_member": True},
            ],
            "response_metadata": {"next_cursor": "next_page"},
        }
        mock_response = MockResponse(mock_data)

        mock_client = mocker.Mock()
        mock_client.conversations_list.return_value = mock_response
        mocker.patch("superset.utils.slack.get_slack_client", return_value=mock_client)

        # Search that matches the channel - should stop at 50 pages
        result = get_channels_with_search(search_string="channel", limit=100)

        # Should have called conversations_list exactly 50 times (max pages)
        assert mock_client.conversations_list.call_count == 50
        # Should return the matches found (50 channels, one per page)
        assert len(result["result"]) == 50

    def test_search_with_no_matches(self, mocker):
        """Test search that finds no matching channels"""

        mock_data = {
            "channels": [
                {"name": "general", "id": "C1", "is_private": False, "is_member": True},
                {"name": "random", "id": "C2", "is_private": False, "is_member": True},
            ],
            "response_metadata": {"next_cursor": None},
        }
        mock_response = MockResponse(mock_data)

        mock_client = mocker.Mock()
        mock_client.conversations_list.return_value = mock_response
        mocker.patch("superset.utils.slack.get_slack_client", return_value=mock_client)

        # Search for non-existent channel
        result = get_channels_with_search(search_string="nonexistent", limit=100)

        assert result == {
            "result": [],
            "next_cursor": None,
            "has_more": False,
        }

    def test_search_returns_exactly_limit(self, mocker):
        """Test search that returns exactly the requested limit"""

        # Create 100 matching channels
        channels = [
            {"name": f"test-{i}", "id": f"C{i}", "is_private": False, "is_member": True}
            for i in range(100)
        ]

        mock_data = {
            "channels": channels,
            "response_metadata": {"next_cursor": "next_page"},
        }
        mock_response = MockResponse(mock_data)

        mock_client = mocker.Mock()
        mock_client.conversations_list.return_value = mock_response
        mocker.patch("superset.utils.slack.get_slack_client", return_value=mock_client)

        # Search that matches all channels
        result = get_channels_with_search(search_string="test", limit=100)

        # Should return exactly 100 channels
        assert len(result["result"]) == 100
        # Should indicate more results available
        assert result["has_more"] is True
        assert result["next_cursor"] == "next_page"

    def test_partial_page_results(self, mocker):
        """Test pagination with partial page (less than limit)"""

        # Only 50 channels returned (less than default 100 limit)
        channels = [
            {
                "name": f"channel-{i}",
                "id": f"C{i}",
                "is_private": False,
                "is_member": True,
            }
            for i in range(50)
        ]

        mock_data = {
            "channels": channels,
            "response_metadata": {"next_cursor": None},
        }
        mock_response = MockResponse(mock_data)

        mock_client = mocker.Mock()
        mock_client.conversations_list.return_value = mock_response
        mocker.patch("superset.utils.slack.get_slack_client", return_value=mock_client)

        result = get_channels_with_search(limit=100)

        # Should return all 50 channels
        assert len(result["result"]) == 50
        # Should indicate no more results
        assert result["has_more"] is False
        assert result["next_cursor"] is None

    def test_streaming_search_stops_when_limit_reached(self, mocker):
        """Test that streaming search stops immediately when limit is reached"""

        # First page with 60 matching channels
        page1_channels = [
            {"name": f"test-{i}", "id": f"C{i}", "is_private": False, "is_member": True}
            for i in range(60)
        ]
        # Second page with 60 more matching channels (should not be fully processed)
        page2_channels = [
            {
                "name": f"test-{i}",
                "id": f"C{i + 60}",
                "is_private": False,
                "is_member": True,
            }
            for i in range(60)
        ]

        mock_data_page1 = {
            "channels": page1_channels,
            "response_metadata": {"next_cursor": "page2"},
        }
        mock_data_page2 = {
            "channels": page2_channels,
            "response_metadata": {"next_cursor": "page3"},
        }

        mock_response_page1 = MockResponse(mock_data_page1)
        mock_response_page2 = MockResponse(mock_data_page2)

        mock_client = mocker.Mock()
        mock_client.conversations_list.side_effect = [
            mock_response_page1,
            mock_response_page2,
        ]
        mocker.patch("superset.utils.slack.get_slack_client", return_value=mock_client)

        # Request limit of 100
        result = get_channels_with_search(search_string="test", limit=100)

        # Should return exactly 100 channels (60 from page1 + 40 from page2)
        assert len(result["result"]) == 100
        # Should indicate more results available (next cursor points to page3)
        assert result["has_more"] is True
        assert result["next_cursor"] == "page3"

    def test_cursor_format_with_special_characters(self, mocker):
        """Test that cursor with special characters is handled correctly"""

        # Slack cursors are base64 encoded strings that might contain special chars
        special_cursor = "dGVhbTpDMDYxRkE1UEw="

        mock_data = {
            "channels": [
                {"name": "test", "id": "C123", "is_private": False, "is_member": True},
            ],
            "response_metadata": {"next_cursor": None},
        }
        mock_response = MockResponse(mock_data)

        mock_client = mocker.Mock()
        mock_client.conversations_list.return_value = mock_response
        mocker.patch("superset.utils.slack.get_slack_client", return_value=mock_client)

        # Call with special cursor
        get_channels_with_search(cursor=special_cursor, limit=100)

        # Verify cursor was passed to Slack API
        mock_client.conversations_list.assert_called_once()
        call_kwargs = mock_client.conversations_list.call_args[1]
        assert call_kwargs["cursor"] == special_cursor

    def test_empty_channel_list_response(self, mocker):
        """Test handling of empty channels list from Slack API"""

        mock_data = {
            "channels": [],
            "response_metadata": {"next_cursor": None},
        }
        mock_response = MockResponse(mock_data)

        mock_client = mocker.Mock()
        mock_client.conversations_list.return_value = mock_response
        mocker.patch("superset.utils.slack.get_slack_client", return_value=mock_client)

        result = get_channels_with_search()

        assert result == {
            "result": [],
            "next_cursor": None,
            "has_more": False,
        }

    def test_custom_limit_parameter(self, mocker):
        """Test that custom limit parameter is respected"""

        all_channels = [
            {
                "name": f"channel-{i}",
                "id": f"C{i}",
                "is_private": False,
                "is_member": True,
            }
            for i in range(200)
        ]

        # Mock should respect the limit parameter (simulating Slack API behavior)
        def mock_conversations_list(**kwargs):
            limit = kwargs.get("limit", 100)
            return MockResponse(
                {
                    "channels": all_channels[:limit],
                    "response_metadata": {"next_cursor": "next_page"},
                }
            )

        mock_client = mocker.Mock()
        mock_client.conversations_list.side_effect = mock_conversations_list
        mocker.patch("superset.utils.slack.get_slack_client", return_value=mock_client)

        # Request custom limit of 50
        result = get_channels_with_search(limit=50)

        # Should return exactly 50 channels
        assert len(result["result"]) == 50
        assert result["has_more"] is True

    def test_non_search_pagination_over_200_limit(self, mocker):
        """Test non-search queries paginate correctly for limits > 200"""
        # Create 500 channels
        all_channels = [
            {
                "name": f"channel-{i}",
                "id": f"C{i}",
                "is_private": False,
                "is_member": True,
            }
            for i in range(500)
        ]

        call_count = 0

        def mock_conversations_list(**kwargs):
            nonlocal call_count
            limit = kwargs.get("limit", 100)
            cursor = kwargs.get("cursor")

            # Simulate Slack API pagination (max 200 per page)
            if cursor is None:
                start = 0
            elif cursor == "cursor_200":
                start = 200
            elif cursor == "cursor_400":
                start = 400
            else:
                start = 600

            end = min(start + limit, 500)
            next_cursor = f"cursor_{end}" if end < 500 else None

            call_count += 1
            return MockResponse(
                {
                    "channels": all_channels[start:end],
                    "response_metadata": {"next_cursor": next_cursor},
                }
            )

        mock_client = mocker.Mock()
        mock_client.conversations_list.side_effect = mock_conversations_list
        mocker.patch("superset.utils.slack.get_slack_client", return_value=mock_client)

        # Request 300 channels (requires 2 pages of 200 each)
        result = get_channels_with_search(limit=300)

        # Should return exactly 300 channels
        assert len(result["result"]) == 300
        assert result["has_more"] is True
        assert result["next_cursor"] == "cursor_400"
        # Should have made 2 API calls
        assert call_count == 2

    def test_search_with_exact_match_optimization(self, mocker):
        """Test exact match search uses optimized string comparison"""
        channels = [
            {"name": "test", "id": "C1", "is_private": False, "is_member": True},
            {"name": "test-dev", "id": "C2", "is_private": False, "is_member": True},
            {"name": "testing", "id": "C3", "is_private": False, "is_member": True},
        ]
        mock_data = {"channels": channels, "response_metadata": {"next_cursor": None}}

        mock_response = MockResponse(mock_data)
        mock_client = mocker.Mock()
        mock_client.conversations_list.return_value = mock_response
        mocker.patch("superset.utils.slack.get_slack_client", return_value=mock_client)

        result = get_channels_with_search(
            search_string="TEST", exact_match=True, limit=100
        )

        # Only "test" should match (case-insensitive exact match)
        assert len(result["result"]) == 1
        assert result["result"][0]["name"] == "test"

    def test_search_substring_match_optimization(self, mocker):
        """Test substring search uses optimized string comparison"""
        channels = [
            {"name": "prod-api", "id": "C1", "is_private": False, "is_member": True},
            {"name": "dev-api", "id": "C2", "is_private": False, "is_member": True},
            {"name": "staging", "id": "C3", "is_private": False, "is_member": True},
        ]
        mock_data = {"channels": channels, "response_metadata": {"next_cursor": None}}

        mock_response = MockResponse(mock_data)
        mock_client = mocker.Mock()
        mock_client.conversations_list.return_value = mock_response
        mocker.patch("superset.utils.slack.get_slack_client", return_value=mock_client)

        result = get_channels_with_search(search_string="API", limit=100)

        # Both "prod-api" and "dev-api" should match (case-insensitive)
        assert len(result["result"]) == 2
        assert {ch["name"] for ch in result["result"]} == {"prod-api", "dev-api"}

    def test_search_by_channel_id(self, mocker):
        """Test search can match by channel ID"""
        channels = [
            {"name": "general", "id": "C12345", "is_private": False, "is_member": True},
            {"name": "random", "id": "C67890", "is_private": False, "is_member": True},
        ]
        mock_data = {"channels": channels, "response_metadata": {"next_cursor": None}}

        mock_response = MockResponse(mock_data)
        mock_client = mocker.Mock()
        mock_client.conversations_list.return_value = mock_response
        mocker.patch("superset.utils.slack.get_slack_client", return_value=mock_client)

        result = get_channels_with_search(
            search_string="c12345", exact_match=True, limit=100
        )

        # Should match by ID (case-insensitive)
        assert len(result["result"]) == 1
        assert result["result"][0]["id"] == "C12345"

    def test_non_search_empty_result_handling(self, mocker):
        """Test non-search query handles empty channel list"""
        mock_data = {
            "channels": [],
            "response_metadata": {"next_cursor": None},
        }

        mock_response = MockResponse(mock_data)
        mock_client = mocker.Mock()
        mock_client.conversations_list.return_value = mock_response
        mocker.patch("superset.utils.slack.get_slack_client", return_value=mock_client)

        result = get_channels_with_search(limit=100)

        assert len(result["result"]) == 0
        assert result["has_more"] is False
        assert result["next_cursor"] is None
