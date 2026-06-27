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
from unittest.mock import Mock, patch
from superset.db_engine_specs.impala import ImpalaEngineSpec


@pytest.mark.parametrize("host, query_id", [
    # Exploit case: valid host with HTTPS URL construction
    ("impala-host.internal", "abcdef1234567890:fedcba0987654321"),
    # Boundary case: host with port specification (should be ignored)
    ("impala-host.internal:25000", "abcdef1234567890:fedcba0987654321"),
    # Valid input: standard case
    ("coordinator.example.com", "abcdef1234567890:fedcba0987654321"),
])
def test_cancel_query_uses_https_not_http(host: str, query_id: str) -> None:
    """Invariant: Cancel query requests must use HTTPS, not plain HTTP."""
    # Mock the query object providing the host via the expected attribute path
    mock_query = Mock()
    mock_query.database.url_object.host = host

    # Mock requests.post to capture the constructed URL
    with patch("superset.db_engine_specs.impala.requests.post") as mock_post, \
         patch("superset.db_engine_specs.impala.is_safe_host", return_value=True), \
         patch("superset.db_engine_specs.impala.app") as mock_app:

        mock_response = Mock()
        mock_response.status_code = 200
        mock_post.return_value = mock_response

        # Provide the config key consumed inside cancel_query; set to False so
        # the is_safe_host gate (mocked True above) is the one that allows the call.
        mock_app.config = {"IMPALA_CANCEL_QUERY_ALLOW_INTERNAL_HOSTS": False}

        ImpalaEngineSpec.cancel_query(None, mock_query, query_id)

        # Verify requests.post was reached
        assert mock_post.called

        # Extract the URL from the call
        call_args = mock_post.call_args
        constructed_url = call_args[0][0] if call_args[0] else call_args[1].get("url")

        # Security property: URL must start with https:// not http://
        assert constructed_url.startswith("https://"), \
            f"Cancel query URL must use HTTPS. Got: {constructed_url}"
