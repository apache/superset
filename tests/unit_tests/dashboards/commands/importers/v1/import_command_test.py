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
from typing import Any

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


def test_dashboard_import_database_failure_has_asset_context(
    mocker: MockerFixture, session: Session
) -> None:
    """The real dashboard import wraps the failing database, not just the bundle."""
    import pytest
    from sqlalchemy.exc import OperationalError

    from superset import db, security_manager
    from superset.commands.dashboard.importers.v1 import ImportDashboardsCommand
    from superset.commands.importers.v1.errors import ImportAssetError
    from superset.models.dashboard import Dashboard

    mocker.patch.object(security_manager, "can_access", return_value=True)
    Dashboard.metadata.create_all(db.session.get_bind())
    configs = {
        **copy.deepcopy(databases_config),
        **copy.deepcopy(datasets_config),
        **copy.deepcopy(charts_config_1),
        **copy.deepcopy(dashboards_config_1),
    }
    configs["databases/examples.yaml"]["sqlalchemy_uri"] = "postgresql://user@host/db"
    mocker.patch(
        "superset.commands.dashboard.importers.v1.import_database",
        side_effect=OperationalError(
            None,
            None,
            Exception('password authentication failed for user "hidden-user"'),
        ),
    )
    with pytest.raises(ImportAssetError) as caught:
        ImportDashboardsCommand._import(configs)
    assert "databases/examples.yaml" in caught.value.message
    assert "credentials" in caught.value.message
    assert "hidden-user" not in caught.value.message
    assert db.session.query(Dashboard).count() == 0


def test_dashboard_import_failure_rolls_back_before_retry(
    mocker: MockerFixture, session: Session
) -> None:
    """A dataset failure rolls back the new connection before a successful retry."""
    import pytest
    import yaml

    from superset import db, security_manager
    from superset.commands.dashboard.importers.v1 import ImportDashboardsCommand
    from superset.commands.importers.v1.errors import ImportAssetError
    from superset.models.core import Database
    from superset.models.dashboard import Dashboard
    from tests.integration_tests.fixtures.importexport import dashboard_metadata_config

    mocker.patch.object(security_manager, "can_access", return_value=True)
    mocker.patch.object(
        Database, "get_all_schema_names", return_value={"rollback_schema"}
    )
    Dashboard.metadata.create_all(db.session.get_bind())
    security_manager.permissionview_model.metadata.create_all(db.session.get_bind())
    configs = {
        **copy.deepcopy(databases_config),
        **copy.deepcopy(datasets_config),
        **copy.deepcopy(charts_config_1),
        **copy.deepcopy(dashboards_config_1),
    }
    configs["databases/examples.yaml"]["sqlalchemy_uri"] = (
        "postgresql://user:typed-secret@host/db"
    )
    mocker.patch.object(Database, "get_default_catalog", return_value="db")
    contents = {name: yaml.safe_dump(config) for name, config in configs.items()}
    contents["metadata.yaml"] = yaml.safe_dump(dashboard_metadata_config)
    initial_permissions = db.session.query(
        security_manager.permissionview_model
    ).count()

    def fail_after_permissions(*_args: Any, **_kwargs: Any) -> None:
        assert db.session.query(Database).one().password == "typed-secret"  # noqa: S105
        assert (
            db.session.query(security_manager.permissionview_model).count()
            > initial_permissions
        )
        raise RuntimeError("internal-secret")

    failure = mocker.patch(
        "superset.commands.dashboard.importers.v1.import_dataset",
        side_effect=fail_after_permissions,
    )
    with pytest.raises(ImportAssetError) as caught:
        ImportDashboardsCommand(contents).run()
    assert "datasets/examples/video_game_sales.yaml" in caught.value.message
    assert "internal-secret" not in caught.value.message
    assert db.session.query(Database).count() == 0
    assert db.session.query(Dashboard).count() == 0
    assert (
        db.session.query(security_manager.permissionview_model).count()
        == initial_permissions
    )

    mocker.stop(failure)
    ImportDashboardsCommand(contents).run()
    assert db.session.query(Database).count() == 1
    assert db.session.query(Dashboard).count() == 1
    assert (
        db.session.query(security_manager.permissionview_model).count()
        > initial_permissions
    )


def test_missing_bundled_dataset_is_a_format_error(
    mocker: MockerFixture, session: Session
) -> None:
    """Dangling references fail before creating any connections."""
    import pytest

    from superset.commands.dashboard.importers.v1 import ImportDashboardsCommand
    from superset.commands.importers.v1.errors import (
        import_error_context,
        ImportBundleError,
    )

    configs = {
        **copy.deepcopy(databases_config),
        **copy.deepcopy(charts_config_1),
        **copy.deepcopy(dashboards_config_1),
    }
    create_database = mocker.patch(
        "superset.commands.dashboard.importers.v1.import_database"
    )
    with pytest.raises(ImportBundleError) as caught:
        with import_error_context("dashboard bundle"):
            ImportDashboardsCommand._import(configs)
    assert caught.value.status == 400
    assert "Re-export" in caught.value.message
    assert "missing a dataset" in caught.value.message
    create_database.assert_not_called()


