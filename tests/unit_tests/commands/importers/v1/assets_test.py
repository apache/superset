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

import copy
from typing import Any, cast

import yaml
from marshmallow.exceptions import ValidationError
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

saved_queries_config: dict[str, Any] = {
    "queries/examples/my_query.yaml": {
        "schema": "main",
        "label": "My saved query",
        "description": None,
        "sql": "SELECT 1",
        "uuid": "e3e4f1f0-5c9d-4a4c-a4e4-0000000000aa",
        "version": "1.0.0",
        "database_uuid": "a2dc77af-e654-49bb-b321-40f6b559a1ee",
    },
}


def test_import_new_assets(mocker: MockerFixture, session: Session) -> None:
    """
    Test that all new assets are imported correctly.
    """
    from superset import db, security_manager
    from superset.commands.importers.v1.assets import ImportAssetsCommand
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

    ImportAssetsCommand._import(configs)
    dashboard_ids = db.session.scalars(
        select(dashboard_slices.c.dashboard_id).distinct()
    ).all()
    chart_ids = db.session.scalars(select(dashboard_slices.c.slice_id)).all()

    assert len(chart_ids) == expected_number_of_charts
    assert len(dashboard_ids) == expected_number_of_dashboards


def test_import_adds_dashboard_charts(mocker: MockerFixture, session: Session) -> None:
    """
    Test that existing dashboards are updated with new charts.
    """
    from superset import db, security_manager
    from superset.commands.importers.v1.assets import ImportAssetsCommand
    from superset.models.dashboard import dashboard_slices
    from superset.models.slice import Slice

    mocker.patch.object(security_manager, "can_access", return_value=True)

    engine = db.session.get_bind()
    Slice.metadata.create_all(engine)  # pylint: disable=no-member
    base_configs = {
        **copy.deepcopy(databases_config),
        **copy.deepcopy(datasets_config),
        **copy.deepcopy(charts_config_2),
        **copy.deepcopy(dashboards_config_2),
    }
    new_configs = {
        **copy.deepcopy(databases_config),
        **copy.deepcopy(datasets_config),
        **copy.deepcopy(charts_config_1),
        **copy.deepcopy(dashboards_config_1),
    }
    expected_number_of_dashboards = len(dashboards_config_1)
    expected_number_of_charts = len(charts_config_1)

    ImportAssetsCommand._import(base_configs)
    ImportAssetsCommand._import(new_configs)
    dashboard_ids = db.session.scalars(
        select(dashboard_slices.c.dashboard_id).distinct()
    ).all()
    chart_ids = db.session.scalars(select(dashboard_slices.c.slice_id)).all()

    assert len(chart_ids) == expected_number_of_charts
    assert len(dashboard_ids) == expected_number_of_dashboards


