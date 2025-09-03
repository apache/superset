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

from unittest.mock import MagicMock, patch

import pytest
from requests.exceptions import ConnectionError, HTTPError, Timeout

from superset.utils.query_sidecar import (
    build_query_object_from_form_data,
    QuerySidecarClient,
    QuerySidecarException,
)


class TestQuerySidecarClient:
    """Tests for the QuerySidecarClient class."""

    def test_init_default_config(self):
        """Test client initialization with default configuration."""
        with patch("superset.utils.query_sidecar.current_app") as mock_app:
            mock_app.config.get.return_value = "http://test:3001"
            client = QuerySidecarClient()
            assert client._base_url == "http://test:3001"
            assert client._timeout == 10

    def test_init_custom_config(self):
        """Test client initialization with custom configuration."""
        client = QuerySidecarClient("http://custom:3000", timeout=30)
        assert client._base_url == "http://custom:3000"
        assert client._timeout == 30

    @patch("superset.utils.query_sidecar.requests.Session")
    def test_build_query_object_success(self, mock_session_class):
        """Test successful query object building."""
        # Mock the session and response
        mock_session = MagicMock()
        mock_session_class.return_value = mock_session
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "query_object": {
                "metrics": ["count"],
                "columns": ["name"],
                "filters": [],
                "extras": {},
            }
        }
        mock_session.post.return_value = mock_response

        client = QuerySidecarClient("http://test:3001")
        form_data = {
            "datasource": "1__table",
            "viz_type": "table",
            "metrics": ["count"],
            "columns": ["name"],
        }

        result = client.build_query_object(form_data)

        assert result["metrics"] == ["count"]
        assert result["columns"] == ["name"]
        mock_session.post.assert_called_once()

    def test_build_query_object_missing_form_data(self):
        """Test error when form_data is missing."""
        client = QuerySidecarClient("http://test:3001")

        with pytest.raises(QuerySidecarException, match="form_data is required"):
            client.build_query_object(None)

    def test_build_query_object_invalid_form_data(self):
        """Test error when form_data is missing required fields."""
        client = QuerySidecarClient("http://test:3001")
        form_data = {"viz_type": "table"}  # Missing datasource

        with pytest.raises(
            QuerySidecarException, match="must include datasource and viz_type"
        ):
            client.build_query_object(form_data)

    @patch("superset.utils.query_sidecar.requests.Session")
    def test_build_query_object_service_error(self, mock_session_class):
        """Test handling of service errors."""
        mock_session = MagicMock()
        mock_session_class.return_value = mock_session
        mock_response = MagicMock()
        mock_response.json.return_value = {"error": "Service error"}
        mock_session.post.return_value = mock_response

        client = QuerySidecarClient("http://test:3001")
        form_data = {
            "datasource": "1__table",
            "viz_type": "table",
        }

        with pytest.raises(
            QuerySidecarException, match="Sidecar service error: Service error"
        ):
            client.build_query_object(form_data)

    @patch("superset.utils.query_sidecar.requests.Session")
    def test_build_query_object_timeout(self, mock_session_class):
        """Test handling of timeout errors."""
        mock_session = MagicMock()
        mock_session_class.return_value = mock_session
        mock_session.post.side_effect = Timeout("Request timeout")

        client = QuerySidecarClient("http://test:3001")
        form_data = {
            "datasource": "1__table",
            "viz_type": "table",
        }

        with pytest.raises(
            QuerySidecarException, match="Query sidecar service timeout"
        ):
            client.build_query_object(form_data)

    @patch("superset.utils.query_sidecar.requests.Session")
    def test_build_query_object_connection_error(self, mock_session_class):
        """Test handling of connection errors."""
        mock_session = MagicMock()
        mock_session_class.return_value = mock_session
        mock_session.post.side_effect = ConnectionError("Connection failed")

        client = QuerySidecarClient("http://test:3001")
        form_data = {
            "datasource": "1__table",
            "viz_type": "table",
        }

        with pytest.raises(
            QuerySidecarException, match="Unable to connect to query sidecar service"
        ):
            client.build_query_object(form_data)

    @patch("superset.utils.query_sidecar.requests.Session")
    def test_build_query_object_http_error(self, mock_session_class):
        """Test handling of HTTP errors."""
        mock_session = MagicMock()
        mock_session_class.return_value = mock_session
        mock_response = MagicMock()
        mock_response.status_code = 500
        mock_response.json.return_value = {"error": "Internal server error"}
        mock_http_error = HTTPError("500 Server Error")
        mock_http_error.response = mock_response
        mock_session.post.side_effect = mock_http_error

        client = QuerySidecarClient("http://test:3001")
        form_data = {
            "datasource": "1__table",
            "viz_type": "table",
        }

        with pytest.raises(
            QuerySidecarException, match="Query sidecar service is experiencing issues"
        ):
            client.build_query_object(form_data)

    @patch("superset.utils.query_sidecar.requests.Session")
    def test_create_query_object_from_form_data(self, mock_session_class):
        """Test creating QueryObject instance from form_data."""
        mock_session = MagicMock()
        mock_session_class.return_value = mock_session
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "query_object": {
                "metrics": ["count"],
                "columns": ["name"],
                "filters": [],
                "extras": {},
                "row_limit": 1000,
            }
        }
        mock_session.post.return_value = mock_response

        client = QuerySidecarClient("http://test:3001")
        form_data = {
            "datasource": "1__table",
            "viz_type": "table",
            "metrics": ["count"],
            "columns": ["name"],
        }

        query_object = client.create_query_object_from_form_data(form_data)

        assert query_object.metrics == ["count"]
        assert query_object.columns == ["name"]
        assert query_object.row_limit == 1000

    @patch("superset.utils.query_sidecar.requests.Session")
    def test_health_check_healthy(self, mock_session_class):
        """Test health check when service is healthy."""
        mock_session = MagicMock()
        mock_session_class.return_value = mock_session
        mock_response = MagicMock()
        mock_response.json.return_value = {"status": "healthy"}
        mock_session.get.return_value = mock_response

        client = QuerySidecarClient("http://test:3001")
        assert client.health_check() is True

    @patch("superset.utils.query_sidecar.requests.Session")
    def test_health_check_unhealthy(self, mock_session_class):
        """Test health check when service is unhealthy."""
        mock_session = MagicMock()
        mock_session_class.return_value = mock_session
        mock_session.get.side_effect = ConnectionError("Connection failed")

        client = QuerySidecarClient("http://test:3001")
        assert client.health_check() is False


class TestModuleFunctions:
    """Tests for module-level functions."""

    @patch("superset.utils.query_sidecar.get_query_sidecar_client")
    def test_build_query_object_from_form_data(self, mock_get_client):
        """Test the convenience function for building query objects."""
        mock_client = MagicMock()
        mock_get_client.return_value = mock_client
        mock_query_object = MagicMock()
        mock_client.create_query_object_from_form_data.return_value = mock_query_object

        form_data = {"datasource": "1__table", "viz_type": "table"}

        result = build_query_object_from_form_data(form_data)

        assert result == mock_query_object
        mock_client.create_query_object_from_form_data.assert_called_once_with(
            form_data, None, None
        )
