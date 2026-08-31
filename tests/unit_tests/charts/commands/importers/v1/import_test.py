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
from datetime import datetime, timezone
from unittest.mock import patch

import pytest
import yaml
from flask_appbuilder.security.sqla.models import Role, User
from pytest_mock import MockerFixture
from sqlalchemy.orm.session import Session

from superset import security_manager
from superset.commands.chart.importers.v1.utils import import_chart
from superset.commands.exceptions import ImportFailedError
from superset.commands.importers.v1.utils import import_tag
from superset.connectors.sqla.models import Database, SqlaTable
from superset.extensions import feature_flag_manager
from superset.models.slice import Slice
from superset.tags.models import TaggedObject
from superset.utils import json
from superset.utils.core import override_user
from tests.integration_tests.fixtures.importexport import chart_config


@pytest.fixture
def session_with_data(session: Session) -> Generator[Session, None, None]:
    engine = session.get_bind()
    SqlaTable.metadata.create_all(engine)  # pylint: disable=no-member

    dataset = SqlaTable(
        table_name="test_table",
        metrics=[],
        main_dttm_col=None,
        database=Database(database_name="my_database", sqlalchemy_uri="sqlite://"),
    )
    session.add(dataset)
    session.flush()
    slice = Slice(
        id=1,
        datasource_id=dataset.id,
        datasource_type="table",
        datasource_name="tmp_perm_table",
        slice_name="slice_name",
        uuid=chart_config["uuid"],
    )
    session.add(slice)
    session.flush()

    yield session
    session.rollback()


@pytest.fixture
def session_with_schema(session: Session) -> Generator[Session, None, None]:
    from superset.connectors.sqla.models import SqlaTable

    engine = session.get_bind()
    SqlaTable.metadata.create_all(engine)  # pylint: disable=no-member

    return session


def test_import_chart(mocker: MockerFixture, session_with_schema: Session) -> None:
    """
    Test importing a chart.
    """

    mock_can_access = mocker.patch.object(
        security_manager, "can_access", return_value=True
    )

    config = copy.deepcopy(chart_config)
    config["datasource_id"] = 1
    config["datasource_type"] = "table"

    chart = import_chart(config)
    assert chart.slice_name == "Deck Path"
    assert chart.viz_type == "deck_path"
    assert chart.is_managed_externally is False
    assert chart.external_url is None

    # Assert that the can write to chart was checked
    mock_can_access.assert_called_once_with("can_write", "Chart")


def test_import_chart_managed_externally(
    mocker: MockerFixture, session_with_schema: Session
) -> None:
    """
    Test importing a chart that is managed externally.
    """
    mock_can_access = mocker.patch.object(
        security_manager, "can_access", return_value=True
    )

    config = copy.deepcopy(chart_config)
    config["datasource_id"] = 1
    config["datasource_type"] = "table"
    config["is_managed_externally"] = True
    config["external_url"] = "https://example.org/my_chart"

    chart = import_chart(config)
    assert chart.is_managed_externally is True
    assert chart.external_url == "https://example.org/my_chart"

    # Assert that the can write to chart was checked
    mock_can_access.assert_called_once_with("can_write", "Chart")


def test_import_chart_without_permission(
    mocker: MockerFixture,
    session_with_schema: Session,
) -> None:
    """
    Test importing a chart when a user doesn't have permissions to create.
    """
    mock_can_access = mocker.patch.object(
        security_manager, "can_access", return_value=False
    )

    config = copy.deepcopy(chart_config)
    config["datasource_id"] = 1
    config["datasource_type"] = "table"

    with pytest.raises(ImportFailedError) as excinfo:
        import_chart(config)
    assert (
        str(excinfo.value)
        == "Chart doesn't exist and user doesn't have permission to create charts"
    )
    # Assert that the can write to chart was checked
    mock_can_access.assert_called_once_with("can_write", "Chart")


