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
from typing import Any
from unittest.mock import AsyncMock, Mock, patch

import pytest

from superset.mcp_service.chart.schemas import (
    ColumnRef,
    GenerateChartRequest,
    TableChartConfig,
)
from superset.mcp_service.chart.tool.generate_chart import generate_chart
from superset.mcp_service.chart.validation.dataset_validator import (
    DatasetValidator,
)
from superset.mcp_service.common.error_schemas import DatasetContext
from superset.mcp_service.utils.error_builder import (
    ChartErrorBuilder,
    MAX_ERROR_SUGGESTIONS,
)

GET_DATASET_INFO = "Use get_dataset_info to see available columns"


def _orm_dataset(names: list[str]) -> Mock:
    """Mock an ORM dataset with physical columns and a saved metric."""
    return Mock(
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


def _bar_request(column: str) -> GenerateChartRequest:
    """Build an unsaved bar-chart request for the given x-axis column."""
    return GenerateChartRequest.model_validate(
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


def _ctx() -> Mock:
    """Mock the MCP context with asynchronous logging and progress methods."""
    return Mock(
        info=AsyncMock(),
        debug=AsyncMock(),
        warning=AsyncMock(),
        error=AsyncMock(),
        report_progress=AsyncMock(),
    )


async def _run_generate_chart(
    column: str, names: list[str], access: dict[str, Any]
) -> tuple[Any, Mock, Mock]:
    """Drive the reported unsaved bar request through the real pipeline.

    Patching ``find_by_id`` to return the dataset regardless of the acting user
    simulates a dataset the DAO's ``DatasourceFilter`` admits while the security
    manager's access check denies it — the only case where the tool-level check
    changes the outcome.
    """
    dataset = _orm_dataset(names)
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
            **access,
        ) as checked,
    ):
        result = await generate_chart(_bar_request(column), ctx=_ctx())
    return result, checked, dataset


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("column", "names", "expected_type", "guidance", "ranked_names"),
    [
        (
            "no_such_col",
            ["month", "category", "revenue"],
            "column_not_found",
            "No matching columns found",
            ["month", "category", "revenue"],
        ),
        (
            "categry",
            ["month", "category", "revenue"],
            "column_not_found",
            "Did you mean: category?",
            ["category", "month", "revenue"],
        ),
        (
            "revnue",
            ["month", "category", "revenue"],
            "column_not_found",
            "Did you mean: revenue?",
            ["revenue", "month", "category"],
        ),
        # An empty schema also invalidates the ``y`` reference, so two distinct
        # columns are missing and the plural error is the correct outcome.
        (
            "no_such_col",
            [],
            "multiple_invalid_columns",
            "No matching columns found",
            [],
        ),
        (
            "gross_margi",
            ["month", "category", "revenue"],
            "column_not_found",
            "No matching columns found",
            ["month", "category", "revenue"],
        ),
    ],
)
async def test_generate_chart_column_guidance(
    column: str,
    names: list[str],
    expected_type: str,
    guidance: str,
    ranked_names: list[str],
) -> None:
    """Guidance names real candidates and never echoes the caller's input."""
    result, checked, dataset = await _run_generate_chart(
        column, names, {"return_value": True}
    )

    assert result.success is False
    assert result.error is not None
    error = result.error
    assert error.error_type == expected_type
    suggestions = " ".join(error.suggestions)
    assert column not in suggestions
    assert "Check available columns?" not in suggestions
    # ``gross_margin`` is a saved metric: never a candidate for a dimension.
    assert "gross_margin" not in suggestions
    assert suggestions.count(GET_DATASET_INFO) == 1
    assert guidance in suggestions
    if guidance == "No matching columns found":
        assert "Did you mean:" not in suggestions
    assert error.dataset_context is not None
    assert error.dataset_context.available_columns == [
        {"name": name} for name in ranked_names
    ]
    # The dataset's saved metrics are listed, so the caller can tell an empty
    # metric list from a dataset that simply wasn't asked about.
    assert error.dataset_context.available_metrics == [{"name": "gross_margin"}]
    checked.assert_called_with(datasource=dataset)


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "access",
    [
        pytest.param({"return_value": False}, id="denied"),
        pytest.param({"side_effect": RuntimeError("boom")}, id="raises"),
    ],
)
async def test_generate_chart_withholds_metadata_without_access(
    access: dict[str, Any],
) -> None:
    """A denied or failing access check withholds all dataset metadata."""
    names = ["month", "category", "revenue"]
    result, checked, dataset = await _run_generate_chart("no_such_col", names, access)

    assert result.success is False
    assert result.error is not None
    assert result.error.error_type == "dataset_not_found"
    assert getattr(result.error, "dataset_context", None) is None
    payload = result.error.model_dump_json()
    for name in [*names, "sales_fixture", "gross_margin"]:
        assert name not in payload
    checked.assert_called_with(datasource=dataset)


