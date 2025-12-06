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

from typing import Any

from sqlalchemy.orm.session import Session

from superset import db


def test_list_versions_empty(
    session: Session,
    client: Any,
    full_api_access: None,
) -> None:
    """
    Test listing versions when no versions exist.
    """
    from superset.models.version_history import VersionHistory

    VersionHistory.metadata.create_all(db.session.get_bind())

    response = client.get("/api/v1/version/dashboard/999/list")
    assert response.status_code == 200
    result = response.json.get("result", {})
    assert result.get("count") == 0 or result.get("versions") == []


def test_list_versions_invalid_asset_type(
    session: Session,
    client: Any,
    full_api_access: None,
) -> None:
    """
    Test listing versions with invalid asset type returns error.
    """
    from superset.models.version_history import VersionHistory

    VersionHistory.metadata.create_all(db.session.get_bind())

    response = client.get("/api/v1/version/invalid_type/1/list")
    assert response.status_code in (400, 500)


def test_save_version_missing_description(
    session: Session,
    client: Any,
    full_api_access: None,
) -> None:
    """
    Test saving a version without description returns error.
    """
    from superset.models.version_history import VersionHistory

    VersionHistory.metadata.create_all(db.session.get_bind())

    response = client.post(
        "/api/v1/version/dashboard/1/save",
        json={},
    )
    assert response.status_code == 400


def test_restore_version_missing_version_number(
    session: Session,
    client: Any,
    full_api_access: None,
) -> None:
    """
    Test restoring a version without version_number returns error.
    """
    from superset.models.version_history import VersionHistory

    VersionHistory.metadata.create_all(db.session.get_bind())

    response = client.post(
        "/api/v1/version/dashboard/1/restore",
        json={},
    )
    assert response.status_code == 400
