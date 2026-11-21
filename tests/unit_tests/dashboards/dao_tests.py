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
from typing import Any

import pytest
from pytest_mock import MockerFixture
from sqlalchemy.orm.session import Session

from superset.utils import json

LIMITS = {
    "schema_version": 1,
    "max_span": {"quantity": 90, "time_grain": "P1D"},
    "max_look_back": {"quantity": 13, "time_grain": "P1M"},
    "max_look_forward": {"quantity": 0, "time_grain": "P1D"},
}


@pytest.fixture
def session_with_data(session: Session) -> Iterator[Session]:
    from superset.models.core import FavStar  # noqa: F401
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


def test_add_favorite(session_with_data: Session) -> None:
    from superset.daos.dashboard import DashboardDAO

    dashboard = DashboardDAO.find_by_id(100, skip_base_filter=True)
    assert dashboard is not None
    assert len(DashboardDAO.favorited_ids([dashboard])) == 0

    DashboardDAO.add_favorite(dashboard)
    assert len(DashboardDAO.favorited_ids([dashboard])) == 1

    DashboardDAO.add_favorite(dashboard)
    assert len(DashboardDAO.favorited_ids([dashboard])) == 1


def test_remove_favorite(session_with_data: Session) -> None:
    from superset.daos.dashboard import DashboardDAO

    dashboard = DashboardDAO.find_by_id(100, skip_base_filter=True)
    assert dashboard is not None
    assert len(DashboardDAO.favorited_ids([dashboard])) == 0

    DashboardDAO.add_favorite(dashboard)
    assert len(DashboardDAO.favorited_ids([dashboard])) == 1

    DashboardDAO.remove_favorite(dashboard)
    assert len(DashboardDAO.favorited_ids([dashboard])) == 0

    DashboardDAO.remove_favorite(dashboard)
    assert len(DashboardDAO.favorited_ids([dashboard])) == 0


def dashboard_with_time_range_limits() -> Any:
    from superset.models.dashboard import Dashboard

    return Dashboard(
        json_metadata=json.dumps(
            {"time_range_limits": LIMITS, "native_filter_configuration": []}
        )
    )


def test_set_dash_metadata_keeps_time_range_limits() -> None:
    from superset.daos.dashboard import DashboardDAO

    dashboard = dashboard_with_time_range_limits()

    DashboardDAO.set_dash_metadata(dashboard, data={"color_scheme": "supersetColors"})

    metadata = json.loads(dashboard.json_metadata)
    assert metadata["time_range_limits"] == LIMITS
    assert metadata["color_scheme"] == "supersetColors"


def test_update_native_filters_config_keeps_time_range_limits() -> None:
    from superset.daos.dashboard import DashboardDAO

    dashboard = dashboard_with_time_range_limits()

    DashboardDAO.update_native_filters_config(
        dashboard, {"modified": [{"id": "NATIVE_FILTER-1", "name": "Filter"}]}
    )

    metadata = json.loads(dashboard.json_metadata)
    assert metadata["time_range_limits"] == LIMITS
    assert metadata["native_filter_configuration"] == [
        {"id": "NATIVE_FILTER-1", "name": "Filter"}
    ]


def test_update_chart_customizations_config_keeps_time_range_limits() -> None:
    from superset.daos.dashboard import DashboardDAO

    dashboard = dashboard_with_time_range_limits()

    DashboardDAO.update_chart_customizations_config(
        dashboard, {"modified": [{"id": "CHART_CUSTOMIZATION-1"}]}
    )

    metadata = json.loads(dashboard.json_metadata)
    assert metadata["time_range_limits"] == LIMITS
    assert metadata["chart_customization_config"] == [{"id": "CHART_CUSTOMIZATION-1"}]


def test_update_colors_config_keeps_time_range_limits() -> None:
    from superset.daos.dashboard import DashboardDAO

    dashboard = dashboard_with_time_range_limits()

    DashboardDAO.update_colors_config(dashboard, {"color_scheme": "supersetColors"})

    metadata = json.loads(dashboard.json_metadata)
    assert metadata["time_range_limits"] == LIMITS
    assert metadata["color_scheme"] == "supersetColors"


def span(quantity: int) -> dict[str, Any]:
    return {**LIMITS, "max_span": {"quantity": quantity, "time_grain": "P1W"}}


@pytest.mark.parametrize(
    ("body", "expected"),
    [
        ({"time_range_limits": span(5)}, span(5)),
        ({}, span(20)),
        ({"time_range_limits": None}, None),
    ],
    ids=["body-override", "no-key", "null"],
)
def test_copy_dashboard_takes_the_limits_from_the_body(
    session: Session, mocker: MockerFixture, body: dict[str, Any], expected: Any
) -> None:
    from superset.daos.dashboard import DashboardDAO
    from superset.models.dashboard import Dashboard

    Dashboard.metadata.create_all(session.get_bind())  # pylint: disable=no-member
    mocker.patch("superset.daos.dashboard.g", user=None)
    mocker.patch(
        "superset.daos.dashboard.security_manager.is_editor", return_value=True
    )
    original = Dashboard(
        dashboard_title="original",
        json_metadata=json.dumps(
            {"time_range_limits": span(20), "color_scheme": "supersetColors"}
        ),
    )

    copied = DashboardDAO.copy_dashboard(
        original,
        {"dashboard_title": "copy", "json_metadata": json.dumps(body)},
    )

    metadata = json.loads(copied.json_metadata)
    assert metadata.get("time_range_limits") == expected
    assert ("time_range_limits" in metadata) is (expected is not None)
    assert json.loads(original.json_metadata)["time_range_limits"] == span(20)