def test_import_assets_imports_tags(mocker: MockerFixture, session: Session) -> None:
    """
    Test that tags on charts and dashboards are imported when importing assets
    via ``ImportAssetsCommand`` (the code path used by the CLI ``sync native``
    command). Previously tags were silently dropped for the CLI path.
    """
    from superset import db, security_manager
    from superset.commands.importers.v1.assets import ImportAssetsCommand
    from superset.extensions import feature_flag_manager
    from superset.models.dashboard import Dashboard
    from superset.models.slice import Slice
    from superset.tags.models import Tag, TaggedObject

    mocker.patch.object(security_manager, "can_access", return_value=True)
    mocker.patch.object(feature_flag_manager, "is_feature_enabled", return_value=True)

    engine = db.session.get_bind()
    Slice.metadata.create_all(engine)  # pylint: disable=no-member
    Tag.metadata.create_all(engine)  # pylint: disable=no-member

    charts_with_tags = copy.deepcopy(charts_config_1)
    for chart_config in charts_with_tags.values():
        chart_config["tags"] = ["chart_tag"]

    dashboards_with_tags = copy.deepcopy(dashboards_config_1)
    for dashboard_config in dashboards_with_tags.values():
        dashboard_config["tags"] = ["dashboard_tag"]

    configs = {
        **copy.deepcopy(databases_config),
        **copy.deepcopy(datasets_config),
        **charts_with_tags,
        **dashboards_with_tags,
    }
    contents = {
        "tags.yaml": yaml.dump(
            {
                "tags": [
                    {"tag_name": "chart_tag", "description": "Tag for charts"},
                    {
                        "tag_name": "dashboard_tag",
                        "description": "Tag for dashboards",
                    },
                ]
            }
        )
    }

    ImportAssetsCommand._import(configs, contents=contents)

    chart_uuids = {
        cast(str, cast(dict[str, Any], config)["uuid"])
        for config in charts_with_tags.values()
    }
    imported_charts = (
        db.session.query(Slice).filter(cast(Any, Slice.uuid).in_(chart_uuids)).all()
    )
    assert len(imported_charts) == len(chart_uuids)
    for chart in imported_charts:
        assocs = (
            db.session.query(TaggedObject)
            .filter_by(object_id=chart.id, object_type="chart")
            .all()
        )
        assert len(assocs) == 1
        assert assocs[0].tag.name == "chart_tag"

    dashboard_uuids = {
        cast(str, cast(dict[str, Any], config)["uuid"])
        for config in dashboards_with_tags.values()
    }
    imported_dashboards = (
        db.session.query(Dashboard)
        .filter(cast(Any, Dashboard.uuid).in_(dashboard_uuids))
        .all()
    )
    assert len(imported_dashboards) == len(dashboard_uuids)
    for dashboard in imported_dashboards:
        assocs = (
            db.session.query(TaggedObject)
            .filter_by(object_id=dashboard.id, object_type="dashboard")
            .all()
        )
        assert len(assocs) == 1
        assert assocs[0].tag.name == "dashboard_tag"


def test_import_assets_skips_tags_when_feature_disabled(
    mocker: MockerFixture, session: Session
) -> None:
    """
    Test that tag import is skipped when the ``TAGGING_SYSTEM`` feature flag
    is disabled, even when the configs include tags.
    """
    from superset import db, security_manager
    from superset.commands.importers.v1.assets import ImportAssetsCommand
    from superset.extensions import feature_flag_manager
    from superset.models.slice import Slice
    from superset.tags.models import Tag, TaggedObject

    mocker.patch.object(security_manager, "can_access", return_value=True)
    mocker.patch.object(feature_flag_manager, "is_feature_enabled", return_value=False)

    engine = db.session.get_bind()
    Slice.metadata.create_all(engine)  # pylint: disable=no-member
    Tag.metadata.create_all(engine)  # pylint: disable=no-member

    charts_with_tags = copy.deepcopy(charts_config_1)
    for chart_config in charts_with_tags.values():
        chart_config["tags"] = ["chart_tag"]

    configs = {
        **copy.deepcopy(databases_config),
        **copy.deepcopy(datasets_config),
        **charts_with_tags,
        **copy.deepcopy(dashboards_config_1),
    }

    ImportAssetsCommand._import(configs)

    assert db.session.query(TaggedObject).count() == 0


def test_import_overwrite_defaults_to_true(session: Session) -> None:
    """
    ``ImportAssetsCommand.overwrite`` defaults to ``True`` for backwards
    compatibility — historically the command always overwrote existing assets.
    """
    from superset.commands.importers.v1.assets import ImportAssetsCommand

    command = ImportAssetsCommand({})
    assert command.overwrite is True

    explicit_false = ImportAssetsCommand({}, overwrite=False)
    assert explicit_false.overwrite is False


