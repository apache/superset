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

import pytest
from sqlalchemy.orm.session import Session


@pytest.fixture
def session_with_data(session: Session) -> Iterator[Session]:
    from superset.models.dashboard import Dashboard

    engine = session.get_bind()
    Dashboard.metadata.create_all(engine)  # pylint: disable=no-member

    dashboard_obj = Dashboard(
        id=100,
        dashboard_title="test_dashboard",
        slug="test_slug",
        slices=[],
        published=True,
    )

    session.add(dashboard_obj)
    session.commit()
    yield session
    session.rollback()


@pytest.fixture
def session_with_dashboard_for_versions(session: Session) -> Iterator[Session]:
    """Session with Dashboard + DashboardVersion tables and one dashboard (DAO)."""
    from superset.models.dashboard import Dashboard

    engine = session.get_bind()
    Dashboard.metadata.create_all(engine)  # pylint: disable=no-member

    dashboard_obj = Dashboard(
        id=300,
        dashboard_title="test_dashboard_versions",
        slug="test_versions_slug",
        slices=[],
        published=True,
    )
    session.add(dashboard_obj)
    session.commit()
    yield session
    session.rollback()


def test_add_favorite(session: Session) -> None:
    from superset.daos.dashboard import DashboardDAO

    dashboard = DashboardDAO.find_by_id(100, skip_base_filter=True)
    if not dashboard:
        return
    assert len(DashboardDAO.favorited_ids([dashboard])) == 0

    DashboardDAO.add_favorite(dashboard)
    assert len(DashboardDAO.favorited_ids([dashboard])) == 1

    DashboardDAO.add_favorite(dashboard)
    assert len(DashboardDAO.favorited_ids([dashboard])) == 1


def test_remove_favorite(session: Session) -> None:
    from superset.daos.dashboard import DashboardDAO

    dashboard = DashboardDAO.find_by_id(100, skip_base_filter=True)
    if not dashboard:
        return
    assert len(DashboardDAO.favorited_ids([dashboard])) == 0

    DashboardDAO.add_favorite(dashboard)
    assert len(DashboardDAO.favorited_ids([dashboard])) == 1

    DashboardDAO.remove_favorite(dashboard)
    assert len(DashboardDAO.favorited_ids([dashboard])) == 0

    DashboardDAO.remove_favorite(dashboard)
    assert len(DashboardDAO.favorited_ids([dashboard])) == 0


def test_dashboard_version_dao_get_versions_empty(
    session_with_dashboard_for_versions: Session,
) -> None:
    from superset.daos.dashboard_version import DashboardVersionDAO

    versions = DashboardVersionDAO.get_versions_for_dashboard(300)
    assert versions == []


def test_dashboard_version_dao_create_and_get_versions(
    session_with_dashboard_for_versions: Session,
) -> None:
    from superset.daos.dashboard_version import DashboardVersionDAO

    v = DashboardVersionDAO.create(
        dashboard_id=300,
        version_number=1,
        position_json='{"ROOT_ID": {}}',
        json_metadata="{}",
        created_by_fk=None,
        description="First version",
    )
    assert v.id is not None
    assert v.version_number == 1
    assert v.description == "First version"

    versions = DashboardVersionDAO.get_versions_for_dashboard(300)
    assert len(versions) == 1
    assert versions[0].id == v.id


def test_dashboard_version_dao_get_by_id(
    session_with_dashboard_for_versions: Session,
) -> None:
    from superset.daos.dashboard_version import DashboardVersionDAO

    v = DashboardVersionDAO.create(
        dashboard_id=300,
        version_number=1,
        position_json=None,
        json_metadata=None,
        created_by_fk=None,
        description=None,
    )
    session_with_dashboard_for_versions.flush()

    found = DashboardVersionDAO.get_by_id(v.id)
    assert found is not None
    assert found.id == v.id
    assert found.dashboard_id == 300

    assert DashboardVersionDAO.get_by_id(999999) is None


def test_dashboard_version_dao_get_next_version_number(
    session_with_dashboard_for_versions: Session,
) -> None:
    from superset.daos.dashboard_version import DashboardVersionDAO

    assert DashboardVersionDAO.get_next_version_number(300) == 1

    DashboardVersionDAO.create(
        dashboard_id=300,
        version_number=1,
        position_json=None,
        json_metadata=None,
        created_by_fk=None,
        description=None,
    )
    session_with_dashboard_for_versions.flush()
    assert DashboardVersionDAO.get_next_version_number(300) == 2
