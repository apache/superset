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

from superset.daos.dashboard import DashboardDAO
from superset.models.dashboard import Dashboard
from superset.utils import json


@pytest.fixture
def dashboard_with_customizations(session: Session) -> Iterator[Dashboard]:
    from superset.models.dashboard import Dashboard

    engine = session.get_bind()
    Dashboard.metadata.create_all(engine)

    initial_metadata = {
        "chart_customization_config": [
            {
                "id": "customization_1",
                "name": "Custom 1",
                "config": {"key": "value1"},
            },
            {
                "id": "customization_2",
                "name": "Custom 2",
                "config": {"key": "value2"},
            },
        ]
    }

    dashboard = Dashboard(
        id=200,
        dashboard_title="test_dashboard_customizations",
        slug="test_customizations_slug",
        slices=[],
        published=True,
        json_metadata=json.dumps(initial_metadata),
    )

    session.add(dashboard)
    session.commit()
    yield dashboard
    session.rollback()


@pytest.fixture
def dashboard_without_customizations(session: Session) -> Iterator[Dashboard]:
    from superset.models.dashboard import Dashboard

    engine = session.get_bind()
    Dashboard.metadata.create_all(engine)

    dashboard = Dashboard(
        id=201,
        dashboard_title="test_dashboard_no_customizations",
        slug="test_no_customizations_slug",
        slices=[],
        published=True,
        json_metadata="{}",
    )

    session.add(dashboard)
    session.commit()
    yield dashboard
    session.rollback()


def test_add_new_chart_customizations(
    dashboard_without_customizations: Dashboard,
) -> None:
    attributes = {
        "modified": [
            {
                "id": "new_customization_1",
                "name": "New Custom 1",
                "config": {"new_key": "new_value"},
            }
        ],
        "deleted": [],
        "reordered": [],
    }

    result = DashboardDAO.update_chart_customizations_config(
        dashboard_without_customizations, attributes
    )

    assert len(result) == 1
    assert result[0]["id"] == "new_customization_1"
    assert result[0]["name"] == "New Custom 1"

    metadata = json.loads(dashboard_without_customizations.json_metadata)
    assert "chart_customization_config" in metadata
    assert len(metadata["chart_customization_config"]) == 1


def test_modify_existing_chart_customizations(
    dashboard_with_customizations: Dashboard,
) -> None:
    attributes = {
        "modified": [
            {
                "id": "customization_1",
                "name": "Modified Custom 1",
                "config": {"key": "modified_value"},
            }
        ],
        "deleted": [],
        "reordered": [],
    }

    result = DashboardDAO.update_chart_customizations_config(
        dashboard_with_customizations, attributes
    )

    assert len(result) == 2
    assert result[0]["name"] == "Modified Custom 1"
    assert result[0]["config"]["key"] == "modified_value"
    assert result[1]["name"] == "Custom 2"


def test_delete_chart_customizations(
    dashboard_with_customizations: Dashboard,
) -> None:
    attributes = {
        "modified": [],
        "deleted": ["customization_1"],
        "reordered": [],
    }

    result = DashboardDAO.update_chart_customizations_config(
        dashboard_with_customizations, attributes
    )

    assert len(result) == 1
    assert result[0]["id"] == "customization_2"

    metadata = json.loads(dashboard_with_customizations.json_metadata)
    assert len(metadata["chart_customization_config"]) == 1


def test_reorder_chart_customizations(
    dashboard_with_customizations: Dashboard,
) -> None:
    attributes = {
        "modified": [],
        "deleted": [],
        "reordered": ["customization_2", "customization_1"],
    }

    result = DashboardDAO.update_chart_customizations_config(
        dashboard_with_customizations, attributes
    )

    assert len(result) == 2
    assert result[0]["id"] == "customization_2"
    assert result[1]["id"] == "customization_1"


