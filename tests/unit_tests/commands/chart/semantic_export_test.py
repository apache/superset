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

from superset.charts.schemas import ImportV1ChartSchema
from superset.commands.chart.export import ExportChartsCommand
from superset.connectors.sqla.models import SqlaTable
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