def test_import_threads_overwrite_flag(mocker: MockerFixture, session: Session) -> None:
    """
    ``overwrite`` must be threaded through to ``import_database``,
    ``import_saved_query``, ``import_dataset``, ``import_chart`` and
    ``import_dashboard``. Previously these were hard-coded to ``overwrite=True``
    which caused the API flag to be ignored.
    """
    from superset import security_manager
    from superset.commands.importers.v1 import assets as assets_module
    from superset.commands.importers.v1.assets import ImportAssetsCommand

    mocker.patch.object(security_manager, "can_access", return_value=True)

    mocked_db = mocker.patch.object(assets_module, "import_database")
    mocked_db.return_value.uuid = "a2dc77af-e654-49bb-b321-40f6b559a1ee"
    mocked_db.return_value.id = 1
    mocked_ds = mocker.patch.object(assets_module, "import_dataset")
    mocked_ds.return_value.uuid = "53d47c0c-c03d-47f0-b9ac-81225f808283"
    mocked_ds.return_value.id = 1
    mocked_ds.return_value.datasource_type = "table"
    mocked_ds.return_value.table_name = "video_game_sales"
    mocked_chart = mocker.patch.object(assets_module, "import_chart")
    mocked_chart.return_value.viz_type = "table"
    mocked_dash = mocker.patch.object(assets_module, "import_dashboard")
    mocker.patch.object(assets_module, "find_chart_uuids", return_value=[])
    mocker.patch.object(assets_module, "update_id_refs", side_effect=lambda c, *_: c)
    mocker.patch.object(assets_module, "migrate_dashboard")
    mocker.patch("superset.db.session.execute")

    configs = {
        **copy.deepcopy(databases_config),
        **copy.deepcopy(datasets_config),
        **copy.deepcopy(charts_config_1),
        **copy.deepcopy(dashboards_config_1),
    }

    ImportAssetsCommand._import(configs, overwrite=False)

    assert mocked_db.called
    for call in mocked_db.call_args_list:
        assert call.kwargs["overwrite"] is False
    for call in mocked_ds.call_args_list:
        assert call.kwargs["overwrite"] is False
    for call in mocked_chart.call_args_list:
        assert call.kwargs["overwrite"] is False
    for call in mocked_dash.call_args_list:
        assert call.kwargs["overwrite"] is False


def test_prevent_overwrite_flags_existing_assets(
    mocker: MockerFixture, session: Session
) -> None:
    """
    With ``overwrite=False``, ``_prevent_overwrite_existing_assets`` must
    surface a clear ``ValidationError`` for each asset whose UUID already
    exists in the database.
    """
    from superset import db, security_manager
    from superset.commands.importers.v1.assets import ImportAssetsCommand
    from superset.models.slice import Slice

    mocker.patch.object(security_manager, "can_access", return_value=True)
    engine = db.session.get_bind()
    Slice.metadata.create_all(engine)  # pylint: disable=no-member

    # seed the database with the fixture assets
    seed_configs = {
        **copy.deepcopy(databases_config),
        **copy.deepcopy(datasets_config),
        **copy.deepcopy(charts_config_1),
        **copy.deepcopy(dashboards_config_1),
    }
    ImportAssetsCommand._import(seed_configs)

    command = ImportAssetsCommand({}, overwrite=False)
    command._configs = {
        **copy.deepcopy(databases_config),
        **copy.deepcopy(datasets_config),
        **copy.deepcopy(charts_config_1),
        **copy.deepcopy(dashboards_config_1),
    }

    exceptions: list[ValidationError] = []
    command._prevent_overwrite_existing_assets(exceptions)

    # one exception for each of the seeded assets (db + datasets + charts + dashboards)
    expected_count = (
        len(databases_config)
        + len(datasets_config)
        + len(charts_config_1)
        + len(dashboards_config_1)
    )
    assert len(exceptions) == expected_count
    for exc in exceptions:
        assert isinstance(exc, ValidationError)
        [(_, message)] = exc.messages.items()
        assert "already exists" in message
        assert "`overwrite=true` was not passed" in message