def test_add_and_reorder_chart_customizations(
    dashboard_with_customizations: Dashboard,
) -> None:
    attributes = {
        "modified": [
            {
                "id": "customization_3",
                "name": "Custom 3",
                "config": {"key": "value3"},
            }
        ],
        "deleted": [],
        "reordered": ["customization_3", "customization_1", "customization_2"],
    }

    result = DashboardDAO.update_chart_customizations_config(
        dashboard_with_customizations, attributes
    )

    assert len(result) == 3
    assert result[0]["id"] == "customization_3"
    assert result[1]["id"] == "customization_1"
    assert result[2]["id"] == "customization_2"


def test_modify_and_delete_chart_customizations(
    dashboard_with_customizations: Dashboard,
) -> None:
    attributes = {
        "modified": [
            {
                "id": "customization_2",
                "name": "Modified Custom 2",
                "config": {"key": "modified_value2"},
            }
        ],
        "deleted": ["customization_1"],
        "reordered": [],
    }

    result = DashboardDAO.update_chart_customizations_config(
        dashboard_with_customizations, attributes
    )

    assert len(result) == 1
    assert result[0]["id"] == "customization_2"
    assert result[0]["name"] == "Modified Custom 2"


def test_complex_chart_customizations_update(
    dashboard_with_customizations: Dashboard,
) -> None:
    attributes = {
        "modified": [
            {
                "id": "customization_1",
                "name": "Modified Custom 1",
                "config": {"key": "modified_value1"},
            },
            {
                "id": "customization_3",
                "name": "Custom 3",
                "config": {"key": "value3"},
            },
        ],
        "deleted": ["customization_2"],
        "reordered": ["customization_3", "customization_1"],
    }

    result = DashboardDAO.update_chart_customizations_config(
        dashboard_with_customizations, attributes
    )

    assert len(result) == 2
    assert result[0]["id"] == "customization_3"
    assert result[0]["name"] == "Custom 3"
    assert result[1]["id"] == "customization_1"
    assert result[1]["name"] == "Modified Custom 1"


def test_empty_attributes(dashboard_with_customizations: Dashboard) -> None:
    attributes: dict[str, list[str]] = {
        "modified": [],
        "deleted": [],
        "reordered": [],
    }

    result = DashboardDAO.update_chart_customizations_config(
        dashboard_with_customizations, attributes
    )

    assert len(result) == 2
    assert result[0]["id"] == "customization_1"
    assert result[1]["id"] == "customization_2"


def test_reorder_with_new_customization_auto_added(
    dashboard_with_customizations: Dashboard,
) -> None:
    attributes = {
        "modified": [
            {
                "id": "customization_3",
                "name": "Custom 3",
                "config": {"key": "value3"},
            }
        ],
        "deleted": [],
        "reordered": ["customization_1", "customization_2"],
    }

    result = DashboardDAO.update_chart_customizations_config(
        dashboard_with_customizations, attributes
    )

    assert len(result) == 3
    assert result[2]["id"] == "customization_3"


def test_delete_nonexistent_customization(
    dashboard_with_customizations: Dashboard,
) -> None:
    attributes = {
        "modified": [],
        "deleted": ["nonexistent_id"],
        "reordered": [],
    }

    result = DashboardDAO.update_chart_customizations_config(
        dashboard_with_customizations, attributes
    )

    assert len(result) == 2
    assert result[0]["id"] == "customization_1"
    assert result[1]["id"] == "customization_2"


def test_reorder_with_missing_ids(dashboard_with_customizations: Dashboard) -> None:
    attributes = {
        "modified": [],
        "deleted": [],
        "reordered": ["customization_2"],
    }

    result = DashboardDAO.update_chart_customizations_config(
        dashboard_with_customizations, attributes
    )

    assert len(result) == 1
    assert result[0]["id"] == "customization_2"


def test_none_dashboard() -> None:
    with pytest.raises(AttributeError):
        DashboardDAO.update_chart_customizations_config(None, {})  # type: ignore


def test_empty_dict_attributes(dashboard_with_customizations: Dashboard) -> None:
    result = DashboardDAO.update_chart_customizations_config(
        dashboard_with_customizations, {}
    )
    assert result == []
