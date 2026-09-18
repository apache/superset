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
"""Typed bundle identities must not become table IDs or grant datasource access."""

import copy
import importlib
import inspect
from types import ModuleType
from typing import Any
from unittest.mock import Mock
from uuid import UUID

import pytest
import yaml
from flask import current_app, Response
from flask_appbuilder.api import safe
from marshmallow import ValidationError
from sqlalchemy.orm import Session

from superset import security_manager
from superset.charts.schemas import ImportV1ChartSchema
from superset.commands.chart.export import ExportChartsCommand
from superset.commands.exceptions import CommandInvalidError, ImportFailedError
from superset.connectors.sqla.models import SqlaTable
from superset.models.core import Database
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice
from superset.semantic_layers import import_export as refs
from superset.semantic_layers.models import SemanticLayer, SemanticView
from superset.utils import json

VIEW_UUID: str = "efafe588-5c67-4d1c-a9bb-ab1839f8cf59"
CHART_UUID: str = "d766261b-5cb0-4ea1-b62c-0da4860116c1"


@pytest.fixture
def view(app_context: None, monkeypatch: pytest.MonkeyPatch) -> SemanticView:
    """A real model and access predicate, with no provider instantiation."""
    model: SemanticView = SemanticView(
        id=81,
        uuid=UUID(VIEW_UUID),
        name="existing semantic view",
        perm="view-grant",
        semantic_layer=SemanticLayer(type="test-provider", perm="layer-grant"),
    )
    monkeypatch.setattr(
        refs.feature_flag_manager,
        "is_feature_enabled",
        lambda flag: flag == "SEMANTIC_LAYERS",
    )
    monkeypatch.setattr(security_manager, "can_access_all_datasources", lambda: False)
    monkeypatch.setattr(
        security_manager,
        "can_access",
        lambda permission, resource: resource == "view-grant",
    )
    monkeypatch.setitem(
        refs.registry,
        "test-provider",
        Mock(spec=[], side_effect=AssertionError("provider must not be instantiated")),
    )
    query: Mock = Mock()
    query.options.return_value = query
    query.filter.return_value.all.return_value = [model]
    monkeypatch.setattr(refs.db.session, "query", Mock(return_value=query))
    return model


def chart_config() -> dict[str, Any]:
    """Use deliberately different archived and destination IDs."""
    return {
        "uuid": CHART_UUID,
        "version": "1.0.0",
        "slice_name": "semantic chart",
        "viz_type": "table",
        "datasource_ref": {"type": "semantic_view", "uuid": VIEW_UUID},
        "params": {"datasource": "7__semantic_view", "metrics": ["revenue"]},
        "query_context": json.dumps(
            {
                "datasource": {"id": 7, "type": "semantic_view"},
                "form_data": {"datasource": "7__semantic_view"},
                "queries": [
                    {
                        "datasource": {"id": 7, "type": "semantic_view"},
                        "metrics": ["revenue"],
                    }
                ],
            }
        ),
    }


@pytest.mark.parametrize(
    "reference",
    [
        None,
        {},
        {"type": "table", "uuid": VIEW_UUID},
        {"type": "semantic_view", "uuid": "bad"},
        {
            "type": "semantic_view",
            "uuid": VIEW_UUID,
            "configuration": {"token": "not-allowed"},
        },
    ],
)
def test_chart_schema_rejects_invalid_reference(reference: Any) -> None:
    """A missing dataset_uuid is permitted only with a valid semantic reference."""
    config: dict[str, Any] = chart_config()
    config["datasource_ref"] = reference
    with pytest.raises(ValidationError):
        ImportV1ChartSchema().load(config)


def test_chart_schema_rejects_ambiguous_and_missing_reference() -> None:
    """Never pick one of two contradictory source representations."""
    config: dict[str, Any] = chart_config()
    config["dataset_uuid"] = VIEW_UUID
    with pytest.raises(ValidationError):
        ImportV1ChartSchema().load(config)
    config.pop("datasource_ref")
    ImportV1ChartSchema().load(config)
    config.pop("dataset_uuid")
    with pytest.raises(ValidationError):
        ImportV1ChartSchema().load(config)


