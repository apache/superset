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

from collections.abc import Iterator
from datetime import datetime, timezone

import pytest
from sqlalchemy.orm.session import Session

from superset import db


@pytest.fixture
def session_with_data(session: Session) -> Iterator[Session]:
    from superset.models.version_history import AssetType, VersionHistory

    engine = session.get_bind()
    VersionHistory.metadata.create_all(engine)

    version = VersionHistory(
        asset_type=AssetType.DASHBOARD,
        asset_id=1,
        version_number=1,
        version_data='{"test": "data"}',
        description="Test version",
        created_on=datetime(2024, 1, 1, 12, 0, 0, tzinfo=timezone.utc),
        created_by_fk=1,
    )

    session.add(version)
    session.flush()
    yield session
    session.rollback()


def test_version_history_query(session_with_data: Session) -> None:
    from superset.models.version_history import AssetType, VersionHistory

    result = (
        db.session.query(VersionHistory)
        .filter(
            VersionHistory.asset_type == AssetType.DASHBOARD,
            VersionHistory.asset_id == 1,
        )
        .first()
    )

    assert result
    assert result.version_number == 1
    assert result.description == "Test version"


def test_version_history_query_not_found(session_with_data: Session) -> None:
    from superset.models.version_history import AssetType, VersionHistory

    result = (
        db.session.query(VersionHistory)
        .filter(
            VersionHistory.asset_type == AssetType.CHART,
            VersionHistory.asset_id == 999,
        )
        .first()
    )

    assert result is None


def test_version_history_repr(session_with_data: Session) -> None:
    from superset.models.version_history import AssetType, VersionHistory

    result = (
        db.session.query(VersionHistory)
        .filter(
            VersionHistory.asset_type == AssetType.DASHBOARD,
            VersionHistory.asset_id == 1,
        )
        .first()
    )

    assert result
    repr_str = repr(result)
    assert "asset_type=dashboard" in repr_str
    assert "asset_id=1" in repr_str
    assert "version=1" in repr_str
