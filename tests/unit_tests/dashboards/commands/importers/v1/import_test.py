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
# pylint: disable=unused-argument, import-outside-toplevel, unused-import, invalid-name

import copy
from collections.abc import Generator
from typing import Any
from unittest.mock import MagicMock

import pytest
from flask_appbuilder.security.sqla.models import Role, User
from pytest_mock import MockerFixture
from sqlalchemy.orm.session import Session

from superset import security_manager
from superset.commands.dashboard.importers.v1 import ImportDashboardsCommand
from superset.commands.dashboard.importers.v1.utils import import_dashboard
from superset.commands.exceptions import ImportFailedError
from superset.models.dashboard import Dashboard
from superset.utils.core import override_user
from tests.integration_tests.fixtures.importexport import (
    chart_config,
    dashboard_config,
    database_config,
    dataset_config,
)


@pytest.fixture
def session_with_data(session: Session) -> Generator[Session, None, None]:
    engine = session.get_bind()
    Dashboard.metadata.create_all(engine)  # pylint: disable=no-member

    dashboard = Dashboard(
        id=100,
        dashboard_title="Test dash",
        slug=None,
        slices=[],
        published=True,
        uuid=dashboard_config["uuid"],
    )

    session.add(dashboard)

    session.flush()
    yield session
    session.rollback()


@pytest.fixture
def session_with_schema(session: Session) -> Generator[Session, None, None]:
    engine = session.get_bind()
    Dashboard.metadata.create_all(engine)  # pylint: disable=no-member

    import_role = Role(name="Import role")
    session.add(import_role)

    yield session
    session.rollback()


def test_import_dashboard(mocker: MockerFixture, session_with_schema: Session) -> None:
    """
    Test importing a dashboard.
    """
    mock_can_access = mocker.patch.object(
        security_manager, "can_access", return_value=True
    )
    config = copy.deepcopy(dashboard_config)
    config["roles"] = [{"name": "Import role"}]

    dashboard = import_dashboard(config)
    assert dashboard.dashboard_title == "Test dash"
    assert dashboard.description is None
    assert dashboard.is_managed_externally is False
    assert dashboard.external_url is None
    assert dashboard.roles[0].name == "Import role"
    # Assert that the can write to dashboard was checked
    mock_can_access.assert_called_once_with("can_write", "Dashboard")


def test_import_dashboard_managed_externally(
    mocker: MockerFixture,
    session_with_schema: Session,
) -> None:
    """
    Test importing a dashboard that is managed externally.
    """
    mock_can_access = mocker.patch.object(
        security_manager, "can_access", return_value=True
    )

    config = copy.deepcopy(dashboard_config)
    config["is_managed_externally"] = True
    config["external_url"] = "https://example.org/my_dashboard"
    dashboard = import_dashboard(config)
    assert dashboard.is_managed_externally is True
    assert dashboard.external_url == "https://example.org/my_dashboard"

    # Assert that the can write to dashboard was checked
    mock_can_access.assert_called_once_with("can_write", "Dashboard")


def test_import_dashboard_without_permission(
    mocker: MockerFixture,
    session_with_schema: Session,
) -> None:
    """
    Test importing a dashboard when a user doesn't have permissions to create.
    """
    mock_can_access = mocker.patch.object(
        security_manager, "can_access", return_value=False
    )

    with pytest.raises(ImportFailedError) as excinfo:
        import_dashboard(dashboard_config)
    assert (
        str(excinfo.value)
        == "Dashboard doesn't exist and user doesn't have permission to create dashboards"  # noqa: E501
    )

    # Assert that the can write to dashboard was checked
    mock_can_access.assert_called_once_with("can_write", "Dashboard")


def test_import_existing_dashboard_without_access_permission(
    mocker: MockerFixture,
    session_with_data: Session,
) -> None:
    """
    Test importing a dashboard when a user doesn't have permissions to create.
    """
    mock_can_access = mocker.patch.object(
        security_manager, "can_access", return_value=True
    )
    mock_can_access_dashboard = mocker.patch.object(
        security_manager, "can_access_dashboard", return_value=False
    )

    dashboard = (
        session_with_data.query(Dashboard)
        .filter(Dashboard.uuid == dashboard_config["uuid"])
        .one_or_none()
    )

    admin = User(
        first_name="Alice",
        last_name="Doe",
        email="adoe@example.org",
        username="admin",
        roles=[Role(name="Admin")],
    )

    with override_user(admin):
        with pytest.raises(ImportFailedError) as excinfo:
            import_dashboard(dashboard_config, overwrite=True)
        assert (
            str(excinfo.value)
            == "A dashboard already exists and user doesn't have permissions to overwrite it"  # noqa: E501
        )

    # Assert that the can write to dashboard was checked
    mock_can_access.assert_called_once_with("can_write", "Dashboard")
    mock_can_access_dashboard.assert_called_once_with(dashboard)


