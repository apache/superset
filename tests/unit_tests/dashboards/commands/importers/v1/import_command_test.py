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
"""
Tests for ImportDashboardsCommand overwrite functionality.

These tests verify that when importing dashboards with overwrite=True,
the dashboard's chart associations are replaced rather than merged.
This addresses GitHub issue #22127.
"""

import copy

from pytest_mock import MockerFixture
from sqlalchemy.orm.session import Session
from sqlalchemy.sql import select

from tests.unit_tests.fixtures.assets_configs import (
    charts_config_1,
    charts_config_2,
    dashboards_config_1,
    dashboards_config_2,
    databases_config,
    datasets_config,
)


def test_dashboard_import_with_overwrite_replaces_charts(
    mocker: MockerFixture, session: Session
) -> None:
    """
    Test that dashboard import with overwrite=True replaces charts instead of merging.

    This test verifies the fix for GitHub issue #22127:
    1. Import a dashboard with 2 charts
    2. Re-import the same dashboard (same UUID) with only 1 chart
    3. The dashboard should have only 1 chart (replaced), not 3 (merged)
    """
    from superset import db, security_manager
    from superset.commands.dashboard.importers.v1 import ImportDashboardsCommand
    from superset.models.dashboard import dashboard_slices
    from superset.models.slice import Slice

    mocker.patch.object(security_manager, "can_access", return_value=True)

    engine = db.session.get_bind()
    Slice.metadata.create_all(engine)  # pylint: disable=no-member

    # First import: dashboard with 2 charts (charts_config_1 has 2 charts)
    initial_configs = {
        **copy.deepcopy(databases_config),
        **copy.deepcopy(datasets_config),
        **copy.deepcopy(charts_config_1),
        **copy.deepcopy(dashboards_config_1),
    }
    ImportDashboardsCommand._import(initial_configs, overwrite=True)
    # Commit between imports, as production does: ``run()`` carries
    # ``@transaction()``, so two imports are two transactions. Without this the
    # add and the remove of one association share a Continuum transaction and
    # collide on ``dashboard_slices_version``'s composite key — an artifact of
    # the test's shortcut, not a reachable production state.
    db.session.commit()

    # Verify initial state: 2 charts associated with the dashboard
    initial_chart_ids = db.session.scalars(select(dashboard_slices.c.slice_id)).all()
    assert len(initial_chart_ids) == 2

    # Second import: same dashboard with only 1 chart (charts_config_2 has 1 chart)
    updated_configs = {
        **copy.deepcopy(databases_config),
        **copy.deepcopy(datasets_config),
        **copy.deepcopy(charts_config_2),
        **copy.deepcopy(dashboards_config_2),
    }
    ImportDashboardsCommand._import(updated_configs, overwrite=True)

    # Verify final state: only 1 chart (replaced, not merged)
    final_chart_ids = db.session.scalars(select(dashboard_slices.c.slice_id)).all()
    assert len(final_chart_ids) == 1


def test_dashboard_import_without_overwrite_merges_charts(
    mocker: MockerFixture, session: Session
) -> None:
    """
    Test that dashboard import without overwrite merges charts (original behavior).

    When overwrite=False, new chart associations should be added to existing ones.
    """
    from superset import db, security_manager
    from superset.commands.dashboard.importers.v1 import ImportDashboardsCommand
    from superset.models.dashboard import dashboard_slices
    from superset.models.slice import Slice

    mocker.patch.object(security_manager, "can_access", return_value=True)

    engine = db.session.get_bind()
    Slice.metadata.create_all(engine)  # pylint: disable=no-member

    # First import: dashboard with 1 chart
    initial_configs = {
        **copy.deepcopy(databases_config),
        **copy.deepcopy(datasets_config),
        **copy.deepcopy(charts_config_2),
        **copy.deepcopy(dashboards_config_2),
    }
    ImportDashboardsCommand._import(initial_configs, overwrite=False)

    # Verify initial state: 1 chart
    initial_chart_ids = db.session.scalars(select(dashboard_slices.c.slice_id)).all()
    assert len(initial_chart_ids) == 1

    # Second import: same dashboard with 2 charts, but overwrite=False
    updated_configs = {
        **copy.deepcopy(databases_config),
        **copy.deepcopy(datasets_config),
        **copy.deepcopy(charts_config_1),
        **copy.deepcopy(dashboards_config_1),
    }
    ImportDashboardsCommand._import(updated_configs, overwrite=False)

    # When overwrite=False, new charts are added but existing ones remain
    # The dashboard_config_1 has 2 charts, one of which is the same as in config_2
    # So we should have 2 total (not 3, since the common chart is not duplicated)
    final_chart_ids = db.session.scalars(select(dashboard_slices.c.slice_id)).all()
    assert len(final_chart_ids) == 2