def test_filter_chart_annotations(session: Session) -> None:
    """
    Test importing a chart.
    """
    from superset.commands.chart.importers.v1.utils import filter_chart_annotations
    from tests.integration_tests.fixtures.importexport import (
        chart_config_with_mixed_annotations,
    )

    config = copy.deepcopy(chart_config_with_mixed_annotations)
    filter_chart_annotations(config)
    params = config["params"]
    annotation_layers = params["annotation_layers"]

    assert len(annotation_layers) == 1
    assert all([al["annotationType"] == "FORMULA" for al in annotation_layers])  # noqa: C419


def test_import_existing_chart_without_permission(
    mocker: MockerFixture,
    session_with_data: Session,
) -> None:
    """
    Test importing a chart when a user doesn't have permissions to modify.
    """
    mock_can_access = mocker.patch.object(
        security_manager, "can_access", return_value=True
    )
    mock_can_access_chart = mocker.patch.object(
        security_manager, "can_access_chart", return_value=False
    )

    slice = (
        session_with_data.query(Slice)
        .filter(Slice.uuid == chart_config["uuid"])
        .one_or_none()
    )

    user = User(
        first_name="Alice",
        last_name="Doe",
        email="adoe@example.org",
        username="admin",
        roles=[Role(name="Admin")],
    )

    with override_user(user):
        with pytest.raises(ImportFailedError) as excinfo:
            import_chart(chart_config, overwrite=True)
        assert (
            str(excinfo.value)
            == "A chart already exists and user doesn't have permissions to overwrite it"  # noqa: E501
        )

    # Assert that the can write to chart was checked
    mock_can_access.assert_called_once_with("can_write", "Chart")
    mock_can_access_chart.assert_called_once_with(slice)