def test_column_context_is_bounded_and_names_only() -> None:
    """Context carries verbatim names, bounded by count, without expressions."""
    names = ["Customer's Name", "Sales & Marketing", "y" * 255] + [
        f"column_{i}" for i in range(20)
    ]
    context = DatasetContext(
        id=268,
        table_name="Sales & Marketing",
        database_name="fixture",
        available_columns=[
            {"name": name, "expression": "PRIVATE SQL"} for name in names
        ],
        available_metrics=[
            {"name": f"metric_{i}", "expression": "PRIVATE SQL"} for i in range(25)
        ],
    )
    error = DatasetValidator._validate_columns_exist(
        [ColumnRef(name="private_input")], context
    )
    assert error is not None
    assert error.dataset_context is not None
    columns = error.dataset_context.available_columns
    assert len(columns) == MAX_ERROR_SUGGESTIONS == 10
    # Verbatim per the Tool Result Value Contract: no escaping, no truncation.
    assert columns[0] == {"name": "Customer's Name"}
    assert columns[1] == {"name": "Sales & Marketing"}
    assert columns[2] == {"name": "y" * 255}
    assert error.dataset_context.table_name == "Sales & Marketing"
    assert error.dataset_context.available_metrics == [
        {"name": f"metric_{i}"} for i in range(MAX_ERROR_SUGGESTIONS)
    ]
    assert "PRIVATE SQL" not in error.model_dump_json()
    assert len(error.suggestions) <= MAX_ERROR_SUGGESTIONS
    assert "private_input" not in " ".join(error.suggestions)


def test_truncated_context_says_how_many_columns_exist() -> None:
    """A partial column list tells the caller it was cut off."""
    context = DatasetContext(
        id=268,
        table_name="fixture",
        database_name="fixture",
        available_columns=[{"name": f"column_{i}"} for i in range(25)],
    )
    error = DatasetValidator._validate_columns_exist(
        [ColumnRef(name="no_such_col")], context
    )
    assert error is not None
    assert (
        f"Showing {MAX_ERROR_SUGGESTIONS} of 25 columns; "
        "call get_dataset_info for the full list" in error.suggestions
    )


def test_hinted_saved_metric_is_never_cut_from_the_context() -> None:
    """The metric named by the hint leads ``available_metrics`` and cuts say so."""
    context = DatasetContext(
        id=268,
        table_name="fixture",
        database_name="fixture",
        available_columns=[{"name": "num"}],
        available_metrics=[{"name": f"metric_{i:02d}"} for i in range(25)]
        + [{"name": "sum_boys"}],
    )
    error = DatasetValidator._validate_columns_exist(
        [ColumnRef(name="sum_boy", aggregate="SUM")],
        context,
        metric_refs=[ColumnRef(name="sum_boy", aggregate="SUM")],
    )
    assert error is not None
    assert error.dataset_context is not None
    metric_names = [m["name"] for m in error.dataset_context.available_metrics]
    assert "sum_boys" in metric_names
    assert len(metric_names) == MAX_ERROR_SUGGESTIONS
    assert any(
        s.startswith(f"Showing {MAX_ERROR_SUGGESTIONS} of 26 saved metrics")
        for s in error.suggestions
    )


