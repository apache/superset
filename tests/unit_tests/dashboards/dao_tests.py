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
