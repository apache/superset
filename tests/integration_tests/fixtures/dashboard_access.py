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
"""Fixture for tests that need a dashboard, its chart and users with varied access.

Creates two dashboards (one published, one unpublished), each holding the same
"Big Number" chart that sits on a small virtual dataset with a ``count`` metric,
plus these users and roles:

* ``alpha_user1``: Alpha user
* ``gamma_user1``: Gamma user whose ``dataset_reader`` role grants
  ``datasource_access`` on the dataset
* ``gamma_user2``: Gamma user with no dataset access
"""

from collections.abc import Iterator
from typing import NamedTuple

import pytest
from flask.ctx import AppContext

from superset import db, security_manager
from superset.connectors.sqla.models import SqlaTable, SqlMetric, TableColumn
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice
from superset.utils import json
from superset.utils.core import DatasourceType, get_example_default_schema
from superset.utils.database import get_example_database
from tests.integration_tests.base_tests import subjects_from_users

PASSWORD = "general"  # noqa: S105
DATASET_NAME = "test_dataset"
CHART_NAME = "test_chart"
PUBLISHED_DASHBOARD_SLUG = "test-dashboard"
UNPUBLISHED_DASHBOARD_SLUG = "test-dashboard-unpublished"
DATASET_READER_ROLE = "dataset_reader"
ALPHA_USER1 = "alpha_user1"
GAMMA_USER1 = "gamma_user1"
GAMMA_USER2 = "gamma_user2"


def _add_user(username: str, role_names: list[str]):
    roles = [security_manager.find_role(name) for name in role_names]
    return security_manager.add_user(
        username, username, "user", f"{username}@example.com", roles, PASSWORD
    )


def _create_dataset() -> SqlaTable:
    dataset = SqlaTable(
        table_name=DATASET_NAME,
        schema=get_example_default_schema(),
        database=get_example_database(),
        sql="SELECT 1 AS id UNION ALL SELECT 2 UNION ALL SELECT 3",
        normalize_columns=False,
        always_filter_main_dttm=False,
    )
    dataset.columns = [TableColumn(column_name="id", type="INTEGER")]
    dataset.metrics = [SqlMetric(metric_name="count", expression="COUNT(*)")]
    db.session.add(dataset)
    db.session.commit()
    return dataset


def _create_chart(dataset: SqlaTable) -> Slice:
    chart = Slice(
        slice_name=CHART_NAME,
        viz_type="big_number_total",
        datasource_type=DatasourceType.TABLE,
        datasource_id=dataset.id,
        params=json.dumps(
            {
                "viz_type": "big_number_total",
                "datasource": f"{dataset.id}__table",
                "metric": "count",
            }
        ),
    )
    db.session.add(chart)
    db.session.commit()
    return chart


class DashboardAccessFixture(NamedTuple):
    published_dashboard: Dashboard
    unpublished_dashboard: Dashboard


def _create_dashboard(chart: Slice, slug: str, published: bool) -> Dashboard:
    dashboard = Dashboard(
        dashboard_title=slug,
        slug=slug,
        published=published,
        slices=[chart],
        editors=subjects_from_users([security_manager.find_user("admin")]),
    )
    db.session.add(dashboard)
    db.session.commit()
    return dashboard


@pytest.fixture
def dashboard_with_chart_and_users(
    app_context: AppContext,
) -> Iterator[DashboardAccessFixture]:
    dataset = _create_dataset()
    chart = _create_chart(dataset)
    published_dashboard = _create_dashboard(chart, PUBLISHED_DASHBOARD_SLUG, True)
    unpublished_dashboard = _create_dashboard(chart, UNPUBLISHED_DASHBOARD_SLUG, False)

    dataset_reader_role = security_manager.add_role(DATASET_READER_ROLE)
    security_manager.add_permission_role(
        dataset_reader_role,
        security_manager.find_permission_view_menu("datasource_access", dataset.perm),
    )

    users = [
        _add_user(ALPHA_USER1, ["Alpha"]),
        _add_user(GAMMA_USER1, ["Gamma", DATASET_READER_ROLE]),
        _add_user(GAMMA_USER2, ["Gamma"]),
    ]

    yield DashboardAccessFixture(published_dashboard, unpublished_dashboard)

    for user in users:
        db.session.delete(user)
    db.session.delete(dataset_reader_role)
    db.session.delete(published_dashboard)
    db.session.delete(unpublished_dashboard)
    db.session.delete(chart)
    db.session.delete(dataset)
    db.session.commit()
