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
"""Unit tests for the ``/version`` endpoint and ``EXPOSE_VERSION_INFO`` gating."""

from typing import Any

from pytest_mock import MockerFixture

FULL_METADATA = {
    "version_string": "1.2.3",
    "version_sha": "abcd1234",
    "full_sha": "abcd1234ef567890",
    "build_number": "42",
    "branch_name": "master",
}


def test_version_exposes_full_metadata_by_default(
    client: Any,
    mocker: MockerFixture,
) -> None:
    """With EXPOSE_VERSION_INFO True (default) the full metadata is returned."""
    mocker.patch(
        "superset.utils.version.get_version_metadata",
        return_value=dict(FULL_METADATA),
    )
    client.application.config["EXPOSE_VERSION_INFO"] = True

    response = client.get("/version")
    assert response.status_code == 200

    body = response.get_json()
    assert body["version_string"] == "1.2.3"
    assert body["version_sha"] == "abcd1234"
    assert body["full_sha"] == "abcd1234ef567890"
    assert body["branch_name"] == "master"
    assert body["build_number"] == "42"


def test_version_redacts_details_when_flag_disabled(
    client: Any,
    mocker: MockerFixture,
) -> None:
    """With EXPOSE_VERSION_INFO False only VERSION_STRING from config is returned."""
    client.application.config["EXPOSE_VERSION_INFO"] = False
    client.application.config["VERSION_STRING"] = "1.2.3"

    response = client.get("/version")
    assert response.status_code == 200

    body = response.get_json()
    assert body == {"version_string": "1.2.3"}
    assert "version_sha" not in body
    assert "full_sha" not in body
    assert "branch_name" not in body
    assert "build_number" not in body