@pytest.mark.parametrize(
    "module_name,command_name",
    [
        ("superset.commands.chart.importers.v1", "ImportChartsCommand"),
        ("superset.commands.dashboard.importers.v1", "ImportDashboardsCommand"),
        ("superset.commands.importers.v1.assets", "ImportAssetsCommand"),
    ],
)
def test_each_importer_rebinds_semantic_chart(
    view: SemanticView,
    monkeypatch: pytest.MonkeyPatch,
    module_name: str,
    command_name: str,
) -> None:
    """Exercise real entry-point orchestration/remapping, stubbing only writers."""
    module: ModuleType = importlib.import_module(module_name)
    importer: Any = getattr(module, command_name)
    writer: Mock = Mock(
        return_value=Mock(id=91, uuid=UUID(CHART_UUID), viz_type="table")
    )
    monkeypatch.setattr(module, "import_chart", writer)
    monkeypatch.setattr(module, "get_default_viewers_for_current_user", lambda: [])
    configs: dict[str, Any] = {"charts/chart.yaml": chart_config()}
    importer._import(configs, overwrite=True)
    writer.assert_called_once()
    actual: dict[str, Any] = writer.call_args.args[0]
    assert actual["datasource_id"] == 81
    assert actual["datasource_type"] == "semantic_view"
    assert "datasource_ref" not in actual
    assert "dataset_uuid" not in actual
    assert actual["params"] == {
        "datasource": "81__semantic_view",
        "metrics": ["revenue"],
    }
    context: dict[str, Any] = json.loads(actual["query_context"])
    assert context["datasource"] == {"id": 81, "type": "semantic_view"}
    assert context["form_data"]["datasource"] == "81__semantic_view"
    assert context["queries"][0] == {
        "datasource": {"id": 81, "type": "semantic_view"},
        "metrics": ["revenue"],
    }


@pytest.mark.parametrize("failure", ["missing", "denied", "disabled", "provider"])
@pytest.mark.parametrize(
    "module_name,command_name",
    [
        ("superset.commands.chart.importers.v1", "ImportChartsCommand"),
        ("superset.commands.dashboard.importers.v1", "ImportDashboardsCommand"),
        ("superset.commands.importers.v1.assets", "ImportAssetsCommand"),
    ],
)
def test_dependency_failure_precedes_any_bundle_write(
    view: SemanticView,
    monkeypatch: pytest.MonkeyPatch,
    failure: str,
    module_name: str,
    command_name: str,
) -> None:
    """Even unrelated database/dataset assets must not write before preflight."""
    module: ModuleType = importlib.import_module(module_name)
    importer: Any = getattr(module, command_name)
    writes: list[Mock] = []
    for name in ("import_database", "import_dataset", "import_chart"):
        writer: Mock = Mock(side_effect=AssertionError("write before preflight"))
        monkeypatch.setattr(module, name, writer)
        writes.append(writer)
    if failure == "missing":
        refs.db.session.query.return_value.filter.return_value.all.return_value = []
    elif failure == "denied":
        monkeypatch.setattr(security_manager, "can_access", lambda *args: False)
    elif failure == "disabled":
        monkeypatch.setattr(
            refs.feature_flag_manager, "is_feature_enabled", lambda flag: False
        )
    else:
        monkeypatch.delitem(refs.registry, "test-provider")
    configs: dict[str, Any] = {
        "databases/database.yaml": {"uuid": "db"},
        "datasets/dataset.yaml": {"uuid": "table", "database_uuid": "db"},
        "charts/chart.yaml": chart_config(),
    }
    with pytest.raises(refs.SemanticReferenceError):
        importer._import(configs, overwrite=True)
    for writer in writes:
        writer.assert_not_called()


