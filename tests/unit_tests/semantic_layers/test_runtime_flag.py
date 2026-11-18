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

"""Runtime availability applies before datasource lookup or provider access."""

from __future__ import annotations

from typing import Any
from unittest.mock import MagicMock, patch

import pytest
from flask.testing import FlaskClient
from werkzeug.test import TestResponse

from superset.daos.datasource import DatasourceDAO
from superset.explore.utils import check_semantic_view_access
from superset.semantic_layers.access import SemanticLayersDisabledError


@pytest.mark.parametrize("identifier", [17, "00000000-0000-0000-0000-000000000001"])
def test_disabled_semantic_datasource_never_queries_metadata(
    identifier: int | str,
) -> None:
    """Both public UUIDs and internal IDs pass through the same refusal."""
    query: MagicMock
    with (
        patch("superset.feature_flag_manager.is_feature_enabled", return_value=False),
        patch("superset.daos.datasource.db.session.query") as query,
        pytest.raises(SemanticLayersDisabledError),
    ):
        DatasourceDAO.get_datasource("semantic_view", identifier)
    query.assert_not_called()


@pytest.mark.parametrize("kind,enabled", [("semantic_view", True), ("table", False)])
def test_available_datasource_resolves(kind: str, enabled: bool) -> None:
    """Enabled semantic views and disabled-flag ordinary tables still resolve."""
    query: MagicMock
    expected: MagicMock = MagicMock()
    with (
        patch("superset.feature_flag_manager.is_feature_enabled", return_value=enabled),
        patch("superset.daos.datasource.db.session.query") as query,
    ):
        query.return_value.filter.return_value.one_or_none.return_value = expected
        assert DatasourceDAO.get_datasource(kind, 17) is expected


def test_explore_direct_semantic_lookup_is_refused() -> None:
    """The direct Explore access helper cannot bypass datasource resolution."""
    find: MagicMock
    with (
        patch("superset.feature_flag_manager.is_feature_enabled", return_value=False),
        patch("superset.explore.utils.SemanticViewDAO.find_by_id") as find,
        pytest.raises(SemanticLayersDisabledError),
    ):
        check_semantic_view_access(17)
    find.assert_not_called()


def test_dashboard_omits_disabled_semantic_metadata() -> None:
    """Both dashboard serializers omit semantic entries before discovery."""
    metadata: MagicMock
    serialize: MagicMock
    from superset.mcp_service.dashboard.schemas import (
        dashboard_datasets_serializer,
        DashboardDatasets,
    )
    from superset.models.dashboard import Dashboard
    from superset.models.slice import Slice
    from superset.semantic_layers.models import SemanticView

    view: SemanticView = SemanticView(id=17, name="private metadata")
    chart: Slice = Slice(
        id=4, datasource_id=17, datasource_type="semantic_view", semantic_view=view
    )
    dashboard: Dashboard = Dashboard(id=3, dashboard_title="test", slices=[chart])
    with (
        patch("superset.feature_flag_manager.is_feature_enabled", return_value=False),
        patch.object(SemanticView, "data_for_slices") as metadata,
        patch(
            "superset.mcp_service.dashboard.schemas._serialize_dashboard_dataset"
        ) as serialize,
    ):
        assert dashboard.datasets_trimmed_for_slices() == []
        result: DashboardDatasets = dashboard_datasets_serializer(dashboard)
        assert result.datasets == []
        assert result.inaccessible_dataset_count == 0
    metadata.assert_not_called()
    serialize.assert_not_called()


def test_chart_metadata_marks_disabled_semantic_source_unavailable() -> None:
    """Chart listings keep stored metadata while clearly marking unavailable data."""
    from superset.mcp_service.chart.schemas import ChartInfo, serialize_chart_object
    from superset.models.slice import Slice

    chart: Slice = Slice(
        id=4,
        slice_name="semantic",
        datasource_id=17,
        datasource_type="semantic_view",
        params="{}",
    )
    with patch("superset.feature_flag_manager.is_feature_enabled", return_value=False):
        result: ChartInfo | None = serialize_chart_object(chart)
    assert result is not None
    assert result.id == 4
    assert result.unavailable_reason == "Semantic layers are not enabled."
    assert (
        result.model_dump(context={"select_columns": ["id"]})["unavailable_reason"]
        == "Semantic layers are not enabled."
    )