def test_suggested_column_is_never_cut_from_the_context() -> None:
    """Fuzzy candidates lead the bounded context, ahead of schema order."""
    context = DatasetContext(
        id=268,
        table_name="fixture",
        database_name="fixture",
        available_columns=[{"name": f"col_{i:02d}"} for i in range(10)]
        + [{"name": "customer_region"}],
    )
    error = DatasetValidator._validate_columns_exist(
        [ColumnRef(name="customer_regin")], context
    )
    assert error is not None
    assert "Did you mean: customer_region?" in error.suggestions
    assert error.dataset_context is not None
    assert error.dataset_context.available_columns[0] == {"name": "customer_region"}


def test_each_candidate_gets_its_own_length_budget() -> None:
    """Each dataset-owned candidate has an independent length bound.

    A shared 200-character budget cut the third name mid-word and dropped the
    closing ``?``; dataset-owned names must not be altered by the caller-input filter.
    """
    long_names = [f"{letter * 63}{i}" for i, letter in enumerate("abc")]
    error = ChartErrorBuilder.column_not_found_error("private_input", long_names)
    line = next(s for s in error.suggestions if s.startswith("Did you mean:"))
    assert line == f"Did you mean: {', '.join(long_names)}?"

    filtered = ChartErrorBuilder.column_not_found_error(
        "private_input", ["data:revenue", "revenue", "category"]
    )
    line = next(s for s in filtered.suggestions if s.startswith("Did you mean:"))
    assert line == "Did you mean: data:revenue, revenue, category?"
    assert "private_input" not in " ".join(filtered.suggestions)


def test_column_candidates_are_verbatim_and_capped() -> None:
    """Candidate guidance preserves dataset spelling and the three-candidate cap."""
    error = ChartErrorBuilder.column_not_found_error(
        "private_input", ["<fixture>", "revenue", "category", "excluded"]
    )
    assert error.error_type == "column_not_found"
    assert error.error_code == "CHART_COLUMN_NOT_FOUND"
    assert "Did you mean: <fixture>, revenue, category?" in error.suggestions
    assert "excluded" not in " ".join(error.suggestions)
    assert "private_input" not in " ".join(error.suggestions)


@pytest.mark.parametrize("names", [[], ["revenue", "category"]])
def test_multiple_column_guidance_uses_real_candidates(names: list[str]) -> None:
    """Multiple errors share the same real-candidate/no-match behavior."""
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
        assert "Did you mean: revenue, category?" in error.suggestions
    else:
        assert "No matching columns found." in error.suggestions
    assert "revnue" not in " ".join(error.suggestions)
    assert "categry" not in " ".join(error.suggestions)


def test_shared_candidate_cap_is_filled_round_robin() -> None:
    """One missing column with many matches can't take every candidate slot."""
    context = DatasetContext(
        id=268,
        table_name="fixture",
        database_name="fixture",
        available_columns=[
            {"name": name}
            for name in ["revenue", "revenue_usd", "revenue_eur", "category"]
        ],
    )
    error = DatasetValidator._validate_columns_exist(
        [ColumnRef(name="revnue"), ColumnRef(name="categry")], context
    )
    assert error is not None
    line = next(s for s in error.suggestions if s.startswith("Did you mean:"))
    # ``revnue`` alone matches three columns; ``category`` must still appear.
    assert line == "Did you mean: revenue, category, revenue_usd?"


