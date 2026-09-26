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

"""Column-error guidance uses only bounded, authorized dataset metadata."""

from contextlib import nullcontext
from unittest.mock import AsyncMock, Mock, patch

import pytest

from superset.mcp_service.chart.schemas import GenerateChartRequest
from superset.mcp_service.chart.tool.generate_chart import generate_chart


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("column", "names", "allowed", "expected_type", "guidance"),
    [
        (
            "no_such_col",
            ["month", "category", "revenue"],
            True,
            "column_not_found",
            "No matching columns found",
        ),
        (
            "revnue",
            ["month", "category", "revenue"],
            True,
            "column_not_found",
            "Did you mean: revenue?",
        ),
        (
            "no_such_col",
            [],
            True,
            "multiple_invalid_columns",
            "No matching columns found",
        ),
        (
            "no_such_col",
            ["month", "category", "revenue"],
            False,
            "dataset_not_found",
            None,
        ),
        (
            "gross_margi",
            ["month", "category", "revenue"],
            True,
            "column_not_found",
            "No matching columns found",
        ),
    ],
)
async def test_generate_chart_column_guidance(
    column: str,
    names: list[str],
    allowed: bool,
    expected_type: str,
    guidance: str | None,
) -> None:
    """Exercise the reported unsaved bar request through the real pipeline."""
    dataset = Mock(
        id=268,
        table_name="sales_fixture",
        schema=None,
        database=Mock(database_name="fixture", db_engine_spec=None),
        columns=[
            Mock(
                column_name=name,
                type="VARCHAR",
                is_temporal=False,
                is_numeric=name == "revenue",
            )
            for name in names
        ],
        metrics=[
            Mock(
                metric_name="gross_margin",
                expression="SUM(revenue)",
                description="not a physical column",
            )
        ],
    )
    request = GenerateChartRequest.model_validate(
        {
            "dataset_id": 268,
            "save_chart": False,
            "config": {
                "chart_type": "xy",
                "kind": "bar",
                "x": {"name": column},
                "y": [{"name": "revenue", "aggregate": "SUM"}],
            },
        }
    )
    ctx = Mock(
        info=AsyncMock(),
        debug=AsyncMock(),
        warning=AsyncMock(),
        error=AsyncMock(),
        report_progress=AsyncMock(),
    )
    with (
        patch(
            "superset.mcp_service.chart.tool.generate_chart.event_logger.log_context",
            side_effect=lambda **kwargs: nullcontext(),
        ),
        patch(
            "superset.mcp_service.auth.get_user_from_request",
            return_value=Mock(id=1, username="fixture_user", roles=[], groups=[]),
        ),
        patch("superset.daos.dataset.DatasetDAO.find_by_id", return_value=dataset),
        patch(
            "superset.mcp_service.auth.security_manager.can_access_datasource",
            return_value=allowed,
        ) as access,
    ):
        result = await generate_chart(request, ctx=ctx)

    assert result.success is False
    assert result.error is not None
    error = result.error
    assert error.error_type == expected_type
    suggestions = " ".join(error.suggestions)
    assert column not in suggestions
    assert "Check available columns?" not in suggestions
    assert "gross_margin" not in suggestions
    if guidance:
        assert suggestions.count("Use get_dataset_info to see available columns") == 1
        assert guidance in suggestions
        assert error.dataset_context is not None
        assert error.dataset_context.available_columns == [
            {"name": name} for name in names
        ]
        assert error.dataset_context.available_metrics == []
    else:
        assert error.dataset_context is None
        for name in names:
            assert name not in error.model_dump_json()
    access.assert_called_with(datasource=dataset)


@pytest.mark.parametrize(
    "missing", [["private_input"], ["private_input", "other_input"]]
)
def test_column_context_is_bounded_and_sanitized(missing: list[str]) -> None:
    """Neither raw references nor unrestricted metadata become suggestions."""
    from superset.mcp_service.chart.schemas import ColumnRef
    from superset.mcp_service.chart.validation.dataset_validator import DatasetValidator
    from superset.mcp_service.common.error_schemas import DatasetContext

    names = ["<fixture>", "x" * 1000] + [f"column_{i}" for i in range(20)]
    context = DatasetContext(
        id=268,
        table_name="fixture",
        database_name="fixture",
        available_columns=[
            {"name": name, "expression": "PRIVATE SQL"} for name in names
        ],
        available_metrics=[{"name": "metric", "expression": "PRIVATE SQL"}],
    )
    error = DatasetValidator._validate_columns_exist(
        [ColumnRef(name=name) for name in missing], context
    )
    assert error is not None
    assert error.dataset_context is not None
    columns = error.dataset_context.available_columns
    assert len(columns) == 10
    assert columns[0] == {"name": "&lt;fixture&gt;"}
    assert len(columns[1]["name"]) < 220
    assert "PRIVATE SQL" not in error.model_dump_json()
    assert len(error.suggestions) <= 10
    for name in missing:
        assert name not in " ".join(error.suggestions)


def test_column_candidates_are_bounded_and_sanitized() -> None:
    """Candidate guidance retains escaping and the three-candidate cap."""
    from superset.mcp_service.utils.error_builder import ChartErrorBuilder

    error = ChartErrorBuilder.column_not_found_error(
        "private_input", ["<fixture>", "revenue", "category", "excluded"]
    )
    assert error.error_type == "column_not_found"
    assert error.error_code == "CHART_COLUMN_NOT_FOUND"
    assert error.suggestions[-1] == "Did you mean: &lt;fixture&gt;, revenue, category?"
    assert "private_input" not in " ".join(error.suggestions)


@pytest.mark.parametrize("names", [[], ["revenue", "category"]])
def test_multiple_column_guidance_uses_real_candidates(names: list[str]) -> None:
    """Multiple errors share the same real-candidate/no-match behavior."""
    from superset.mcp_service.chart.schemas import ColumnRef
    from superset.mcp_service.chart.validation.dataset_validator import DatasetValidator
    from superset.mcp_service.common.error_schemas import DatasetContext

    context = DatasetContext(
        id=268,
        table_name="fixture",
        database_name="fixture",
        available_columns=[{"name": name} for name in names],
    )
    error = DatasetValidator._validate_columns_exist(
        [ColumnRef(name="revnue"), ColumnRef(name="categry")], context
    )
    assert error is not None
    assert error.error_type == "multiple_invalid_columns"
    assert error.error_code == "MULTIPLE_INVALID_COLUMNS"
    assert error.message == "Multiple columns not found in dataset"
    assert error.details == "Invalid columns: revnue, categry"
    if names:
        assert error.suggestions[-1] == "Did you mean: revenue, category?"
    else:
        assert error.suggestions[-1].startswith("No matching columns found.")
    assert "revnue" not in " ".join(error.suggestions)
    assert "categry" not in " ".join(error.suggestions)


def test_multiple_column_details_preserve_bounded_escaped_names() -> None:
    """Invalid names belong in bounded details, not candidate guidance."""
    from superset.mcp_service.chart.schemas import ColumnRef
    from superset.mcp_service.chart.validation.dataset_validator import DatasetValidator
    from superset.mcp_service.common.error_schemas import DatasetContext

    context = DatasetContext(id=268, table_name="fixture", database_name="fixture")
    error = DatasetValidator._build_column_error(
        [ColumnRef.model_construct(name="<missing>"), ColumnRef(name="x" * 250)],
        {},
        context,
    )

    assert error.details == "Invalid columns: &lt;missing&gt;, " + "x" * 189 + (
        "...[truncated]"
    )