def test_import_error_names_reused_destination_connection(
    mocker: MockerFixture, session: Session
) -> None:
    """A UUID match reports the destination name, not just the source filename."""
    import pytest

    from superset import db, security_manager
    from superset.commands.dashboard.importers.v1 import ImportDashboardsCommand
    from superset.commands.importers.v1.errors import ImportAssetError
    from superset.models.core import Database
    from superset.models.dashboard import Dashboard

    Dashboard.metadata.create_all(db.session.get_bind())
    config = next(iter(databases_config.values()))
    existing = Database(
        database_name="Shared Lakehouse B",
        sqlalchemy_uri="sqlite://",
        uuid=config["uuid"],
    )
    db.session.add(existing)
    db.session.flush()
    mocker.patch.object(security_manager, "can_access", return_value=True)
    mocker.patch.object(security_manager, "can_access_database", return_value=True)
    mocker.patch(
        "superset.commands.database.importers.v1.utils.add_permissions",
        side_effect=TimeoutError(),
    )
    configs = {
        **copy.deepcopy(databases_config),
        **copy.deepcopy(datasets_config),
        **copy.deepcopy(charts_config_1),
        **copy.deepcopy(dashboards_config_1),
    }
    with pytest.raises(ImportAssetError) as caught:
        ImportDashboardsCommand._import(configs)
    assert (
        'database "Shared Lakehouse B" (databases/examples.yaml)'
        in caught.value.message
    )


def test_dashboard_import_permission_failure_is_forbidden(
    mocker: MockerFixture, session: Session
) -> None:
    """A user without database creation permission gets a safe 403 and next step."""
    import pytest

    from superset import db, security_manager
    from superset.commands.dashboard.importers.v1 import ImportDashboardsCommand
    from superset.commands.importers.v1.errors import ImportAssetError
    from superset.models.dashboard import Dashboard

    Dashboard.metadata.create_all(db.session.get_bind())
    mocker.patch.object(security_manager, "can_access", return_value=False)
    configs = {
        **copy.deepcopy(databases_config),
        **copy.deepcopy(datasets_config),
        **copy.deepcopy(charts_config_1),
        **copy.deepcopy(dashboards_config_1),
    }
    with pytest.raises(ImportAssetError) as caught:
        ImportDashboardsCommand._import(configs)
    assert caught.value.status == 403
    assert "administrator" in caught.value.message
    assert "permission" in caught.value.message


def test_invalid_dashboard_yaml_gives_reexport_step(session: Session) -> None:
    """Malformed input retains format recovery instead of just parser output."""
    import pytest
    import yaml

    from superset import db
    from superset.commands.dashboard.importers.v1 import ImportDashboardsCommand
    from superset.commands.exceptions import CommandInvalidError
    from superset.models.dashboard import Dashboard
    from tests.integration_tests.fixtures.importexport import dashboard_metadata_config

    Dashboard.metadata.create_all(db.session.get_bind())
    contents = {
        "metadata.yaml": yaml.safe_dump(dashboard_metadata_config),
        "dashboards/broken.yaml": "[invalid",
    }
    with pytest.raises(CommandInvalidError) as caught:
        ImportDashboardsCommand(contents).run()
    assert caught.value.status == 422
    assert "Re-export" in caught.value.message


def test_layout_only_chart_reference_does_not_reject_import(
    mocker: MockerFixture, session: Session
) -> None:
    """An exported dashboard can keep layout UUIDs for deleted, unexported charts."""
    from superset import db, security_manager
    from superset.commands.dashboard.importers.v1 import ImportDashboardsCommand
    from superset.models.dashboard import Dashboard

    Dashboard.metadata.create_all(db.session.get_bind())
    mocker.patch.object(security_manager, "can_access", return_value=True)
    configs = copy.deepcopy(dashboards_config_1)
    ImportDashboardsCommand._import(configs)
    assert db.session.query(Dashboard).count() == len(configs)


def test_dataset_failure_does_not_disclose_inaccessible_connection_name(
    mocker: MockerFixture, session: Session
) -> None:
    """Dataset errors retain their asset type and only show an authorized name."""
    import pytest

    from superset import db, security_manager
    from superset.commands.exceptions import ForbiddenError
    from superset.commands.importers.v1.errors import (
        import_error_context,
        ImportAssetError,
    )
    from superset.models.core import Database

    Database.metadata.create_all(db.session.get_bind())
    config = copy.deepcopy(next(iter(databases_config.values())))
    db.session.add(
        Database(
            database_name="private-stored-name",
            sqlalchemy_uri="sqlite://",
            uuid=config["uuid"],
        )
    )
    db.session.flush()
    mocker.patch.object(security_manager, "can_access_database", return_value=False)
    with pytest.raises(ImportAssetError) as caught:
        with import_error_context("datasets/examples/table.yaml", config):
            raise ForbiddenError("You don't have access to this dataset.")
    assert caught.value.status == 403
    assert "private-stored-name" not in caught.value.message
    assert (
        'Could not import datasets/examples/table.yaml (database "examples")'
        in caught.value.message
    )
    assert "You don't have access to this dataset." in caught.value.message
    assert "administrator" in caught.value.message
