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
from unittest.mock import MagicMock, patch

import pytest

from superset.models.slice import id_or_uuid_filter, Slice


class TestSlice:
    """Test cases for Slice model functionality."""

    def test_slice_get_by_id_calls_filter_correctly(self):
        """
        Test that Slice.get() with numeric ID calls the correct SQLAlchemy
        filter method.
        """
        with patch("superset.models.slice.db") as mock_db:
            # Set up the mock chain properly
            mock_query = MagicMock()
            mock_filtered_query = MagicMock()
            mock_db.session.query.return_value = mock_query
            mock_query.filter.return_value = mock_filtered_query
            mock_filtered_query.one_or_none.return_value = None

            # This should not raise TypeError if filter() is used correctly
            result = Slice.get("123")

            # Verify that query() was called with Slice
            mock_db.session.query.assert_called_once_with(Slice)

            # Verify that filter() was called (not filter_by)
            mock_query.filter.assert_called_once()
            mock_filtered_query.one_or_none.assert_called_once()

            # Result should be None (mocked return value)
            assert result is None

    def test_slice_get_by_uuid_calls_filter_correctly(self):
        """
        Test that Slice.get() with UUID calls the correct SQLAlchemy
        filter method.
        """
        test_uuid = str(uuid.uuid4())

        with patch("superset.models.slice.db") as mock_db:
            # Set up the mock chain properly
            mock_query = MagicMock()
            mock_filtered_query = MagicMock()
            mock_db.session.query.return_value = mock_query
            mock_query.filter.return_value = mock_filtered_query
            mock_filtered_query.one_or_none.return_value = None

            # This should not raise TypeError if filter() is used correctly
            result = Slice.get(test_uuid)

            # Verify that query() was called with Slice
            mock_db.session.query.assert_called_once_with(Slice)

            # Verify that filter() was called (not filter_by)
            mock_query.filter.assert_called_once()
            mock_filtered_query.one_or_none.assert_called_once()

            # Result should be None (mocked return value)
            assert result is None

    def test_slice_get_no_type_error(self):
        """
        Integration test - verify Slice.get() doesn't raise TypeError
        for ID or UUID.
        """
        test_cases = ["1", "999", str(uuid.uuid4())]

        for test_input in test_cases:
            try:
                result = Slice.get(test_input)
                # Success - no TypeError occurred, result can be None or a Slice.  # noqa: E501
                assert result is None or hasattr(result, "id")
            except TypeError as e:
                if "filter_by() takes 1 positional argument but 2 were given" in str(e):
                    pytest.fail(
                        f"filter_by() bug exists: Slice.get('{test_input}') failed with {e}"  # noqa: E501
                    )
                else:
                    # Some other TypeError - re-raise for investigation
                    raise

    def test_id_or_uuid_filter_with_numeric_id(self):
        """Test that id_or_uuid_filter works with numeric ID strings."""
        # Simple test - just verify it doesn't crash and returns something
        result = id_or_uuid_filter("123")
        # Should return a BinaryExpression that can be used with filter()
        assert result is not None
        # The important thing is it doesn't crash and returns a filter expression.  # noqa: E501

    def test_id_or_uuid_filter_with_uuid(self):
        """Test that id_or_uuid_filter works with UUID strings."""
        test_uuid = "abc-def-123-456"

        # Simple test - just verify it doesn't crash and returns something
        result = id_or_uuid_filter(test_uuid)
        # Should return a BinaryExpression that can be used with filter()
        assert result is not None
        # The important thing is it doesn't crash and returns a filter expression.  # noqa: E501