def test_import_existing_chart_without_owner_permission(
    mocker: MockerFixture,
    session_with_data: Session,
) -> None:
    """
    Test importing a chart when a user doesn't have permissions to modify.
    """
    mock_can_access = mocker.patch.object(
        security_manager, "can_access", return_value=True
    )
    mock_can_access_chart = mocker.patch.object(
        security_manager, "can_access_chart", return_value=True
    )

    slice = (
        session_with_data.query(Slice)
        .filter(Slice.uuid == chart_config["uuid"])
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
            import_chart(chart_config, overwrite=True)
        assert (
            str(excinfo.value)
            == "A chart already exists and user doesn't have permissions to overwrite it"  # noqa: E501
        )

    # Assert that the can write to chart was checked
    mock_can_access.assert_called_once_with("can_write", "Chart")
    mock_can_access_chart.assert_called_once_with(slice)


def test_import_existing_chart_with_permission(
    mocker: MockerFixture,
    session_with_data: Session,
) -> None:
    """
    Test importing a chart that exists when a user has access permission to that chart.
    """
    mock_can_access = mocker.patch.object(
        security_manager, "can_access", return_value=True
    )
    mock_can_access_chart = mocker.patch.object(
        security_manager, "can_access_chart", return_value=True
    )

    admin = User(
        first_name="Alice",
        last_name="Doe",
        email="adoe@example.org",
        username="admin",
        roles=[Role(name="Admin")],
    )

    config = copy.deepcopy(chart_config)
    config["datasource_id"] = 1
    config["datasource_type"] = "table"

    slice = (
        session_with_data.query(Slice)
        .filter(Slice.uuid == config["uuid"])
        .one_or_none()
    )

    with override_user(admin):
        import_chart(config, overwrite=True)
    # Assert that the can write to chart was checked
    mock_can_access.assert_called_once_with("can_write", "Chart")
    mock_can_access_chart.assert_called_once_with(slice)


def _soft_delete_existing_chart(session: Session) -> int:
    """Soft-delete the seeded chart (by fixture UUID) and return its original id.

    Shared setup for the soft-delete import tests: locate the chart, stamp
    ``deleted_at``, flush, and return the id so callers can assert the restore
    happened in place (same id).
    """
    existing = (
        session.query(Slice).filter(Slice.uuid == chart_config["uuid"]).one_or_none()
    )
    assert existing is not None
    existing.deleted_at = datetime(2026, 1, 1, 12, 0, 0, tzinfo=timezone.utc)
    session.flush()
    return existing.id


def test_import_soft_deleted_chart_overwrite_restores_in_place(
    mocker: MockerFixture,
    session_with_data: Session,
) -> None:
    """
    Overwrite-importing a soft-deleted chart must restore the row in place,
    not hard-delete-and-replace. Otherwise out-of-archive references
    (dashboard_slices junctions, report.chart_id) would cascade away.
    """
    mocker.patch.object(security_manager, "can_access", return_value=True)
    mocker.patch.object(security_manager, "can_access_chart", return_value=True)

    original_id = _soft_delete_existing_chart(session_with_data)

    admin = User(
        first_name="Alice",
        last_name="Doe",
        email="adoe@example.org",
        username="admin",
        roles=[Role(name="Admin")],
    )

    config = copy.deepcopy(chart_config)
    config["datasource_id"] = 1
    config["datasource_type"] = "table"

    with override_user(admin):
        chart = import_chart(config, overwrite=True)

    assert chart.id == original_id
    assert chart.deleted_at is None


def test_import_soft_deleted_chart_ignore_permissions_restores_in_place(
    mocker: MockerFixture,
    session_with_data: Session,
) -> None:
    """
    The example loader path: ignore_permissions=True with no logged-in
    user. The if/elif structure must preserve config["id"] on the
    fallthrough overwrite path so the example loader can re-import over
    a soft-deleted match without colliding on the UUID unique index.
    """
    original_id = _soft_delete_existing_chart(session_with_data)

    config = copy.deepcopy(chart_config)
    config["datasource_id"] = 1
    config["datasource_type"] = "table"

    chart = import_chart(config, overwrite=True, ignore_permissions=True)

    assert chart.id == original_id
    assert chart.deleted_at is None


def test_import_soft_deleted_chart_non_overwrite_restores_for_editor(
    mocker: MockerFixture,
    session_with_data: Session,
) -> None:
    """
    Non-overwrite re-import of a soft-deleted UUID is implicitly a
    restore-and-update: the user is bringing the chart back by uploading
    it again. The same editorship rule as the overwrite path applies, so
    an editor (or admin) succeeds without setting overwrite=True.
    """
    mocker.patch.object(security_manager, "can_access", return_value=True)
    mocker.patch.object(security_manager, "can_access_chart", return_value=True)

    original_id = _soft_delete_existing_chart(session_with_data)

    admin = User(
        first_name="Alice",
        last_name="Doe",
        email="adoe@example.org",
        username="admin",
        roles=[Role(name="Admin")],
    )

    config = copy.deepcopy(chart_config)
    config["datasource_id"] = 1
    config["datasource_type"] = "table"

    with override_user(admin):
        chart = import_chart(config, overwrite=False)

    assert chart.id == original_id
    assert chart.deleted_at is None


def test_import_soft_deleted_chart_non_overwrite_raises_for_non_editor(
    mocker: MockerFixture,
    session_with_data: Session,
) -> None:
    """
    Non-overwrite re-import that would resurrect a soft-deleted chart
    must respect editorship: a non-editor without admin role cannot
    restore-via-import. Mirrors the explicit /restore endpoint's check.
    """
    mocker.patch.object(security_manager, "can_access", return_value=True)
    mocker.patch.object(security_manager, "can_access_chart", return_value=True)

    _soft_delete_existing_chart(session_with_data)

    non_editor = User(
        first_name="Bob",
        last_name="Roe",
        email="bob@example.org",
        username="bob",
        roles=[Role(name="Gamma")],
    )

    with override_user(non_editor):
        with pytest.raises(ImportFailedError) as excinfo:
            import_chart(chart_config, overwrite=False)
    assert "permissions to restore" in str(excinfo.value)


def test_import_soft_deleted_chart_raises_when_caller_lacks_can_write(
    mocker: MockerFixture,
    session_with_data: Session,
) -> None:
    """
    Case B: re-import of a soft-deleted UUID by a caller without
    can_write must raise, not silently return the soft-deleted row.

    Real-world scenario: a user has can_write Dashboard but not
    can_write Chart, and they import a dashboard zip that references a
    soft-deleted chart. Silently returning the row would let the
    dashboard importer reattach to it via chart_ids[uuid] = existing.id
    and produce a dashboard with hidden (broken) charts.
    """
    mocker.patch.object(security_manager, "can_access", return_value=False)

    _soft_delete_existing_chart(session_with_data)

    with pytest.raises(ImportFailedError) as excinfo:
        import_chart(chart_config, overwrite=False)
    assert "can_write" in str(excinfo.value)


def test_import_existing_active_chart_overwrite_without_can_write_returns_existing(
    mocker: MockerFixture,
    session_with_data: Session,
) -> None:
    """
    An *active* (not soft-deleted) chart re-imported with overwrite=True by a
    caller without can_write must fall through to returning the existing row,
    not raise the restore error. Case B is keyed on ``is_soft_deleted``, so the
    fused ``needs_mutation`` condition must not pull active rows into the
    restore-without-permission branch (pre-soft-delete overwrite behaviour).
    """
    mocker.patch.object(security_manager, "can_access", return_value=False)

    existing = (
        session_with_data.query(Slice).filter(Slice.uuid == chart_config["uuid"]).one()
    )
    assert existing.deleted_at is None

    result = import_chart(chart_config, overwrite=True)

    assert result.id == existing.id
    assert result.deleted_at is None


def test_import_chart_synthesizes_query_context(
    mocker: MockerFixture, session_with_schema: Session
) -> None:
    """
    #33615 / F1-T2: importing a derivable chart that arrives WITHOUT a
    query_context persists a synthesized one naming the resolved datasource.
    """
    mocker.patch.object(security_manager, "can_access", return_value=True)

    config = copy.deepcopy(chart_config)
    config["datasource_id"] = 1
    config["datasource_type"] = "table"
    # Make the chart derivable and strip its persisted context.
    config["viz_type"] = "table"
    config["params"]["viz_type"] = "table"
    config["params"]["metrics"] = ["count"]
    config["params"]["groupby"] = ["gender"]
    config.pop("query_context", None)

    chart = import_chart(config)

    # --- RED anchor: a synthesized context is persisted (FR-001) ---
    assert chart.query_context is not None
    query_context = json.loads(chart.query_context)
    # --- RED anchor: datasource taken from resolved id, not params (RISK-T02) ---
    assert query_context["datasource"] == {"id": 1, "type": "table"}
    assert query_context["queries"][0]["metrics"] == ["count"]


def test_import_chart_preserves_existing_query_context(
    mocker: MockerFixture, session_with_schema: Session
) -> None:
    """
    FR-006 / INV-3: an imported chart that already carries a query_context is
    left untouched — synthesis is non-destructive (absent-guard).
    """
    mocker.patch.object(security_manager, "can_access", return_value=True)

    config = copy.deepcopy(chart_config)
    config["datasource_id"] = 1
    config["datasource_type"] = "table"
    original_query_context = config["query_context"]

    chart = import_chart(config)

    # --- RED anchor: existing context is preserved verbatim (idempotent) ---
    assert chart.query_context is not None
    assert json.loads(chart.query_context) == json.loads(original_query_context)


def test_synthesis_runs_after_migration_for_legacy_viz(
    mocker: MockerFixture, session_with_schema: Session
) -> None:
    """
    #33615 review: query_context synthesis must run AFTER ``migrate_chart`` so a
    legacy viz type (``dual_line`` -> ``mixed_timeseries``) derives its context
    from the MIGRATED viz_type/params, not the pre-migration form data. Otherwise
    the persisted context describes a chart shape that no longer exists.
    """
    mocker.patch.object(security_manager, "can_access", return_value=True)
    # Force the generic fallback and capture the viz_type it is handed.
    fallback = mocker.patch(
        "superset.commands.chart.importers.v1.utils.build_query_context_config",
        return_value=None,
    )
    # Make the V8 generator a no-op so the (spied) fallback is exercised.
    mocker.patch(
        "superset.commands.chart.importers.v1.utils.get_query_context_generator"
    ).return_value.generate.return_value = None

    config = copy.deepcopy(chart_config)
    config["datasource_id"] = 1
    config["datasource_type"] = "table"
    config["viz_type"] = "dual_line"
    config["params"]["viz_type"] = "dual_line"
    config.pop("query_context", None)

    chart = import_chart(config)

    # The chart is migrated to the modern viz type ...
    assert chart.viz_type == "mixed_timeseries"
    # ... and synthesis saw the MIGRATED viz type, never "dual_line".
    assert fallback.call_args is not None
    passed_viz_type = fallback.call_args.args[1]
    assert passed_viz_type == "mixed_timeseries"


def test_synthesis_drops_source_slice_id_from_generator_params(
    mocker: MockerFixture, session_with_schema: Session
) -> None:
    """
    #33615 review: the exported ``slice_id`` must not reach the V8 buildQuery form
    data. If that id belongs to an unrelated chart in the destination,
    ``QueryContextFactory`` would resolve that chart from the synthesized context,
    changing its cache/guest-access behavior. It is dropped before generation.
    """
    mocker.patch.object(security_manager, "can_access", return_value=True)
    generator = mocker.patch(
        "superset.commands.chart.importers.v1.utils.get_query_context_generator"
    ).return_value
    generator.generate.return_value = None  # force fallback; we inspect the call

    config = copy.deepcopy(chart_config)
    config["datasource_id"] = 1
    config["datasource_type"] = "table"
    config["viz_type"] = "table"
    config["params"]["viz_type"] = "table"
    config["params"]["metrics"] = ["count"]
    config["params"]["slice_id"] = 999999  # a foreign id from the source export
    config.pop("query_context", None)

    import_chart(config)

    # The V8 generator was called with form data that no longer carries slice_id.
    assert generator.generate.called
    passed_params = generator.generate.call_args.args[1]
    assert "slice_id" not in passed_params


def test_import_non_derivable_chart_leaves_query_context_null(
    mocker: MockerFixture, session_with_schema: Session
) -> None:
    """
    FR-003: a non-derivable chart (datasource-less viz) imports with a NULL
    query_context — no fabricated context, and no crash.
    """
    mocker.patch.object(security_manager, "can_access", return_value=True)

    config = copy.deepcopy(chart_config)
    config["datasource_id"] = 1
    config["datasource_type"] = "table"
    config["viz_type"] = "markup"
    config["params"]["viz_type"] = "markup"
    config.pop("query_context", None)

    chart = import_chart(config)

    # --- RED anchor: honest-fail leaves NULL, import still succeeds (FR-003) ---
    assert chart.query_context is None


def test_import_tag_logic_for_charts(session_with_schema: Session):
    contents = {
        "tags.yaml": yaml.dump(
            {"tags": [{"tag_name": "tag_1", "description": "Description for tag_1"}]}
        )
    }

    object_id = 1
    object_type = "chart"

    with patch.object(feature_flag_manager, "is_feature_enabled", return_value=True):
        new_tag_ids = import_tag(
            ["tag_1"], contents, object_id, object_type, session_with_schema
        )
        assert len(new_tag_ids) > 0
        assert (
            session_with_schema.query(TaggedObject)
            .filter_by(object_id=object_id, object_type=object_type)
            .count()
            > 0
        )

    session_with_schema.query(TaggedObject).filter_by(
        object_id=object_id, object_type=object_type
    ).delete()
    session_with_schema.commit()

    with patch.object(feature_flag_manager, "is_feature_enabled", return_value=False):
        new_tag_ids_disabled = import_tag(
            ["tag_1"], contents, object_id, object_type, session_with_schema
        )
        assert len(new_tag_ids_disabled) == 0
        associated_tags = (
            session_with_schema.query(TaggedObject)
            .filter_by(object_id=object_id, object_type=object_type)
            .all()
        )
        assert len(associated_tags) == 0
