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
"""Chart export must produce a document its import schema accepts."""

from unittest.mock import Mock
from uuid import uuid4

import pytest
import yaml
from marshmallow import ValidationError

from superset.charts.schemas import ImportV1ChartSchema
from superset.commands.chart.export import ExportChartsCommand
from superset.connectors.sqla.models import SqlaTable
from superset.daos.chart import ChartDAO
from superset.models.slice import Slice
from superset.semantic_layers.models import SemanticLayer, SemanticView
from superset.semantic_layers.registry import registry


@pytest.mark.parametrize("source_type", ["table", "semantic_view"])
def test_exported_chart_preserves_datasource_for_import_schema(
    app_context: None, source_type: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Use real transient models and the real exporter/schema, without a warehouse."""
    table: SqlaTable = SqlaTable(id=7, table_name="physical", uuid=uuid4())
    view: SemanticView = SemanticView(
        id=7,
        name="semantic",
        uuid=uuid4(),
        semantic_layer=SemanticLayer(type="test-provider"),
    )
    monkeypatch.setattr(
        "superset.extensions.feature_flag_manager.is_feature_enabled",
        lambda flag: flag == "SEMANTIC_LAYERS",
    )
    monkeypatch.setattr(SemanticView, "raise_for_access", Mock())
    monkeypatch.setitem(registry, "test-provider", Mock())
    chart: Slice = Slice(
        id=11,
        uuid=uuid4(),
        slice_name="Roundtrip source",
        viz_type="table",
        datasource_type=source_type,
        datasource_id=7,
        params='{"datasource":"7__' + source_type + '"}',
        table=table if source_type == "table" else None,
        semantic_view=view if source_type == "semantic_view" else None,
    )

    content: str = ExportChartsCommand._file_content(chart)
    ImportV1ChartSchema().load(yaml.safe_load(content))
    # Distinct UUIDs despite equal numeric IDs: exporting a semantic source
    # must neither lose its identity nor substitute the same-id table's UUID.
    if source_type == "semantic_view":
        assert str(view.uuid) in content
        assert str(table.uuid) not in content
    else:
        assert yaml.safe_load(content)["dataset_uuid"] == str(table.uuid)


@pytest.mark.parametrize("semantic_enabled", [True, False])
def test_orphaned_semantic_chart_does_not_abort_mixed_export(
    app_context: None,
    monkeypatch: pytest.MonkeyPatch,
    semantic_enabled: bool,
) -> None:
    """A missing view must not prevent unrelated charts from being archived."""
    table: SqlaTable = SqlaTable(id=7, table_name="physical", uuid=uuid4())
    plain: Slice = Slice(
        id=10,
        uuid=uuid4(),
        slice_name="plain",
        viz_type="table",
        datasource_type="table",
        datasource_id=7,
        table=table,
        params="{}",
    )
    orphan: Slice = Slice(
        id=11,
        uuid=uuid4(),
        slice_name="orphan",
        viz_type="table",
        datasource_type="semantic_view",
        datasource_id=81,
        semantic_view=None,
        params='{"datasource":"81__semantic_view"}',
    )
    monkeypatch.setattr(ChartDAO, "find_by_ids", Mock(return_value=[plain, orphan]))
    monkeypatch.setattr(
        "superset.extensions.feature_flag_manager.is_feature_enabled",
        lambda flag: semantic_enabled and flag == "SEMANTIC_LAYERS",
    )

    contents: dict[str, str] = {
        name: content()
        for name, content in ExportChartsCommand(
            [plain.id, orphan.id], export_related=False
        ).run()
    }

    assert "metadata.yaml" in contents
    assert yaml.safe_load(contents["charts/plain_10.yaml"])["dataset_uuid"] == str(
        table.uuid
    )
    orphan_content: dict[str, object] = yaml.safe_load(
        contents["charts/orphan_11.yaml"]
    )
    assert "datasource_ref" not in orphan_content
    assert "dataset_uuid" not in orphan_content
    with pytest.raises(ValidationError):
        ImportV1ChartSchema().load(orphan_content)