def test_saving_semantic_chart_is_validation_error_when_disabled() -> None:
    """Chart commands turn feature refusal into their existing 422 envelope."""
    from marshmallow import ValidationError

    from superset.commands.chart.utils import validate_chart_datasource_type

    with patch("superset.feature_flag_manager.is_feature_enabled", return_value=False):
        with pytest.raises(ValidationError, match="Semantic layers are not enabled"):
            validate_chart_datasource_type("semantic_view")
        validate_chart_datasource_type("table")
    with patch("superset.feature_flag_manager.is_feature_enabled", return_value=True):
        validate_chart_datasource_type("semantic_view")


@pytest.mark.parametrize(
    "path", ["/api/v1/semantic_layer/types", "/api/v1/semantic_view/17/structure"]
)
def test_registered_semantic_api_refuses_before_dispatch(
    client: FlaskClient[Any], path: str
) -> None:
    """The off-at-boot application still owns both guarded blueprints."""
    assert "SemanticLayerRestApi" in client.application.blueprints
    assert "SemanticViewRestApi" in client.application.blueprints
    with patch("superset.feature_flag_manager.is_feature_enabled", return_value=False):
        response: TestResponse = client.get(path)
    assert response.status_code == 404
    assert response.json == {"message": "Not found"}


@pytest.mark.parametrize("serializer", ["model", "mcp"])
def test_dashboard_serialization_reads_feature_once(serializer: str) -> None:
    """All semantic slices in one dashboard serialization share a decision."""
    from superset.mcp_service.dashboard.schemas import dashboard_datasets_serializer
    from superset.models.dashboard import Dashboard
    from superset.models.slice import Slice

    dashboard: Dashboard = Dashboard(
        id=3,
        dashboard_title="mixed",
        slices=[
            Slice(id=i, datasource_id=i, datasource_type="semantic_view")
            for i in (17, 18)
        ],
    )
    decision: MagicMock
    with patch(
        "superset.feature_flag_manager.is_feature_enabled", return_value=False
    ) as decision:
        if serializer == "model":
            assert dashboard.datasets_trimmed_for_slices() == []
        else:
            assert dashboard_datasets_serializer(dashboard).datasets == []
    decision.assert_called_once_with("SEMANTIC_LAYERS")


def test_available_chart_payload_omits_unavailability_marker() -> None:
    """An optional availability marker must not change every chart's JSON shape."""
    from superset.mcp_service.chart.schemas import ChartInfo

    chart: ChartInfo = ChartInfo(id=17)
    payload: dict[str, Any] = chart.model_dump(mode="json")
    assert "unavailable_reason" not in payload
    assert "slice_name" in payload


@pytest.mark.parametrize("enabled", [False, True])
@pytest.mark.parametrize("kind", ["semantic_view", "table"])
@pytest.mark.parametrize("dashboard_image", [False, True])
def test_image_availability_matches_chart_sources(
    enabled: bool,
    kind: str,
    dashboard_image: bool,
) -> None:
    """Image policy covers individual charts and entire dashboard images."""
    from superset.models.dashboard import Dashboard
    from superset.models.slice import Slice
    from superset.semantic_layers.access import is_semantic_image_unavailable

    chart: Slice = Slice(id=17, datasource_type=kind, datasource_id=17)
    resource: Slice | Dashboard = (
        Dashboard(id=17, slices=[chart]) if dashboard_image else chart
    )
    with patch(
        "superset.feature_flag_manager.is_feature_enabled", return_value=enabled
    ):
        assert is_semantic_image_unavailable(resource) is (
            not enabled and kind == "semantic_view"
        )