def test_dashboard_import_with_overwrite_adds_new_charts(
    mocker: MockerFixture, session: Session
) -> None:
    """
    Test that dashboard import with overwrite=True correctly adds new charts.

    This verifies that overwrite mode not only removes old charts but also
    properly adds the new charts from the import.
    """
    from superset import db, security_manager
    from superset.commands.dashboard.importers.v1 import ImportDashboardsCommand
    from superset.models.dashboard import dashboard_slices
    from superset.models.slice import Slice

    mocker.patch.object(security_manager, "can_access", return_value=True)

    engine = db.session.get_bind()
    Slice.metadata.create_all(engine)  # pylint: disable=no-member

    # First import: dashboard with 1 chart
    initial_configs = {
        **copy.deepcopy(databases_config),
        **copy.deepcopy(datasets_config),
        **copy.deepcopy(charts_config_2),
        **copy.deepcopy(dashboards_config_2),
    }
    ImportDashboardsCommand._import(initial_configs, overwrite=True)

    # Verify initial state: 1 chart
    initial_chart_ids = db.session.scalars(select(dashboard_slices.c.slice_id)).all()
    assert len(initial_chart_ids) == 1

    # Second import: same dashboard with 2 charts
    updated_configs = {
        **copy.deepcopy(databases_config),
        **copy.deepcopy(datasets_config),
        **copy.deepcopy(charts_config_1),
        **copy.deepcopy(dashboards_config_1),
    }
    ImportDashboardsCommand._import(updated_configs, overwrite=True)

    # Verify final state: 2 charts (replaced with new set)
    final_chart_ids = db.session.scalars(select(dashboard_slices.c.slice_id)).all()
    assert len(final_chart_ids) == 2


def test_dashboard_import_new_dashboard(
    mocker: MockerFixture, session: Session
) -> None:
    """
    Test that importing a new dashboard works correctly.
    """
    from superset import db, security_manager
    from superset.commands.dashboard.importers.v1 import ImportDashboardsCommand
    from superset.models.dashboard import dashboard_slices
    from superset.models.slice import Slice

    mocker.patch.object(security_manager, "can_access", return_value=True)

    engine = db.session.get_bind()
    Slice.metadata.create_all(engine)  # pylint: disable=no-member

    configs = {
        **copy.deepcopy(databases_config),
        **copy.deepcopy(datasets_config),
        **copy.deepcopy(charts_config_1),
        **copy.deepcopy(dashboards_config_1),
    }
    expected_number_of_dashboards = len(dashboards_config_1)
    expected_number_of_charts = len(charts_config_1)

    ImportDashboardsCommand._import(configs, overwrite=True)
    dashboard_ids = db.session.scalars(
        select(dashboard_slices.c.dashboard_id).distinct()
    ).all()
    chart_ids = db.session.scalars(select(dashboard_slices.c.slice_id)).all()

    assert len(chart_ids) == expected_number_of_charts
    assert len(dashboard_ids) == expected_number_of_dashboards


def test_dashboard_import_prompts_for_missing_snowflake_password(
    mocker: MockerFixture, session: Session
) -> None:
    """An omitted URI password prompts before connecting, and the retry stores it."""
    import pytest
    import yaml

    submitted = "new-secret"

    from superset import db, security_manager
    from superset.commands.dashboard.importers.v1 import ImportDashboardsCommand
    from superset.commands.exceptions import CommandInvalidError
    from superset.constants import PASSWORD_MASK
    from superset.models.core import Database
    from superset.models.dashboard import Dashboard
    from tests.integration_tests.fixtures.importexport import dashboard_metadata_config

    mocker.patch.object(security_manager, "can_access", return_value=True)
    Dashboard.metadata.create_all(db.session.get_bind())
    configs = {
        **copy.deepcopy(databases_config),
        **copy.deepcopy(datasets_config),
        **copy.deepcopy(charts_config_1),
        **copy.deepcopy(dashboards_config_1),
    }
    filename = "databases/examples.yaml"
    configs[filename]["sqlalchemy_uri"] = "snowflake://user@account/ANALYTICS/public"
    contents = {name: yaml.safe_dump(config) for name, config in configs.items()}
    contents["metadata.yaml"] = yaml.safe_dump(dashboard_metadata_config)
    sync = mocker.patch("superset.commands.database.importers.v1.utils.add_permissions")

    with pytest.raises(CommandInvalidError) as exc_info:
        ImportDashboardsCommand(contents).run()

    assert exc_info.value.normalized_messages() == {
        filename: {"_schema": ["Must provide a password for the database"]}
    }
    sync.assert_not_called()
    assert db.session.query(Database).count() == 0

    ImportDashboardsCommand(contents, passwords={filename: submitted}).run()

    database = db.session.query(Database).one()
    assert database.password == submitted
    assert submitted not in database.sqlalchemy_uri
    assert PASSWORD_MASK in database.sqlalchemy_uri
    assert db.session.query(Dashboard).count() == 1
    sync.assert_called_once_with(database)
