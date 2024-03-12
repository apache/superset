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
from unittest import mock

import pytest

from tests.integration_tests.test_app import app


@pytest.mark.parametrize(
    "base_url",
    [
        "http://base-url",
        "http://base-url/",
    ],
    ids=["Without trailing slash", "With trailing slash"],
)
@mock.patch("superset.tasks.cache.request.Request")
@mock.patch("superset.tasks.cache.request.urlopen")
def test_fetch_url(mock_urlopen, mock_request_cls, base_url):
    from superset.tasks.cache import fetch_url

    mock_request = mock.MagicMock()
    mock_request_cls.return_value = mock_request

    mock_urlopen.return_value = mock.MagicMock()
    mock_urlopen.return_value.code = 200

    app.config["WEBDRIVER_BASEURL"] = base_url
    headers = {"key": "value"}
    data = "data"
    data_encoded = b"data"

    result = fetch_url(data, headers)

    assert data == result["success"]
    mock_request_cls.assert_called_once_with(
        "http://base-url/superset/warm_up_cache/",
        data=data_encoded,
        headers=headers,
        method="PUT",
    )
    # assert the same Request object is used
    mock_urlopen.assert_called_once_with(mock_request, timeout=mock.ANY)