@pytest.mark.parametrize(
    "control", ["native_filter_configuration", "chart_customization_config"]
)
def test_dashboard_semantic_target_roundtrip(view: SemanticView, control: str) -> None:
    """Typed target serialization preserves the semantic view UUID and type."""
    metadata: dict[str, Any] = {
        control: [
            {
                "targets": [
                    {
                        "datasetId": 81,
                        "datasourceType": "semantic_view",
                        "column": {"name": "country"},
                    }
                ]
            }
        ]
    }
    refs.export_dashboard_references(metadata)
    target: dict[str, Any] = metadata[control][0]["targets"][0]
    assert "datasetId" not in target
    assert "datasetUuid" not in target
    assert target["datasourceRef"] == {"type": "semantic_view", "uuid": VIEW_UUID}
    info: dict[str, dict[str, Any]] = refs.resolve_bundle_references(
        {"dashboards/d.yaml": {"metadata": copy.deepcopy(metadata)}}
    )
    refs.restore_dashboard_references(metadata, info)
    assert target == {
        "datasetId": 81,
        "datasourceType": "semantic_view",
        "column": {"name": "country"},
    }


def test_layer_grant_authorizes_reference_without_view_grant(
    view: SemanticView, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Use the model's actual parent-layer grant rule, not a new permission rule."""
    monkeypatch.setattr(
        security_manager,
        "can_access",
        lambda permission, resource: resource == "layer-grant",
    )
    assert refs.export_view_reference(view) == {
        "type": "semantic_view",
        "uuid": VIEW_UUID,
    }


def test_table_only_bundle_does_not_need_semantic_feature(
    app_context: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Do not query semantic models or flags for a legacy bundle."""
    forbidden: Mock = Mock(side_effect=AssertionError("semantic lookup for table"))
    monkeypatch.setattr(refs.db.session, "query", forbidden)
    monkeypatch.setattr(refs.feature_flag_manager, "is_feature_enabled", forbidden)
    assert (
        refs.resolve_bundle_references({"charts/a.yaml": {"dataset_uuid": VIEW_UUID}})
        == {}
    )


@pytest.mark.parametrize("dataset_id", [None, True, False, "", "invalid", 1.5])
def test_export_rejects_invalid_semantic_target_id_before_lookup(
    app_context: None, monkeypatch: pytest.MonkeyPatch, dataset_id: Any
) -> None:
    """Invalid local IDs cannot reach a semantic lookup or mutate the target."""
    query: Mock = Mock(side_effect=AssertionError("invalid ID reached lookup"))
    monkeypatch.setattr(refs.db.session, "query", query)
    target: dict[str, Any] = {
        "datasourceType": "semantic_view",
        "datasetId": dataset_id,
    }
    metadata: dict[str, Any] = {"native_filter_configuration": [{"targets": [target]}]}
    before: dict[str, Any] = copy.deepcopy(metadata)
    with pytest.raises(refs.SemanticReferenceError, match="requires a datasetId"):
        refs.export_dashboard_references(metadata)
    query.assert_not_called()
    assert metadata == before


def test_bundle_preflight_rejects_ambiguous_chart_before_lookup(
    app_context: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Preflight itself rejects both identities, even without schema loading."""
    query: Mock = Mock(side_effect=AssertionError("ambiguous chart reached lookup"))
    monkeypatch.setattr(refs.db.session, "query", query)
    config: dict[str, Any] = chart_config()
    config["dataset_uuid"] = VIEW_UUID
    excinfo: pytest.ExceptionInfo[refs.SemanticReferenceError]
    with pytest.raises(
        refs.SemanticReferenceError, match="Specify only one chart datasource reference"
    ) as excinfo:
        refs.resolve_bundle_references({"charts/chart.yaml": config})
    assert isinstance(excinfo.value.__cause__, ValidationError)
    query.assert_not_called()
    assert config["dataset_uuid"] == config["datasource_ref"]["uuid"] == VIEW_UUID


def test_chart_semantic_info_preserves_table_reference() -> None:
    """A table UUID must not resolve through the colliding semantic UUID map."""
    config: dict[str, Any] = {"dataset_uuid": VIEW_UUID}
    semantic_info: dict[str, dict[str, Any]] = {
        VIEW_UUID: {"datasource_id": 81, "datasource_type": "semantic_view"}
    }
    assert refs.chart_semantic_info(config, semantic_info) is None
    assert config == {"dataset_uuid": VIEW_UUID}


@pytest.mark.parametrize(
    "control", ["native_filter_configuration", "chart_customization_config"]
)
def test_restore_mixed_targets_preserves_table_identity(control: str) -> None:
    """Rebind a semantic target without changing a preceding same-UUID table."""
    table: dict[str, Any] = {"datasetUuid": VIEW_UUID, "datasourceType": "table"}
    semantic: dict[str, Any] = {
        "datasourceRef": {"type": "semantic_view", "uuid": VIEW_UUID},
        "column": {"name": "country"},
    }
    metadata: dict[str, Any] = {control: [{"targets": [table, semantic]}]}
    refs.restore_dashboard_references(metadata, {VIEW_UUID: {"datasource_id": 81}})
    assert table == {"datasetUuid": VIEW_UUID, "datasourceType": "table"}
    assert semantic == {
        "datasetId": 81,
        "datasourceType": "semantic_view",
        "column": {"name": "country"},
    }
    assert metadata[control][0]["targets"] == [table, semantic]


@pytest.fixture
def persisted_view(
    app_context: None, session: Session, monkeypatch: pytest.MonkeyPatch
) -> SemanticView:
    """Use only an in-memory metastore, with colliding table/view identities."""
    Slice.metadata.create_all(session.get_bind())
    monkeypatch.setattr(
        refs.feature_flag_manager,
        "is_feature_enabled",
        lambda flag: flag == "SEMANTIC_LAYERS",
    )
    monkeypatch.setattr(
        security_manager,
        "can_access",
        lambda permission, resource: (permission, resource)
        in {
            ("datasource_access", "view-grant"),
            ("can_write", "Chart"),
            ("can_write", "Dashboard"),
        },
    )
    monkeypatch.setattr(security_manager, "can_access_all_datasources", lambda: False)
    monkeypatch.setattr(security_manager, "semantic_view_after_insert", Mock())
    monkeypatch.setattr(security_manager, "semantic_layer_after_insert", Mock())
    monkeypatch.setitem(
        refs.registry,
        "test-provider",
        Mock(spec=[], side_effect=AssertionError("provider call")),
    )
    layer: SemanticLayer = SemanticLayer(
        name="local layer",
        type="test-provider",
        configuration='{"token":"layer-secret"}',
        perm="layer-grant",
    )
    model: SemanticView = SemanticView(
        id=81,
        uuid=UUID(VIEW_UUID),
        name="existing view",
        semantic_layer=layer,
        configuration='{"token":"view-secret"}',
        perm="view-grant",
    )
    database: Database = Database(database_name="local", sqlalchemy_uri="sqlite://")
    table: SqlaTable = SqlaTable(
        id=81, uuid=UUID(VIEW_UUID), table_name="collision", database=database
    )
    session.add_all([model, table])
    session.commit()
    return model


def test_persisted_view_grant_does_not_authorize_another_view(
    persisted_view: SemanticView,
) -> None:
    """The persisted fixture allows A but rejects B and its parent layer."""
    assert refs.export_view_reference(persisted_view)["uuid"] == VIEW_UUID
    denied: SemanticView = SemanticView(
        name="denied view",
        uuid=UUID("bff213f2-40c4-4da1-95c2-cea73731b713"),
        perm="denied-view-grant",
        semantic_layer=persisted_view.semantic_layer,
    )
    with pytest.raises(refs.SemanticReferenceError, match="missing or inaccessible"):
        refs.export_view_reference(denied)
    assert not security_manager.can_access("wrong_permission", "view-grant")


@pytest.mark.parametrize(
    "module_name,command_name",
    [
        ("superset.commands.chart.importers.v1", "ImportChartsCommand"),
        ("superset.commands.dashboard.importers.v1", "ImportDashboardsCommand"),
        ("superset.commands.importers.v1.assets", "ImportAssetsCommand"),
    ],
)
def test_import_persists_semantic_identity_not_same_id_table(
    persisted_view: SemanticView,
    session: Session,
    monkeypatch: pytest.MonkeyPatch,
    module_name: str,
    command_name: str,
) -> None:
    """Real chart writer, ORM relationship, exporter and schema roundtrip."""
    module: ModuleType = importlib.import_module(module_name)
    importer: Any = getattr(module, command_name)
    monkeypatch.setattr(module, "get_default_viewers_for_current_user", lambda: [])
    importer._import({"charts/chart.yaml": chart_config()}, overwrite=True)
    session.flush()
    session.expire_all()
    chart: Slice = session.query(Slice).filter(Slice.uuid == UUID(CHART_UUID)).one()
    assert chart.datasource_id == 81
    assert chart.datasource_type == "semantic_view"
    assert chart.table is None
    assert chart.semantic_view.uuid == UUID(VIEW_UUID)
    exported: str = ExportChartsCommand._file_content(chart)
    assert "dataset_uuid" not in exported
    assert "layer-secret" not in exported
    assert "view-secret" not in exported
    ImportV1ChartSchema().load(yaml.safe_load(exported))


@pytest.mark.parametrize(
    "module_name,command_name",
    [
        ("superset.commands.dashboard.importers.v1", "ImportDashboardsCommand"),
        ("superset.commands.importers.v1.assets", "ImportAssetsCommand"),
    ],
)
def test_dashboard_export_import_rebinds_both_target_kinds(
    persisted_view: SemanticView,
    session: Session,
    monkeypatch: pytest.MonkeyPatch,
    module_name: str,
    command_name: str,
) -> None:
    """Real dashboard serialization and writes preserve typed filter identities."""
    from superset.commands.dashboard.export import ExportDashboardsCommand

    source: Dashboard = Dashboard(
        id=17,
        uuid=UUID("d80091a6-c364-4cee-b2fa-479c67e46bcb"),
        dashboard_title="semantic targets",
        slices=[],
        json_metadata=json.dumps(
            {
                key: [
                    {
                        "id": key,
                        "targets": [
                            {
                                "datasetId": 81,
                                "datasourceType": "semantic_view",
                                "column": {"name": "country"},
                            }
                        ],
                    }
                ]
                for key in ("native_filter_configuration", "chart_customization_config")
            }
        ),
    )
    exported: str = ExportDashboardsCommand._file_content(source)
    assert "datasetUuid" not in exported
    assert "datasetId" not in exported
    # Re-ID the destination to prove the archive is resolved by UUID, not 81.
    session.query(SemanticView).filter(SemanticView.id == 81).update({"id": 82})
    session.flush()
    session.expire_all()
    module: ModuleType = importlib.import_module(module_name)
    importer: Any = getattr(module, command_name)
    monkeypatch.setattr(module, "get_default_viewers_for_current_user", lambda: [])
    importer._import({"dashboards/d.yaml": yaml.safe_load(exported)}, overwrite=True)
    session.flush()
    session.expire_all()
    dashboard: Dashboard = (
        session.query(Dashboard).filter(Dashboard.uuid == source.uuid).one()
    )
    metadata: dict[str, Any] = json.loads(dashboard.json_metadata)
    for key in ("native_filter_configuration", "chart_customization_config"):
        assert metadata[key][0]["targets"] == [
            {
                "datasetId": 82,
                "datasourceType": "semantic_view",
                "column": {"name": "country"},
            }
        ]


def test_dashboard_related_export_never_exports_same_id_table(
    persisted_view: SemanticView, monkeypatch: pytest.MonkeyPatch
) -> None:
    """A semantic native target must not cause an unrelated table bundle export."""
    from superset.commands.dashboard import export as dashboard_export

    source: Dashboard = Dashboard(
        id=17,
        uuid=UUID("d80091a6-c364-4cee-b2fa-479c67e46bcb"),
        dashboard_title="semantic targets",
        slices=[],
        json_metadata=json.dumps(
            {
                "native_filter_configuration": [
                    {"targets": [{"datasetId": 81, "datasourceType": "semantic_view"}]}
                ]
            }
        ),
    )
    monkeypatch.setattr(
        dashboard_export.ExportChartsCommand, "run", lambda *args, **kwargs: iter(())
    )
    unexpected: Mock = Mock(
        side_effect=AssertionError("semantic target exported a table")
    )
    monkeypatch.setattr(dashboard_export, "ExportDatasetsCommand", unexpected)
    outputs: list[Any] = list(dashboard_export.ExportDashboardsCommand._export(source))
    assert len(outputs) == 1
    unexpected.assert_not_called()


@pytest.mark.parametrize(
    "target",
    [
        {"datasetId": 81, "datasourceType": "semantic_view"},
        {
            "datasourceRef": {"type": "semantic_view", "uuid": VIEW_UUID},
            "datasetUuid": VIEW_UUID,
        },
        {
            "datasourceRef": {"type": "semantic_view", "uuid": VIEW_UUID},
            "datasourceType": "table",
        },
        {"datasourceRef": {"type": "table", "uuid": VIEW_UUID}},
    ],
)
def test_ambiguous_dashboard_target_rejected_before_lookup(
    app_context: None, monkeypatch: pytest.MonkeyPatch, target: dict[str, Any]
) -> None:
    """Raw IDs and contradictory discriminators cannot become imported references."""
    query: Mock = Mock(side_effect=AssertionError("invalid target reached lookup"))
    monkeypatch.setattr(refs.db.session, "query", query)
    with pytest.raises(
        refs.SemanticReferenceError, match="Invalid semantic datasource reference"
    ):
        refs.resolve_bundle_references(
            {
                "dashboards/d.yaml": {
                    "metadata": {"native_filter_configuration": [{"targets": [target]}]}
                }
            }
        )


@pytest.mark.parametrize(
    "module_name,command_name",
    [
        ("superset.commands.chart.importers.v1", "ImportChartsCommand"),
        ("superset.commands.dashboard.importers.v1", "ImportDashboardsCommand"),
        ("superset.commands.importers.v1.assets", "ImportAssetsCommand"),
    ],
)
def test_import_transaction_rolls_back_late_failure(
    persisted_view: SemanticView,
    session: Session,
    monkeypatch: pytest.MonkeyPatch,
    module_name: str,
    command_name: str,
) -> None:
    """Exercise each public command transaction after a real chart flush."""
    from superset.commands.chart.importers.v1.utils import import_chart

    module: ModuleType = importlib.import_module(module_name)
    command: Any = getattr(module, command_name)({})
    command._configs = {"charts/chart.yaml": chart_config()}
    monkeypatch.setattr(command, "validate", lambda: None)
    monkeypatch.setattr(module, "get_default_viewers_for_current_user", lambda: [])

    def write_then_fail(config: dict[str, Any], **kwargs: Any) -> Slice:
        """Flush a real imported chart before injecting a later command failure."""
        chart: Slice = import_chart(config, **kwargs)
        session.flush()
        assert chart.id is not None
        assert session.query(Slice).filter(Slice.uuid == UUID(CHART_UUID)).count() == 1
        raise ImportFailedError("injected after chart write")

    monkeypatch.setattr(module, "import_chart", write_then_fail)
    with pytest.raises(ImportFailedError):
        command.run()
    assert session.query(Slice).filter(Slice.uuid == UUID(CHART_UUID)).count() == 0
    assert (
        session.query(SemanticView).filter(SemanticView.uuid == UUID(VIEW_UUID)).count()
        == 1
    )


@pytest.mark.parametrize(
    "module_name,command_name",
    [
        ("superset.commands.chart.importers.v1", "ImportChartsCommand"),
        ("superset.commands.dashboard.importers.v1", "ImportDashboardsCommand"),
        ("superset.commands.importers.v1.assets", "ImportAssetsCommand"),
    ],
)
def test_public_command_preserves_clear_dependency_error(
    persisted_view: SemanticView,
    session: Session,
    monkeypatch: pytest.MonkeyPatch,
    module_name: str,
    command_name: str,
) -> None:
    """Dependency failures must not turn into a generic unknown-error HTTP 500."""
    module: ModuleType = importlib.import_module(module_name)
    command: Any = getattr(module, command_name)({})
    command._configs = {"charts/chart.yaml": chart_config()}
    monkeypatch.setattr(command, "validate", lambda: None)
    monkeypatch.setattr(security_manager, "can_access", lambda *args: False)
    error: pytest.ExceptionInfo[CommandInvalidError]
    with pytest.raises(CommandInvalidError, match="missing or inaccessible") as error:
        command.run()
    assert error.value.status == 422
    assert session.query(Slice).count() == 0


@pytest.mark.parametrize("failure", ["missing", "denied", "disabled", "provider"])
@pytest.mark.parametrize("kind", ["chart", "dashboard"])
def test_export_rejects_unavailable_dependencies(
    view: SemanticView, monkeypatch: pytest.MonkeyPatch, failure: str, kind: str
) -> None:
    """A reference export must not bypass the view grant or feature/provider gate."""
    chart: Slice = Slice(
        id=91,
        uuid=UUID(CHART_UUID),
        slice_name="semantic",
        viz_type="table",
        datasource_id=81,
        datasource_type="semantic_view",
        params="{}",
        semantic_view=view,
    )
    if failure == "missing":
        chart.semantic_view = None
        refs.db.session.query.return_value.filter.return_value.all.return_value = []
    elif failure == "denied":
        monkeypatch.setattr(security_manager, "can_access", lambda *args: False)
    elif failure == "disabled":
        monkeypatch.setattr(
            refs.feature_flag_manager, "is_feature_enabled", lambda flag: False
        )
    else:
        monkeypatch.delitem(refs.registry, "test-provider")
    metadata: dict[str, Any] = {
        "native_filter_configuration": [
            {"targets": [{"datasetId": 81, "datasourceType": "semantic_view"}]}
        ]
    }
    if kind == "chart":
        with pytest.raises(refs.SemanticReferenceError):
            ExportChartsCommand._file_content(chart)
    else:
        with pytest.raises(refs.SemanticReferenceError):
            refs.export_dashboard_references(metadata)
    assert (
        "datasourceRef" not in metadata["native_filter_configuration"][0]["targets"][0]
    )


@pytest.mark.parametrize(
    "module_name,api_name,export_name",
    [
        ("superset.charts.api", "ChartRestApi", "ExportChartsCommand"),
        ("superset.dashboards.api", "DashboardRestApi", "ExportDashboardsCommand"),
    ],
)
def test_export_api_preserves_dependency_error_under_safe(
    app_context: None,
    monkeypatch: pytest.MonkeyPatch,
    module_name: str,
    api_name: str,
    export_name: str,
) -> None:
    """Keep FAB's exception wrapper: unknown errors would otherwise become500."""
    module: ModuleType = importlib.import_module(module_name)
    api: Any = getattr(module, api_name)()

    def failed_content() -> str:
        """Model lazy archive serialization failing on a dependency."""
        raise refs.SemanticReferenceError(
            "Semantic view reference is missing or inaccessible."
        )

    exporter: Mock = Mock()
    exporter.return_value.run.return_value = iter([("chart.yaml", failed_content)])
    monkeypatch.setattr(module, export_name, exporter)
    with current_app.test_request_context():
        response: Response = safe(inspect.unwrap(api.export))(api, rison=[1])
    assert response.status_code == 422
    assert (
        response.get_json()["message"]
        == "Semantic view reference is missing or inaccessible."
    )


def test_examples_rejects_semantic_bundle_before_writes(
    app_context: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The fourth schema reader must reject rather than skip semantic data."""
    from superset.commands.importers.v1 import examples

    writer: Mock = Mock(side_effect=AssertionError("examples wrote before rejection"))
    monkeypatch.setattr(examples, "import_database", writer)
    with pytest.raises(refs.SemanticReferenceError, match="examples"):
        examples.ImportExamplesCommand._import(
            {"databases/d.yaml": {"uuid": "db"}, "charts/c.yaml": chart_config()}
        )
    writer.assert_not_called()


def test_null_target_type_preserves_legacy_table_reference() -> None:
    """Only a missing/null legacy type defaults to table, not arbitrary unknowns."""
    target: dict[str, Any] = {"datasourceType": None, "datasetUuid": VIEW_UUID}
    metadata: dict[str, Any] = {"native_filter_configuration": [{"targets": [target]}]}
    assert (
        refs.resolve_bundle_references({"dashboards/d.yaml": {"metadata": metadata}})
        == {}
    )
    refs.export_dashboard_references(metadata)
    assert target == {"datasourceType": None, "datasetUuid": VIEW_UUID}


@pytest.mark.parametrize(
    "controls", ["bad", [None], [{"targets": ["bad"]}], [{"targets": "bad"}]]
)
def test_malformed_dashboard_controls_fail_clearly(controls: Any) -> None:
    """The new preflight/export traversal must not surface shape errors as500."""
    metadata: dict[str, Any] = {"native_filter_configuration": controls}
    with pytest.raises(refs.SemanticReferenceError):
        refs.resolve_bundle_references({"dashboards/d.yaml": {"metadata": metadata}})
    with pytest.raises(refs.SemanticReferenceError):
        refs.export_dashboard_references(metadata)


@pytest.mark.parametrize("source_type", ["unknown", "", False, 0])
def test_unknown_target_type_is_not_reinterpreted_as_table(source_type: Any) -> None:
    """Reject unrecognized source identities rather than falling back on truthiness."""
    metadata: dict[str, Any] = {
        "native_filter_configuration": [
            {"targets": [{"datasourceType": source_type, "datasetId": 81}]}
        ]
    }
    with pytest.raises(refs.SemanticReferenceError):
        refs.resolve_bundle_references({"dashboards/d.yaml": {"metadata": metadata}})
    with pytest.raises(refs.SemanticReferenceError):
        refs.export_dashboard_references(metadata)


@pytest.mark.parametrize(
    "module_name,command_name,bundle_type",
    [
        ("superset.commands.chart.importers.v1", "ImportChartsCommand", "Slice"),
        (
            "superset.commands.dashboard.importers.v1",
            "ImportDashboardsCommand",
            "Dashboard",
        ),
        ("superset.commands.importers.v1.assets", "ImportAssetsCommand", "assets"),
    ],
)
def test_public_import_parses_semantic_yaml_and_commits_chart(
    persisted_view: SemanticView,
    session: Session,
    monkeypatch: pytest.MonkeyPatch,
    module_name: str,
    command_name: str,
    bundle_type: str,
) -> None:
    """Include actual metadata/config parsing and schemas, not a validate stub."""
    module: ModuleType = importlib.import_module(module_name)
    contents: dict[str, str] = {
        "metadata.yaml": yaml.safe_dump({"version": "1.0.0", "type": bundle_type}),
        "charts/c.yaml": yaml.safe_dump(chart_config()),
    }
    monkeypatch.setattr(module, "get_default_viewers_for_current_user", lambda: [])
    command: Any = getattr(module, command_name)(contents, overwrite=True)
    command.run()
    chart: Slice = session.query(Slice).filter(Slice.uuid == UUID(CHART_UUID)).one()
    assert chart.datasource_id == 81
    assert chart.datasource_type == "semantic_view"
    assert chart.table is None
    assert chart.semantic_view.uuid == UUID(VIEW_UUID)