def test_import_existing_dashboard_without_owner_permission(
    mocker: MockerFixture,
    session_with_data: Session,
) -> None:
    """
    Test importing a dashboard when a user doesn't have ownership and is not an Admin.
    """
    mock_can_access = mocker.patch.object(
        security_manager, "can_access", return_value=True
    )
    mock_can_access_dashboard = mocker.patch.object(
        security_manager, "can_access_dashboard", return_value=True
    )

    dashboard = (
        session_with_data.query(Dashboard)
        .filter(Dashboard.uuid == dashboard_config["uuid"])
        .one_or_none()
    )

    user = User(
        first_name="Alice",
        last_name="Doe",
        email="adoe@example.org",
        username="admin",
        roles=[Role(name="Gamma")],
    )

    with override_user(user):
        with pytest.raises(ImportFailedError) as excinfo:
            import_dashboard(dashboard_config, overwrite=True)
        assert (
            str(excinfo.value)
            == "A dashboard already exists and user doesn't have permissions to overwrite it"  # noqa: E501
        )

    # Assert that the can write to dashboard was checked
    mock_can_access.assert_called_once_with("can_write", "Dashboard")
    mock_can_access_dashboard.assert_called_once_with(dashboard)


def test_import_existing_dashboard_with_permission(
    mocker: MockerFixture,
    session_with_data: Session,
) -> None:
    """
    Test importing a dashboard that exists when a user has access permission to that dashboard.
    """  # noqa: E501
    mock_can_access = mocker.patch.object(
        security_manager, "can_access", return_value=True
    )
    mock_can_access_dashboard = mocker.patch.object(
        security_manager, "can_access_dashboard", return_value=True
    )

    admin = User(
        first_name="Alice",
        last_name="Doe",
        email="adoe@example.org",
        username="admin",
        roles=[Role(name="Admin")],
    )

    dashboard = (
        session_with_data.query(Dashboard)
        .filter(Dashboard.uuid == dashboard_config["uuid"])
        .one_or_none()
    )

    with override_user(admin):
        import_dashboard(dashboard_config, overwrite=True)

    # Assert that the can write to dashboard was checked
    mock_can_access.assert_called_once_with("can_write", "Dashboard")
    mock_can_access_dashboard.assert_called_once_with(dashboard)


MODULE = "superset.commands.dashboard.importers.v1"


def _mock_import_command(mocker: MockerFixture) -> dict[str, MagicMock]:
    """
    Patch the helpers used by ``ImportDashboardsCommand._import`` so we can call it
    without touching a real database, and expose the mocks used to assert behaviour.
    """
    database = MagicMock(uuid=database_config["uuid"], id=1)
    dataset = MagicMock(
        uuid=dataset_config["uuid"],
        id=2,
        datasource_type="table",
        table_name="imported_dataset",
    )
    # a chart that is not a filter_box so it isn't deleted at the end of the import
    chart = MagicMock(uuid=chart_config["uuid"], id=3, viz_type="echarts_timeseries")
    dashboard = MagicMock(id=4)

    mock_import_database = mocker.patch(
        f"{MODULE}.import_database", return_value=database
    )
    mock_import_dataset = mocker.patch(f"{MODULE}.import_dataset", return_value=dataset)
    mock_import_chart = mocker.patch(f"{MODULE}.import_chart", return_value=chart)
    mocker.patch(f"{MODULE}.import_dashboard", return_value=dashboard)

    # keep the config dicts untouched so the discovery logic keeps working
    mocker.patch(
        f"{MODULE}.update_chart_config_dataset", side_effect=lambda config, _: config
    )
    mocker.patch(f"{MODULE}.update_id_refs", side_effect=lambda config, *_: config)
    mocker.patch(f"{MODULE}.migrate_dashboard")

    # avoid any real DB access
    mock_db = mocker.patch(f"{MODULE}.db")
    mock_db.session.execute.return_value.fetchall.return_value = []

    return {
        "import_database": mock_import_database,
        "import_dataset": mock_import_dataset,
        "import_chart": mock_import_chart,
    }


def _import_configs() -> dict[str, dict[str, Any]]:
    return {
        "databases/imported_database.yaml": copy.deepcopy(database_config),
        "datasets/imported_dataset.yaml": copy.deepcopy(dataset_config),
        "charts/imported_chart.yaml": copy.deepcopy(chart_config),
        "dashboards/imported_dashboard.yaml": copy.deepcopy(dashboard_config),
    }


@pytest.mark.parametrize("overwrite", [True, False])
def test_import_propagates_overwrite_to_related_objects(
    mocker: MockerFixture,
    overwrite: bool,
) -> None:
    """
    The ``overwrite`` flag passed to the dashboard import command must be
    propagated to the related databases, datasets and charts so they can be
    overwritten as well.
    """
    mocks = _mock_import_command(mocker)

    ImportDashboardsCommand._import(_import_configs(), overwrite=overwrite)

    assert mocks["import_database"].call_args.kwargs["overwrite"] is overwrite
    assert mocks["import_dataset"].call_args.kwargs["overwrite"] is overwrite
    assert mocks["import_chart"].call_args.kwargs["overwrite"] is overwrite


def test_import_defaults_to_no_overwrite(mocker: MockerFixture) -> None:
    """
    When no ``overwrite`` flag is provided, related objects must not be overwritten.
    """
    mocks = _mock_import_command(mocker)

    ImportDashboardsCommand._import(_import_configs())

    assert mocks["import_database"].call_args.kwargs["overwrite"] is False
    assert mocks["import_dataset"].call_args.kwargs["overwrite"] is False
    assert mocks["import_chart"].call_args.kwargs["overwrite"] is False