def test_one_column_referenced_twice_is_not_a_multiple_error() -> None:
    """The plural branch counts distinct names, not refs."""
    context = DatasetContext(
        id=268,
        table_name="fixture",
        database_name="fixture",
        available_columns=[{"name": "region"}],
    )
    error = DatasetValidator._validate_columns_exist(
        [ColumnRef(name="regon"), ColumnRef(name="regon")], context
    )
    assert error is not None
    assert error.error_type == "column_not_found"
    assert error.error_code == "CHART_COLUMN_NOT_FOUND"
    assert error.message == "Column 'regon' not found in dataset"
    assert "Did you mean: region?" in error.suggestions


def test_multiple_column_details_preserve_bounded_escaped_names() -> None:
    """Invalid names belong in bounded details, not candidate guidance."""
    context = DatasetContext(id=268, table_name="fixture", database_name="fixture")
    error = DatasetValidator._build_column_error(
        [ColumnRef.model_construct(name="<missing>"), ColumnRef(name="x" * 250)],
        {},
        context,
    )

    assert error.details.startswith("Invalid columns: &lt;missing&gt;, x")
    assert error.details.endswith("...[truncated]")
    assert "<missing>" not in error.details


def test_aggregate_near_miss_points_at_the_saved_metric() -> None:
    """A metric-slot typo must not dead-end on 'No matching columns found.'"""
    context = DatasetContext(
        id=3,
        table_name="birth_names",
        database_name="examples",
        available_columns=[{"name": name} for name in ["ds", "gender", "name", "num"]],
        available_metrics=[{"name": "sum_boys"}, {"name": "sum_girls"}],
    )
    error = DatasetValidator._validate_columns_exist(
        [ColumnRef(name="num_boys", aggregate="SUM")],
        context,
        metric_refs=[ColumnRef(name="num_boys", aggregate="SUM")],
    )
    assert error is not None
    assert error.error_type == "column_not_found"
    hint = next(
        s for s in error.suggestions if s.startswith("Did you mean the saved metric")
    )
    assert "'sum_boys'" in hint
    assert '"saved_metric": true' in hint
    # Never steer the caller back to the broken SUM(metric) shape.
    assert "num_boys" not in " ".join(error.suggestions)
    assert error.dataset_context is not None
    assert error.dataset_context.available_metrics == [
        {"name": "sum_boys"},
        {"name": "sum_girls"},
    ]


def test_dimension_near_miss_never_points_at_a_saved_metric() -> None:
    """Without an aggregate the slot needs a physical column, so no hint."""
    context = DatasetContext(
        id=3,
        table_name="birth_names",
        database_name="examples",
        available_columns=[{"name": "ds"}],
        available_metrics=[{"name": "sum_boys"}],
    )
    error = DatasetValidator._validate_columns_exist(
        [ColumnRef(name="num_boys")], context
    )
    assert error is not None
    suggestions = " ".join(error.suggestions)
    assert "sum_boys" not in suggestions
    assert "No matching columns found." in error.suggestions


def test_physical_column_candidate_wins_over_a_metric_hint() -> None:
    """A real column match is the more direct fix, so the hint stays out."""
    context = DatasetContext(
        id=3,
        table_name="birth_names",
        database_name="examples",
        available_columns=[{"name": "num_boys_total"}],
        available_metrics=[{"name": "num_boys_sum"}],
    )
    error = DatasetValidator._validate_columns_exist(
        [ColumnRef(name="num_boys_totl", aggregate="SUM")],
        context,
        metric_refs=[ColumnRef(name="num_boys_totl", aggregate="SUM")],
    )
    assert error is not None
    assert "Did you mean: num_boys_total?" in error.suggestions
    assert all(
        not s.startswith("Did you mean the saved metric") for s in error.suggestions
    )


@pytest.mark.parametrize(
    ("include_metrics", "expected"),
    [(False, []), (True, ["sum_boys"])],
)
def test_metrics_are_suggested_only_where_they_are_legal(
    include_metrics: bool, expected: list[str]
) -> None:
    """HAVING subjects may name a saved metric; dimensions and WHERE may not."""
    context = DatasetContext(
        id=3,
        table_name="birth_names",
        database_name="examples",
        available_columns=[{"name": "ds"}],
        available_metrics=[{"name": "sum_boys"}],
    )
    suggestions = DatasetValidator._get_column_suggestions(
        "sum_boy", context, include_metrics=include_metrics
    )
    assert [s.name for s in suggestions] == expected


