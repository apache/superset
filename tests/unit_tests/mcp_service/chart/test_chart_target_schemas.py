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
"""The chart-building tools take exactly one of dataset_id / view_id (sc-120959)."""

from uuid import UUID

import pytest
from pydantic import ValidationError

from superset.mcp_service.chart.schemas import (
    ColumnRef,
    GenerateChartRequest,
    GenerateExploreLinkRequest,
    UpdateChartRequest,
    XYChartConfig,
)


def _config() -> XYChartConfig:
    """Return saved semantic metric configuration."""
    return XYChartConfig(
        chart_type="xy",
        x=ColumnRef(name="metric_time"),
        y=[ColumnRef(name="revenue", saved_metric=True)],
        kind="line",
    )


@pytest.mark.parametrize(
    "request_cls", [GenerateChartRequest, GenerateExploreLinkRequest]
)
class TestChartTarget:
    def test_view_id_alone_is_accepted(
        self, request_cls: type[GenerateChartRequest] | type[GenerateExploreLinkRequest]
    ) -> None:
        request: GenerateChartRequest | GenerateExploreLinkRequest = request_cls(
            view_id=3, config=_config()
        )
        assert request.view_id == 3
        assert request.dataset_id is None

    def test_dataset_id_alone_is_accepted(
        self, request_cls: type[GenerateChartRequest] | type[GenerateExploreLinkRequest]
    ) -> None:
        request: GenerateChartRequest | GenerateExploreLinkRequest = request_cls(
            dataset_id="a-uuid", config=_config()
        )
        assert request.dataset_id == "a-uuid"
        assert request.view_id is None

    def test_both_targets_are_rejected(
        self, request_cls: type[GenerateChartRequest] | type[GenerateExploreLinkRequest]
    ) -> None:
        with pytest.raises(ValidationError, match="exactly one"):
            request_cls(dataset_id=1, view_id=1, config=_config())

    def test_no_target_is_rejected(
        self, request_cls: type[GenerateChartRequest] | type[GenerateExploreLinkRequest]
    ) -> None:
        with pytest.raises(ValidationError, match="exactly one"):
            request_cls(config=_config())


class TestUpdateChartTarget:
    def test_view_id_rebind(self) -> None:
        request: UpdateChartRequest = UpdateChartRequest(identifier=12, view_id=3)
        assert request.view_id == 3
        assert request.dataset_id is None

    def test_neither_is_fine_for_updates(self) -> None:
        request: UpdateChartRequest = UpdateChartRequest(
            identifier=12, chart_name="Renamed"
        )
        assert request.view_id is None
        assert request.dataset_id is None

    def test_both_are_rejected(self) -> None:
        with pytest.raises(ValidationError, match="at most one"):
            UpdateChartRequest(identifier=12, dataset_id=1, view_id=1)


@pytest.mark.parametrize("invalid", [True, False, 0, -1, "", "not-a-uuid", 1.5])
def test_view_selector_rejects_invalid_identity(invalid: object) -> None:
    """Do not coerce booleans or malformed selectors into view IDs."""
    with pytest.raises(ValidationError):
        GenerateExploreLinkRequest.model_validate({"view_id": invalid})


def test_view_selector_accepts_uuid() -> None:
    """Accept a UUID without losing the selected source family."""
    identity: UUID = UUID("60bbdebe-f30c-4699-88dc-cbe7355fb4c1")
    request: GenerateExploreLinkRequest = GenerateExploreLinkRequest(view_id=identity)
    assert request.view_id == identity
    assert request.dataset_id is None
    assert request.model_dump(mode="json")["view_id"] == str(identity)


@pytest.mark.parametrize(
    "request_cls",
    [GenerateChartRequest, GenerateExploreLinkRequest, UpdateChartRequest],
)
@pytest.mark.parametrize("source_type", ["table", "semantic_view"])
def test_legacy_alias_keeps_explicit_family(
    request_cls: type[GenerateChartRequest]
    | type[GenerateExploreLinkRequest]
    | type[UpdateChartRequest],
    source_type: str,
) -> None:
    """Colliding legacy IDs select the supplied family rather than a table."""
    request: GenerateChartRequest | GenerateExploreLinkRequest | UpdateChartRequest = (
        request_cls.model_validate(
            {
                "identifier": 12,
                "datasource_id": 7,
                "datasource_type": source_type,
                "config": _config(),
            }
        )
    )
    assert request.view_id == (7 if source_type == "semantic_view" else None)
    assert request.dataset_id == (7 if source_type == "table" else None)


@pytest.mark.parametrize(
    "request_cls",
    [GenerateChartRequest, GenerateExploreLinkRequest, UpdateChartRequest],
)
@pytest.mark.parametrize("explicit_table_type", [False, True])
def test_explicit_dataset_wins_over_legacy_table_alias(
    request_cls: type[GenerateChartRequest]
    | type[GenerateExploreLinkRequest]
    | type[UpdateChartRequest],
    explicit_table_type: bool,
) -> None:
    """Preserve table precedence without changing the caller's target fields."""
    data: dict[str, object] = {
        "identifier": 12,
        "dataset_id": 7,
        "datasource_id": 23,
        "config": _config(),
    }
    if explicit_table_type:
        data["datasource_type"] = "table"
    request: GenerateChartRequest | GenerateExploreLinkRequest | UpdateChartRequest = (
        request_cls.model_validate(data)
    )
    assert request.dataset_id == 7
    assert request.view_id is None
    assert data["dataset_id"] == 7
    assert data["datasource_id"] == 23


@pytest.mark.parametrize("source_type", ["query", "saved_query", "unknown", None])
def test_legacy_alias_rejects_unsupported_family(source_type: str | None) -> None:
    """Unsupported explicit families cannot be silently reinterpreted as tables."""
    with pytest.raises(ValidationError, match="datasource_type"):
        GenerateExploreLinkRequest.model_validate(
            {"datasource_id": 7, "datasource_type": source_type}
        )


@pytest.mark.parametrize("selectors", [{"dataset_id": 7}, {"view_id": 8}])
def test_legacy_alias_rejects_conflicting_selectors(selectors: dict[str, int]) -> None:
    """Do not silently choose one of contradictory explicit identities."""
    with pytest.raises(ValidationError):
        GenerateExploreLinkRequest.model_validate(
            {"datasource_id": 7, "datasource_type": "semantic_view", **selectors}
        )


@pytest.mark.parametrize(
    "request_cls",
    [GenerateChartRequest, GenerateExploreLinkRequest, UpdateChartRequest],
)
@pytest.mark.parametrize("target_key", ["dataset_id", "view_id"])
@pytest.mark.parametrize("source_type", ["table", "semantic_view", "query", None])
def test_explicit_target_checks_supplied_family(
    request_cls: type[GenerateChartRequest]
    | type[GenerateExploreLinkRequest]
    | type[UpdateChartRequest],
    target_key: str,
    source_type: str | None,
) -> None:
    """An explicit selector must agree with supplied legacy type vocabulary."""
    data: dict[str, object] = {
        "identifier": 12,
        target_key: 7,
        "datasource_type": source_type,
        "config": _config(),
    }
    expected_type: str = "table" if target_key == "dataset_id" else "semantic_view"
    if source_type != expected_type:
        with pytest.raises(ValidationError, match="datasource_type"):
            request_cls.model_validate(data)
    else:
        request: (
            GenerateChartRequest | GenerateExploreLinkRequest | UpdateChartRequest
        ) = request_cls.model_validate(data)
        assert getattr(request, target_key) == 7