def test_prevent_overwrite_allows_new_assets(
    mocker: MockerFixture, session: Session
) -> None:
    """
    With ``overwrite=False`` and no conflicting UUIDs in the database, the
    validation step must not raise.
    """
    from superset import db, security_manager
    from superset.commands.importers.v1.assets import ImportAssetsCommand
    from superset.models.slice import Slice

    mocker.patch.object(security_manager, "can_access", return_value=True)
    engine = db.session.get_bind()
    Slice.metadata.create_all(engine)  # pylint: disable=no-member

    command = ImportAssetsCommand({}, overwrite=False)
    command._configs = {
        **copy.deepcopy(databases_config),
        **copy.deepcopy(datasets_config),
        **copy.deepcopy(charts_config_1),
        **copy.deepcopy(dashboards_config_1),
    }

    exceptions: list[ValidationError] = []
    command._prevent_overwrite_existing_assets(exceptions)

    assert exceptions == []


def test_prevent_overwrite_noop_when_overwrite_true(
    mocker: MockerFixture, session: Session
) -> None:
    """
    With ``overwrite=True`` (the default) the "already exists" validation must
    be a no-op even when assets exist in the database — this preserves the
    historical behavior.
    """
    from superset import db, security_manager
    from superset.commands.importers.v1.assets import ImportAssetsCommand
    from superset.models.slice import Slice

    mocker.patch.object(security_manager, "can_access", return_value=True)
    engine = db.session.get_bind()
    Slice.metadata.create_all(engine)  # pylint: disable=no-member

    seed_configs = {
        **copy.deepcopy(databases_config),
        **copy.deepcopy(datasets_config),
        **copy.deepcopy(charts_config_1),
        **copy.deepcopy(dashboards_config_1),
    }
    ImportAssetsCommand._import(seed_configs)

    command = ImportAssetsCommand({})  # overwrite defaults to True
    command._configs = copy.deepcopy(seed_configs)

    exceptions: list[ValidationError] = []
    command._prevent_overwrite_existing_assets(exceptions)

    assert exceptions == []


def test_prevent_overwrite_flags_existing_saved_queries(
    mocker: MockerFixture, session: Session
) -> None:
    """
    Saved queries (``queries/`` prefix) must also be covered by the
    "already exists" validation when ``overwrite=False`` — otherwise
    ``import_saved_query`` silently returns existing rows and the endpoint
    would appear to succeed despite the conflict.
    """
    from superset import db, security_manager
    from superset.commands.importers.v1.assets import ImportAssetsCommand
    from superset.models.slice import Slice
    from superset.models.sql_lab import SavedQuery

    mocker.patch.object(security_manager, "can_access", return_value=True)
    engine = db.session.get_bind()
    Slice.metadata.create_all(engine)  # pylint: disable=no-member
    SavedQuery.metadata.create_all(engine)  # pylint: disable=no-member

    # seed a saved query with a UUID that matches the fixture below
    saved_query_uuid = next(iter(saved_queries_config.values()))["uuid"]
    db.session.add(SavedQuery(uuid=saved_query_uuid, label="seeded"))
    db.session.flush()

    command = ImportAssetsCommand({}, overwrite=False)
    command._configs = copy.deepcopy(saved_queries_config)

    exceptions: list[ValidationError] = []
    command._prevent_overwrite_existing_assets(exceptions)

    assert len(exceptions) == 1
    [(file_name, message)] = exceptions[0].messages.items()
    assert file_name.startswith("queries/")
    assert "SavedQuery already exists" in message


def test_prevent_overwrite_partial_conflict(
    mocker: MockerFixture, session: Session
) -> None:
    """
    When only some of the incoming assets already exist, validation must flag
    exactly the conflicting ones and leave brand-new assets untouched.
    """
    from superset import db, security_manager
    from superset.commands.importers.v1.assets import ImportAssetsCommand
    from superset.models.slice import Slice

    mocker.patch.object(security_manager, "can_access", return_value=True)
    engine = db.session.get_bind()
    Slice.metadata.create_all(engine)  # pylint: disable=no-member

    # seed only databases + datasets; charts and dashboards stay new
    ImportAssetsCommand._import(
        {
            **copy.deepcopy(databases_config),
            **copy.deepcopy(datasets_config),
        }
    )

    command = ImportAssetsCommand({}, overwrite=False)
    command._configs = {
        **copy.deepcopy(databases_config),
        **copy.deepcopy(datasets_config),
        **copy.deepcopy(charts_config_1),
        **copy.deepcopy(dashboards_config_1),
    }

    exceptions: list[ValidationError] = []
    command._prevent_overwrite_existing_assets(exceptions)

    flagged_files = {next(iter(exc.messages)) for exc in exceptions}
    assert flagged_files == set(databases_config) | set(datasets_config)