@pytest.mark.parametrize("slot", ["x", "group_by", "y"])
@pytest.mark.parametrize("aggregate", [None, "SUM"])
def test_saved_metric_hint_uses_slot_identity(slot: str, aggregate: str | None) -> None:
    """Only a metric slot gets a hint, regardless of its aggregate field."""
    config_data: dict[str, Any] = {
        "chart_type": "xy",
        "kind": "bar",
        "x": {"name": "ds"},
        "y": [{"name": "num", "aggregate": "SUM"}],
    }
    ref = {"name": "num_boys", "aggregate": aggregate}
    config_data[slot] = ref if slot == "x" else [ref]
    config = GenerateChartRequest.model_validate(
        {"dataset_id": 3, "config": config_data}
    ).config
    context = DatasetContext(
        id=3,
        table_name="birth_names",
        database_name="examples",
        available_columns=[{"name": "ds"}, {"name": "num", "type": "INTEGER"}],
        available_metrics=[{"name": "sum_boys"}],
    )
    valid, error = DatasetValidator.validate_against_dataset(config, 3, context)
    assert not valid
    assert error is not None
    hints = [s for s in error.suggestions if "Did you mean the saved metric" in s]
    assert bool(hints) is (slot == "y")
    if hints:
        assert "'sum_boys'" in hints[0]


@pytest.mark.parametrize("query_mode", [None, "aggregate", "raw"])
def test_table_metric_hint_excludes_raw_columns(query_mode: str | None) -> None:
    """Only aggregated table columns can be fixed with a saved metric."""
    config = TableChartConfig.model_validate(
        {
            "chart_type": "table",
            "query_mode": query_mode,
            "columns": [{"name": "num_boys", "aggregate": "SUM"}],
        }
    )
    context = DatasetContext(
        id=3,
        table_name="birth_names",
        database_name="examples",
        available_columns=[{"name": "ds"}],
        available_metrics=[{"name": "sum_boys"}],
    )
    valid, error = DatasetValidator.validate_against_dataset(config, 3, context)
    assert not valid
    assert error is not None
    assert any("Did you mean the saved metric" in s for s in error.suggestions) is (
        query_mode != "raw"
    )


@pytest.mark.parametrize("multiple", [False, True])
@pytest.mark.parametrize(
    "name", ["Customer's Name", "Sales & Marketing", "<fixture>", "data:revenue"]
)
def test_dataset_candidate_spelling_is_copyable(name: str, multiple: bool) -> None:
    """Hints match context spelling and resolve in the dataset namespace.

    Construct refs directly to isolate dataset lookup from input-schema rules.
    """
    context = DatasetContext(
        id=3,
        table_name="fixture",
        database_name="examples",
        available_columns=[{"name": name}],
    )
    refs = [ColumnRef.model_construct(name=name[:-1])]
    if multiple:
        refs.append(ColumnRef(name="no_such_col"))
    error = DatasetValidator._validate_columns_exist(refs, context)
    assert error is not None
    assert f"Did you mean: {name}?" in error.suggestions
    assert error.dataset_context is not None
    assert error.dataset_context.available_columns == [{"name": name}]
    assert (
        DatasetValidator._validate_columns_exist(
            [ColumnRef.model_construct(name=name)], context
        )
        is None
    )


def test_dataset_candidate_length_is_bounded() -> None:
    """Dataset names have a per-candidate bound without filtering their spelling."""
    name = "x" * 250
    error = ChartErrorBuilder.column_not_found_error("missing", [name, "revenue"])
    assert f"Did you mean: {'x' * 200}...[truncated], revenue?" in error.suggestions