def test_prevent_overwrite_queries_only_bundle_uuids(
    mocker: MockerFixture, session: Session
) -> None:
    """
    The validation must scope its UUID lookup to the UUIDs present in the
    import bundle (one ``WHERE uuid IN (...)`` query per prefix that has
    incoming entries) and skip prefixes with no entries entirely. Otherwise
    every import with ``overwrite=false`` would scan all asset tables in
    full, regardless of bundle size.
    """
    from superset import db, security_manager
    from superset.commands.importers.v1.assets import ImportAssetsCommand
    from superset.connectors.sqla.models import SqlaTable
    from superset.models.core import Database
    from superset.models.dashboard import Dashboard
    from superset.models.slice import Slice
    from superset.models.sql_lab import SavedQuery

    mocker.patch.object(security_manager, "can_access", return_value=True)
    engine = db.session.get_bind()
    Slice.metadata.create_all(engine)  # pylint: disable=no-member
    SavedQuery.metadata.create_all(engine)  # pylint: disable=no-member

    # bundle only contains a database — no datasets/charts/dashboards/queries
    bundle = copy.deepcopy(databases_config)

    spy = mocker.spy(db.session, "query")

    command = ImportAssetsCommand({}, overwrite=False)
    command._configs = bundle
    exceptions: list[ValidationError] = []
    command._prevent_overwrite_existing_assets(exceptions)

    # exactly one UUID query — for the only prefix with bundle entries — and
    # it targets the Database UUID column. Empty-bundle prefixes (datasets/
    # charts/dashboards/queries) must not be queried at all, otherwise this
    # validation degrades to a full-table scan per asset type.
    queried_columns = [
        call.args[0]
        for call in spy.call_args_list
        if call.args and getattr(call.args[0], "key", None) == "uuid"
    ]
    assert len(queried_columns) == 1
    assert queried_columns[0].class_ is Database

    queried_models = {col.class_ for col in queried_columns}
    for model_cls in (SqlaTable, Slice, Dashboard, SavedQuery):
        assert model_cls not in queried_models

    # no row matches in an empty table, so no validation errors are raised
    assert exceptions == []


def test_import_removes_dashboard_charts(
    mocker: MockerFixture, session: Session
) -> None:
    """
    Test that existing dashboards are updated without old charts.
    """
    from superset import db, security_manager
    from superset.commands.importers.v1.assets import ImportAssetsCommand
    from superset.models.dashboard import dashboard_slices
    from superset.models.slice import Slice

    mocker.patch.object(security_manager, "can_access", return_value=True)

    engine = db.session.get_bind()
    Slice.metadata.create_all(engine)  # pylint: disable=no-member
    base_configs = {
        **copy.deepcopy(databases_config),
        **copy.deepcopy(datasets_config),
        **copy.deepcopy(charts_config_1),
        **copy.deepcopy(dashboards_config_1),
    }
    new_configs = {
        **copy.deepcopy(databases_config),
        **copy.deepcopy(datasets_config),
        **copy.deepcopy(charts_config_2),
        **copy.deepcopy(dashboards_config_2),
    }
    expected_number_of_dashboards = len(dashboards_config_2)
    expected_number_of_charts = len(charts_config_2)

    ImportAssetsCommand._import(base_configs)
    ImportAssetsCommand._import(new_configs)
    dashboard_ids = db.session.scalars(
        select(dashboard_slices.c.dashboard_id).distinct()
    ).all()
    chart_ids = db.session.scalars(select(dashboard_slices.c.slice_id)).all()

    assert len(chart_ids) == expected_number_of_charts
    assert len(dashboard_ids) == expected_number_of_dashboards
