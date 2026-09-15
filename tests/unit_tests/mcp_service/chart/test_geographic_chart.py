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

"""Typed geographic contracts, native query semantics, and boundary parity."""

from copy import deepcopy
from decimal import Decimal
from pathlib import Path
from typing import Any
from unittest.mock import Mock, patch

import pytest
from fastmcp import Client
from pydantic import TypeAdapter, ValidationError
from sqlalchemy.exc import SQLAlchemyError

from superset.mcp_service.app import mcp
from superset.mcp_service.chart.chart_helpers import build_query_dicts_from_form_data
from superset.mcp_service.chart.chart_utils import (
    map_config_to_form_data,
    merge_chart_form_data,
)
from superset.mcp_service.chart.compile import _compile_chart
from superset.mcp_service.chart.preview_utils import (
    _generate_ascii_preview_from_data,
    _generate_vega_lite_preview_from_data,
)
from superset.mcp_service.chart.query_result import normalize_chart_query_result
from superset.mcp_service.chart.schemas import (
    ChartConfig,
    ChartError,
    GenerateChartRequest,
    GenerateExploreLinkRequest,
    UpdateChartRequest,
)
from superset.mcp_service.chart.tool.get_chart_type_schema import (
    _CHART_EXAMPLES,
    _get_chart_type_schema_impl,
)
from superset.utils import json
from superset.utils.geographic import resolve_geographic_value, resolve_region
from superset.utils.geographic_regions import REGIONS

KINDS = ("country_map", "world_map", "deck_scatter")
# Reuse the compiled union schema; each validation still creates a fresh config.
CHART_CONFIG_ADAPTER = TypeAdapter(ChartConfig)


def config_for(kind: str) -> Any:
    """Parse the published example rather than duplicating a private contract."""
    return CHART_CONFIG_ADAPTER.validate_python(_CHART_EXAMPLES[kind][0])


def form_for(kind: str) -> dict[str, Any]:
    """Map the same config consumed by the three public tools."""
    return map_config_to_form_data(config_for(kind))


def result_for(kind: str) -> dict[str, Any]:
    """Native query results before frontend display transforms."""
    row = (
        {"state": "CA", "SUM(sales)": 10}
        if kind == "country_map"
        else {"country": "US", "SUM(sales)": 10}
        if kind == "world_map"
        else {"latitude": 37.8, "longitude": -122.4}
    )
    return {"queries": [{"data": [row]}]}


def invalid_result_for(kind: str) -> dict[str, Any]:
    """Keep valid metrics while failing the actual geographic value contract."""
    result = result_for(kind)
    row = result["queries"][0]["data"][0]
    if kind == "country_map":
        row["state"] = "BC"
    elif kind == "world_map":
        row["country"] = "not-a-country"
    else:
        row["latitude"] = 91
    return result


@pytest.mark.parametrize("kind", KINDS)
def test_geographic_example_configs_are_independent(kind: str) -> None:
    """Sharing a compiled schema must not share mutable config instances."""
    first = config_for(kind)
    second = config_for(kind)
    assert first is not second
    first.row_limit = 1
    assert second.row_limit == 10000
    assert config_for(kind).row_limit == 10000


@pytest.mark.parametrize("kind", KINDS)
def test_geographic_schema_examples_and_all_request_unions(kind: str) -> None:
    """Each entry point uses the required, bounded shared discriminator."""
    example = _CHART_EXAMPLES[kind][0]
    schema = _get_chart_type_schema_impl(kind)["schema"]
    assert "chart_type" in schema["required"]
    assert schema["additionalProperties"] is False
    assert schema["properties"]["row_limit"]["maximum"] == 10000
    for model, identity in (
        (GenerateChartRequest, {"dataset_id": 3}),
        (GenerateExploreLinkRequest, {"dataset_id": 3}),
        (UpdateChartRequest, {"identifier": 1}),
    ):
        assert (
            model.model_validate({**identity, "config": example}).config.chart_type
            == kind
        )
    for patch_ in (
        {"row_limit": 10001},
        {"row_limit": True},
        {"row_limit": "100"},
        {"bogus": 1},
    ):
        with pytest.raises(ValidationError):
            CHART_CONFIG_ADAPTER.validate_python({**example, **patch_})
    with pytest.raises(ValidationError):
        CHART_CONFIG_ADAPTER.validate_python(
            {k: v for k, v in example.items() if k != "chart_type"}
        )


@pytest.mark.parametrize(
    "country,value,format_,expected",
    [
        ("usa", "CA", "abbreviation", "US-CA"),
        ("usa", "ca", "abbreviation", "US-CA"),
        ("usa", "California", "name", "US-CA"),
        ("usa", "us-ca", "iso_3166_2", "US-CA"),
        ("canada", "BC", "abbreviation", "CA-BC"),
        ("australia", "Victoria", "name", "AU-VIC"),
        ("australia", "NSW", "abbreviation", "AU-NSW"),
        ("australia", "Queensland", "name", "AU-QLD"),
        ("japan", "Tokyo", "name", "JP-13"),
        ("japan", "Osaka", "name", "JP-27"),
        ("uk", "Isle of Wight", "name", "GB-IOW"),
    ],
)
def test_region_resolution(
    country: str, value: str, format_: str, expected: str
) -> None:
    """All formats resolve only to identifiers present in the chosen geometry."""
    assert resolve_region(value, country, format_) == expected


@pytest.mark.parametrize(
    "value",
    [
        "BC",
        "Victoria",
        "NSW",
        "Queensland",
        "Tokyo",
        "Osaka",
        "Isle of Wight",
        None,
        1,
        "",
        "CA ",
    ],
)
def test_us_rejects_non_us_and_malformed_values(value: object) -> None:
    """Cross-country values never silently disappear from a map."""
    with pytest.raises(ValueError, match="country=usa"):
        resolve_region(value, "usa", "abbreviation")


def test_exact_first_and_ambiguous_folded_names() -> None:
    """Do not let a case-insensitive dictionary overwrite distinct names."""
    pairs = [("Region", "A"), ("REGION", "B")]
    assert resolve_geographic_value("Region", pairs) == "A"
    with pytest.raises(ValueError, match="ambiguous"):
        resolve_geographic_value("region", pairs)
    with pytest.raises(ValueError, match="ambiguous"):
        resolve_geographic_value("Region", pairs + [("Region", "C")])


@pytest.mark.parametrize("country", REGIONS)
def test_region_data_matches_frontend_geometry(country: str) -> None:
    """Updating geometry requires updating its bounded backend lookup too."""
    root = Path(__file__).resolve().parents[4]
    path = (
        root
        / "superset-frontend/plugins/plugin-chart-country-map/src/countries"
        / f"{country}.geojson"
    )
    expected = sorted(
        {
            (
                f["properties"]["ISO"],
                f["properties"].get("NAME_2") or f["properties"]["NAME_1"],
            )
            for f in json.loads(path.read_text())["features"]
        }
    )
    assert REGIONS[country] == expected


@pytest.mark.parametrize("kind", KINDS)
def test_geographic_native_query_and_filters(kind: str) -> None:
    """Query roles and ordering match the frontend's buildQuery contract."""
    config = CHART_CONFIG_ADAPTER.validate_python(
        {
            **_CHART_EXAMPLES[kind][0],
            "filters": [{"column": "segment", "op": "IN", "value": ["Retail"]}],
        }
    )
    form = map_config_to_form_data(config)
    with patch(
        "superset.mcp_service.chart.chart_helpers.resolve_datasource_engine",
        return_value="sqlite",
    ):
        query = build_query_dicts_from_form_data(form, 3, "table")[0]
    assert {"col": "segment", "op": "IN", "val": ["Retail"]} in query["filters"]
    assert query["row_limit"] == 10000
    if kind == "deck_scatter":
        assert set(query["columns"]) == {"latitude", "longitude"}
        assert query["metrics"] == []
        assert query["is_timeseries"] is False
        assert query["orderby"] == []
        assert {"col": "latitude", "op": "IS NOT NULL", "val": ""} in query["filters"]
    else:
        assert query["columns"] == [form["entity"]]
        assert query["metrics"] == [form["metric"]]
        if kind == "world_map":
            assert query["orderby"] == [(form["metric"], False)]


@pytest.mark.parametrize("same", [True, False])
def test_world_bubble_metrics_deduplicate_by_label(same: bool) -> None:
    """The secondary bubble-size metric is queried unless its alias is shared."""
    config = CHART_CONFIG_ADAPTER.validate_python(
        {
            **_CHART_EXAMPLES["world_map"][0],
            "show_bubbles": True,
            "secondary_metric": {
                "name": "sales" if same else "population",
                "aggregate": "SUM",
            },
        }
    )
    form = map_config_to_form_data(config)
    with patch(
        "superset.mcp_service.chart.chart_helpers.resolve_datasource_engine",
        return_value="sqlite",
    ):
        query = build_query_dicts_from_form_data(form, 3, "table")[0]
    assert len(query["metrics"]) == (1 if same else 2)


@pytest.mark.parametrize("kind", KINDS)
def test_result_validation_preserves_source_and_cache(kind: str) -> None:
    """Validation cannot mutate cache records or export identifiers."""
    result = result_for(kind)
    before = deepcopy(result)
    assert normalize_chart_query_result(result, form_for(kind)) == before
    assert result == before
    assert normalize_chart_query_result(
        {"queries": [{"data": []}]}, form_for(kind)
    ) == {"queries": [{"data": []}]}
    bad: dict[str, Any]
    for bad in (
        {},
        {"queries": []},
        {"queries": [{"data": [{}]}]},
        {"queries": [{"data": "bad"}]},
    ):
        assert isinstance(normalize_chart_query_result(bad, form_for(kind)), ChartError)


@pytest.mark.parametrize("kind", KINDS)
def test_invalid_values_and_geometry_preview(kind: str) -> None:
    """Never return fabricated Vega bars for geographic requests."""
    form = form_for(kind)
    result = result_for(kind)
    row = result["queries"][0]["data"][0]
    for column in list(row):
        bad = deepcopy(result)
        bad["queries"][0]["data"][0][column] = "not valid"
        error = normalize_chart_query_result(bad, form)
        assert isinstance(error, ChartError)
        assert error.error_type == "InvalidGeographicResult"
    assert (
        "geometry not reproduced"
        in _generate_ascii_preview_from_data([row], form).ascii_content
    )
    preview = _generate_vega_lite_preview_from_data([row], form)
    assert isinstance(preview, ChartError)
    assert preview.error_type == "UnsupportedGeographicPreview"


def test_alias_collisions_fail_instead_of_losing_aggregates() -> None:
    """CA and ca grouped separately cannot safely be added (e.g. AVG)."""
    result = {
        "queries": [
            {"data": [{"state": value, "SUM(sales)": 1} for value in ("CA", "ca")]}
        ]
    }
    error = normalize_chart_query_result(result, form_for("country_map"))
    assert isinstance(error, ChartError)
    assert "normalize source values before aggregation" in error.error


@pytest.mark.parametrize("kind", KINDS)
def test_update_omissions_explicit_clearing_and_rebind(kind: str) -> None:
    """Unspecified controls survive updates, not old dataset roles on rebind."""
    config = config_for(kind)
    old = {
        **form_for(kind),
        "row_limit": 12,
        "time_range": "Last week",
        "template_params": {"old": 1},
        "adhoc_filters": [
            {
                "subject": "segment",
                "operator": "IN",
                "comparator": ["Retail"],
                "expressionType": "SIMPLE",
                "clause": "WHERE",
            }
        ],
    }
    merged = merge_chart_form_data(old, form_for(kind), config)
    assert merged["row_limit"] == 12
    assert merged["time_range"] == "Last week"
    assert merged["adhoc_filters"] == old["adhoc_filters"]
    cleared = CHART_CONFIG_ADAPTER.validate_python(
        {**_CHART_EXAMPLES[kind][0], "filters": [], "time_range": None}
    )
    merged = merge_chart_form_data(old, map_config_to_form_data(cleared), cleared)
    assert not merged.get("adhoc_filters")
    assert merged.get("time_range") is None
    rebound = merge_chart_form_data(old, form_for(kind), config, dataset_rebind=True)
    assert not rebound.get("adhoc_filters")
    assert "template_params" not in rebound


@pytest.mark.parametrize("kind", KINDS)
def test_compile_checks_full_bounded_map_result(kind: str) -> None:
    """An invalid region outside the first two rows must block generation."""
    result = result_for(kind)
    with (
        patch(
            "superset.mcp_service.chart.chart_helpers.build_query_context_from_form_data",
            return_value=Mock(),
        ) as build,
        patch(
            "superset.commands.chart.data.get_data_command.ChartDataCommand"
        ) as command,
    ):
        command.return_value.run.return_value = result
        assert _compile_chart(form_for(kind), 3).success
        assert build.call_args.kwargs["row_limit"] == 10000
        result["queries"][0]["data"].append({})
        failure = _compile_chart(form_for(kind), 3)
        assert not failure.success
        assert failure.error_code == "INVALID_GEOGRAPHIC_RESULT"


@pytest.mark.asyncio
@pytest.mark.parametrize("kind", KINDS)
async def test_fastmcp_schema_and_public_input_discriminators(kind: str) -> None:
    """The actual FastMCP server advertises all three public entry points."""
    with patch(
        "superset.mcp_service.auth.get_user_from_request",
        return_value=Mock(id=1, username="admin", roles=[], groups=[]),
    ):
        async with Client(mcp) as client:
            response = await client.call_tool(
                "get_chart_type_schema", {"chart_type": kind}
            )
            assert response.structured_content["chart_type"] == kind
            tools = {tool.name: tool for tool in await client.list_tools()}
            for name in ("generate_chart", "update_chart", "generate_explore_link"):
                assert kind in json.dumps(tools[name].inputSchema)


@pytest.mark.asyncio
@pytest.mark.parametrize("kind", KINDS)
@pytest.mark.parametrize("valid", [True, False])
@pytest.mark.parametrize("persist", [False, True])
@pytest.mark.parametrize(
    "entry",
    ["generate_chart", "generate_explore_link", "update_chart", "update_chart_preview"],
)
async def test_fastmcp_geographic_entry_points_execute_result_contract(  # noqa: C901
    kind: str, valid: bool, entry: str, persist: bool
) -> None:
    """Public calls execute the real compile contract, including failed queries."""
    await _exercise_public_geographic_entry(kind, valid, entry, persist)


async def _exercise_public_geographic_entry(  # noqa: C901
    kind: str,
    valid: bool,
    entry: str,
    persist: bool,
    *,
    rebind: bool = False,
    result_override: dict[str, Any] | None = None,
) -> None:
    """Run native public compile/save paths against controlled database results."""
    import importlib
    from contextlib import ExitStack

    config = config_for(kind)
    request = {"config": config.model_dump(exclude_unset=True)}
    dataset = Mock(
        id=3,
        table_name="locations",
        datasource_name="locations",
        schema=None,
        columns=[],
        metrics=[],
        database=Mock(database_name="examples"),
        main_dttm_col=None,
    )
    chart = Mock(
        id=9,
        datasource_id=3,
        datasource_type="table",
        datasource=dataset,
        slice_name="Locations",
        viz_type=kind,
        params=json.dumps(form_for(kind)),
        uuid="11111111-1111-1111-1111-111111111111",
        description="",
        url="/explore/?slice_id=9",
    )
    if rebind:
        old = json.loads(chart.params)
        old.update(
            template_params={"stale": "source"},
            time_range="Last week",
            groupby=["segment"],
            granularity_sqla="old_date",
            secondary_metric="old_metric",
            dimension="segment",
            color_scheme="supersetColors",
            adhoc_filters=[
                {
                    "subject": "segment",
                    "operator": "IN",
                    "comparator": ["Retail"],
                    "expressionType": "SIMPLE",
                    "clause": "WHERE",
                }
            ],
        )
        chart.params = json.dumps(old)
        request["dataset_id"] = 4
    if entry == "update_chart":
        request.update(identifier=9, generate_preview=not persist)
    else:
        request["dataset_id"] = 3
    if entry == "generate_chart":
        request["preview_formats"] = ["url"]
        request["save_chart"] = persist
    if entry == "update_chart_preview":
        request["form_data_key"] = "geographic-cache"
    response_data = (
        result_override
        if result_override is not None
        else (result_for(kind) if valid else invalid_result_for(kind))
    )
    if rebind:
        response_data["queries"][0]["data"][0]["old_metric"] = 1
    domain = "explore" if entry == "generate_explore_link" else "chart"
    module = importlib.import_module(f"superset.mcp_service.{domain}.tool.{entry}")
    with ExitStack() as stack:
        if rebind:
            stack.enter_context(
                patch(
                    "superset.mcp_service.chart.validation.dataset_validator.build_dataset_context_from_orm",
                    return_value=Mock(
                        available_columns=[{"name": "segment"}, {"name": "old_date"}],
                        available_metrics=[{"name": "old_metric"}],
                    ),
                )
            )
        for target, value in [
            (
                "superset.mcp_service.auth.get_user_from_request",
                Mock(id=1, username="admin", roles=[], groups=[]),
            ),
            ("superset.utils.log.DBEventLogger.log", None),
            ("superset.daos.dataset.DatasetDAO.find_by_id", dataset),
            (
                "superset.mcp_service.chart.compile.DatasetValidator.validate_against_dataset",
                (True, None),
            ),
            ("superset.mcp_service.chart.compile.build_dataset_context_from_orm", None),
            (
                "superset.mcp_service.chart.chart_helpers.build_query_context_from_form_data",
                Mock(),
            ),
            (
                "superset.mcp_service.chart.chart_utils.generate_explore_link",
                "http://localhost/explore/?form_data_key=geo",
            ),
            (
                "superset.mcp_service.commands.create_form_data.MCPCreateFormDataCommand.run",
                "geo",
            ),
            (
                "superset.commands.explore.permalink.create.CreateExplorePermalinkCommand.run",
                "geo",
            ),
        ]:
            stack.enter_context(patch(target, return_value=value))
        stack.enter_context(
            patch(
                "superset.mcp_service.chart.validation.dataset_validator.DatasetValidator.normalize_column_names",
                side_effect=lambda cfg, *args, **kwargs: cfg,
            )
        )
        command = stack.enter_context(
            patch("superset.commands.chart.data.get_data_command.ChartDataCommand")
        )
        command.return_value.run.return_value = response_data
        if hasattr(module, "has_dataset_access"):
            stack.enter_context(
                patch.object(module, "has_dataset_access", return_value=True)
            )
        if entry == "generate_chart":
            if persist:
                create = stack.enter_context(
                    patch("superset.commands.chart.create.CreateChartCommand")
                )
                create.return_value.run.return_value = chart
                stack.enter_context(
                    patch("superset.db.session.refresh", return_value=None)
                )
                stack.enter_context(
                    patch(
                        "superset.daos.chart.ChartDAO.find_by_id",
                        side_effect=SQLAlchemyError("test detached chart"),
                    )
                )
                stack.enter_context(
                    patch.object(
                        module,
                        "validate_chart_dataset",
                        return_value=Mock(is_valid=True, warnings=[]),
                    )
                )
            parsed = GenerateChartRequest.model_validate(request)
            stack.enter_context(
                patch(
                    "superset.mcp_service.chart.validation.ValidationPipeline.validate_request_with_warnings",
                    return_value=Mock(
                        is_valid=True, request=parsed, warnings={}, error=None
                    ),
                )
            )
        elif entry == "update_chart_preview":
            stack.enter_context(
                patch.object(module, "_find_dataset", return_value=dataset)
            )
            stack.enter_context(
                patch.object(
                    module,
                    "_get_previous_form_data",
                    return_value={
                        **form_for(kind),
                        "datasource": "3__table",
                        "row_limit": 12,
                    },
                )
            )
            stack.enter_context(
                patch.object(
                    module,
                    "generate_explore_link",
                    return_value="http://localhost/explore/?form_data_key=geo",
                )
            )
        elif entry == "update_chart":
            if persist:
                update = stack.enter_context(
                    patch("superset.commands.chart.update.UpdateChartCommand")
                )
                update.return_value.run.return_value = chart
            stack.enter_context(
                patch.object(module, "find_chart_by_identifier", return_value=chart)
            )
            stack.enter_context(
                patch(
                    "superset.mcp_service.auth.check_chart_data_access",
                    return_value=Mock(is_valid=True),
                )
            )
        async with Client(mcp) as client:
            response = await client.call_tool(entry, {"request": request})
        payload = response.structured_content
        assert payload["success"] is valid, json.dumps(payload)
        assert command.return_value.run.called
        if valid:
            assert payload["form_data"]["viz_type"] == kind
            if rebind:
                rebound = payload["form_data"]
                assert not rebound.get("adhoc_filters"), rebound
                assert "template_params" not in rebound
                assert not rebound.get("groupby")
                assert not rebound.get("granularity_sqla")
                assert not rebound.get("secondary_metric")
                assert not rebound.get("dimension")
                assert rebound.get("time_range") != "Last week"
                assert rebound["color_scheme"] == "supersetColors"
                assert rebound["datasource"] == "4__table"
                if persist:
                    saved = update.call_args.args[-1]
                    assert saved["query_context"] is None
                    assert not json.loads(saved["params"]).get("adhoc_filters")
        else:
            assert payload["error"]["error_code"] == "INVALID_GEOGRAPHIC_RESULT", (
                payload
            )


@pytest.mark.asyncio
@pytest.mark.parametrize("kind", KINDS)
@pytest.mark.parametrize("data_path", ["saved", "saved_cache", "unsaved_cache"])
@pytest.mark.parametrize("valid", [True, False])
@pytest.mark.parametrize("export_format", ["json", "csv", "excel"])
async def test_geographic_chart_data_saved_cached_and_exports(
    kind: str, data_path: str, valid: bool, export_format: str
) -> None:
    """Raw identifiers survive every data/export path; invalid rows fail all three."""
    await _exercise_geographic_data_export(kind, data_path, valid, export_format)


async def _exercise_geographic_data_export(
    kind: str,
    data_path: str,
    valid: bool,
    export_format: str,
    *,
    decimal_coordinates: bool = False,
) -> None:
    """Exercise saved and cached data/export with pre-JSON database scalars."""
    import importlib
    from contextlib import ExitStack
    from types import SimpleNamespace

    module = importlib.import_module("superset.mcp_service.chart.tool.get_chart_data")
    form = {**form_for(kind), "datasource": "3__table", "slice_name": "Locations"}
    source = result_for(kind) if valid else invalid_result_for(kind)
    rows = source["queries"][0]["data"]
    if decimal_coordinates:
        rows[0] = {"latitude": Decimal("37.5"), "longitude": Decimal("-122.25")}
    source["queries"][0].update(colnames=list(rows[0]), rowcount=len(rows))
    query = {"columns": list(rows[0]), "metrics": [], "row_limit": 10000}
    context = SimpleNamespace(
        queries=[
            SimpleNamespace(filter=[], time_range=None, to_dict=lambda: dict(query))
        ],
        form_data=form,
    )
    chart = SimpleNamespace(
        id=9,
        slice_name="Locations",
        viz_type=kind,
        datasource_id=3,
        datasource_type="table",
        query_context=json.dumps(
            {"datasource": {"id": 3, "type": "table"}, "queries": [query]}
        ),
        params=json.dumps(form),
    )
    with ExitStack() as stack:
        stack.enter_context(
            patch(
                "superset.mcp_service.auth.get_user_from_request",
                return_value=Mock(id=1, username="admin", roles=[], groups=[]),
            )
        )
        stack.enter_context(
            patch("superset.utils.log.DBEventLogger.log", return_value=None)
        )
        for name, value in (
            ("get_cached_form_data", json.dumps(form)),
            ("build_query_dicts_from_form_data", [query]),
            ("build_query_context_from_form_data", context),
            ("find_chart_by_identifier", chart),
            (
                "validate_chart_dataset",
                SimpleNamespace(is_valid=True, warnings=[], error=None),
            ),
        ):
            stack.enter_context(patch.object(module, name, return_value=value))
        stack.enter_context(
            patch(
                "superset.charts.schemas.ChartDataQueryContextSchema.load",
                return_value=context,
            )
        )
        command = stack.enter_context(
            patch("superset.commands.chart.data.get_data_command.ChartDataCommand")
        )
        command.return_value.run.return_value = source
        request: dict[str, Any] = {"format": export_format}
        if data_path != "unsaved_cache":
            request["identifier"] = "9"
        if data_path != "saved":
            request["form_data_key"] = "geographic-cache"
        async with Client(mcp) as client:
            response = await client.call_tool("get_chart_data", {"request": request})
        payload = json.loads(response.content[0].text)
        if not valid:
            assert payload["error_type"] == "InvalidGeographicResult", payload
        else:
            assert "error_type" not in payload, payload
            assert payload["row_count"] == 1
            if export_format == "json":
                if decimal_coordinates:
                    # MCP's Pydantic export preserves Decimal precision as text;
                    # the native chart JSON converter emits numeric coordinates.
                    assert payload["data"] == [
                        {key: str(value) for key, value in rows[0].items()}
                    ]
                    assert isinstance(rows[0]["latitude"], Decimal)
                    assert json.json_int_dttm_ser(rows[0]["latitude"]) == 37.5
                else:
                    assert payload["data"] == rows
            elif export_format == "csv":
                import csv
                from io import StringIO

                assert list(csv.DictReader(StringIO(payload["csv_data"])))[0] == {
                    key: str(value) for key, value in rows[0].items()
                }
            else:
                import base64
                from io import BytesIO

                from openpyxl import load_workbook

                workbook = load_workbook(
                    BytesIO(base64.b64decode(payload["excel_data"]))
                )
                assert list(workbook.active.values)[1] == tuple(rows[0].values())
        assert source["queries"][0]["data"] is rows


@pytest.mark.parametrize("kind", KINDS)
def test_metric_alias_cannot_replace_a_geographic_dimension(kind: str) -> None:
    """A result needs distinct keys for its coordinate/entity and metric roles."""
    field = "radius_metric" if kind == "deck_scatter" else "metric"
    label = (
        "latitude"
        if kind == "deck_scatter"
        else "state"
        if kind == "country_map"
        else "country"
    )
    with pytest.raises(ValidationError, match="conflicts with a geographic column"):
        CHART_CONFIG_ADAPTER.validate_python(
            {
                **_CHART_EXAMPLES[kind][0],
                field: {"name": "sales", "aggregate": "SUM", "label": label},
            }
        )


@pytest.mark.parametrize("kind", KINDS)
def test_explicit_temporal_binding_clear_preserves_user_filters(kind: str) -> None:
    """Clearing dashboard binding removes only the generated no-filter predicate."""
    old = form_for(kind)
    generated = {
        "subject": "event_time",
        "operator": "TEMPORAL_RANGE",
        "comparator": "No filter",
        "clause": "WHERE",
        "expressionType": "SIMPLE",
    }
    user_filter = {**generated, "comparator": "Last week"}
    old.update(
        _mcp_dashboard_time_filter_subject="event_time",
        adhoc_filters=[generated, user_filter],
    )
    config = CHART_CONFIG_ADAPTER.validate_python(
        {**_CHART_EXAMPLES[kind][0], "temporal_column": None}
    )
    merged = merge_chart_form_data(old, map_config_to_form_data(config), config)
    assert merged["adhoc_filters"] == [user_filter]
    assert "_mcp_dashboard_time_filter_subject" not in merged


def test_points_use_native_units_and_keyless_map_renderer() -> None:
    """MapLibre and native radius units work without a Mapbox credential."""
    form = form_for("deck_scatter")
    assert form["point_unit"] == "radius_m"
    assert form["map_renderer"] == "maplibre"
    assert form["maplibre_style"].startswith("https://basemaps.cartocdn.com/")
    assert (form["min_radius"], form["max_radius"]) == (2, 250)


@pytest.mark.parametrize("kind", KINDS)
def test_geographic_nested_refs_filters_and_time_are_strict(kind: str) -> None:
    """Bounded nested schemas keep the shared aliases, not arbitrary fields."""
    schema = _get_chart_type_schema_impl(kind)["schema"]
    assert schema["$defs"]["GeographicColumnRef"]["additionalProperties"] is False
    assert schema["$defs"]["GeographicFilterConfig"]["additionalProperties"] is False
    example = deepcopy(_CHART_EXAMPLES[kind][0])
    role = "latitude" if kind == "deck_scatter" else "entity"
    name = example[role]["name"]
    example[role] = {"column_name": name}
    example["filters"] = [{"col": name, "opr": "IN", "val": ["CA"]}]
    config = CHART_CONFIG_ADAPTER.validate_python(example)
    assert getattr(config, role).name == name
    assert config.filters[0].column == name
    for patch_ in (
        {"time_range": "not a time range"},
        {role: {"name": name, "extra": True}},
        {"filters": [{"column": name, "op": "IN", "value": ["CA"] * 1001}]},
    ):
        with pytest.raises(ValidationError):
            CHART_CONFIG_ADAPTER.validate_python({**example, **patch_})


@pytest.mark.parametrize("kind", KINDS)
def test_geographic_query_context_seeds_native_form_data(kind: str) -> None:
    """QueryContext receives full native controls for virtual-dataset Jinja."""
    from superset.mcp_service.chart.chart_helpers import (
        build_query_context_from_form_data,
    )

    form = {**form_for(kind), "datasource": "3__table"}
    with (
        patch(
            "superset.mcp_service.chart.chart_helpers.resolve_datasource_engine",
            return_value="sqlite",
        ),
        patch("superset.common.query_context_factory.QueryContextFactory") as factory,
    ):
        build_query_context_from_form_data(form)
    seeded = factory.return_value.create.call_args.kwargs["form_data"]
    assert seeded["viz_type"] == kind
    assert seeded["mcp_geographic"] is True
    assert seeded["datasource"] == "3__table"
    if kind == "deck_scatter":
        assert seeded["spatial"]["latCol"] == "latitude"
    else:
        assert seeded["entity"] == ("state" if kind == "country_map" else "country")


@pytest.mark.parametrize("kind", KINDS)
def test_geographic_ascii_clamps_width_and_handles_render_errors(kind: str) -> None:
    """Map data previews share the safe table fallback behavior."""
    from superset.mcp_service.chart.ascii_charts import generate_ascii_chart

    with patch("superset.mcp_service.chart.ascii_charts.generate_ascii_table") as table:
        table.return_value = "table"
        assert generate_ascii_chart([{"value": 1}], kind, width=-1).endswith("table")
        table.assert_called_once_with([{"value": 1}], 21)
        table.side_effect = ValueError("invalid table")
        assert (
            generate_ascii_chart([{"value": 1}], kind)
            == "ASCII chart generation failed"
        )


def test_geographic_recommendations_preserve_time_series_and_bound_cardinality() -> (
    None
):
    """Ambiguous names do not override temporal or high-cardinality suggestions."""
    from superset.mcp_service.chart.schemas import DataColumn
    from superset.mcp_service.chart.tool.get_chart_data import _build_candidates

    def column(name: str, dtype: str, count: int = 10) -> DataColumn:
        """Build realistic inferred column metadata."""
        return DataColumn(
            name=name,
            display_name=name,
            data_type=dtype,
            unique_count=count,
            null_count=0,
            sample_values=[],
        )

    metric = column("sales", "numeric")
    state = column("state", "string")
    assert "country map" in _build_candidates([state, metric], 10)
    assert "line chart" in _build_candidates(
        [state, metric, column("date", "temporal")], 10
    )
    assert "country map" not in _build_candidates(
        [column("state", "string", 1000), metric], 1000
    )
    assert "country map" not in _build_candidates(
        [column("state", "boolean"), metric], 10
    )


def test_world_country_aliases_are_cached_by_format() -> None:
    """Per-row validation reuses bounded immutable aliases without format leakage."""
    from superset.mcp_service.chart.query_result import _world_country_entries

    assert _world_country_entries("cca2") is _world_country_entries("cca2")
    assert ("US", "USA") in _world_country_entries("cca2")
    assert ("USA", "USA") in _world_country_entries("cca3")
    assert ("US", "USA") not in _world_country_entries("cca3")


def test_ambiguous_bundled_uk_name_requires_a_code() -> None:
    """Do not guess which bundled Halton geometry a name refers to."""
    with pytest.raises(ValueError, match="ambiguous"):
        resolve_region("Halton", "uk", "name")
    assert resolve_region("GB-HAL", "uk", "iso_3166_2") == "GB-HAL"
    assert resolve_region("WRL", "uk", "abbreviation") == "GB-WRL"


@pytest.mark.asyncio
@pytest.mark.parametrize("viz", ["gauge_chart", *KINDS])
async def test_public_rebind_guidance_matches_chart_roles(viz: str) -> None:
    """Gauge rebind guidance must not request geographic roles."""
    with (
        patch(
            "superset.mcp_service.auth.get_user_from_request",
            return_value=Mock(id=1, username="admin", roles=[], groups=[]),
        ),
        patch(
            "superset.mcp_service.chart.tool.update_chart.find_chart_by_identifier",
            return_value=Mock(id=1, datasource_id=3, viz_type=viz),
        ),
    ):
        async with Client(mcp) as client:
            response = await client.call_tool(
                "update_chart",
                {
                    "request": {
                        "identifier": 1,
                        "dataset_id": 4,
                    }
                },
            )
    payload = response.structured_content
    assert not payload["success"]
    details = payload["error"]["details"]
    assert "metric" in details
    assert ("geographic" in details) is (viz != "gauge_chart")


@pytest.mark.asyncio
@pytest.mark.parametrize("kind", KINDS)
@pytest.mark.parametrize("persist", [False, True])
async def test_public_geographic_rebind_drops_same_named_source_state(
    kind: str, persist: bool
) -> None:
    """Saved and unsaved rebinding drops even target-resolvable source filters."""
    await _exercise_public_geographic_entry(
        kind, True, "update_chart", persist, rebind=True
    )


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "entry",
    ["generate_chart", "generate_explore_link", "update_chart", "update_chart_preview"],
)
@pytest.mark.parametrize("persist", [False, True])
async def test_public_decimal_coordinates_compile(entry: str, persist: bool) -> None:
    """NUMERIC query coordinates are validated before the JSON conversion step."""
    result = result_for("deck_scatter")
    result["queries"][0]["data"][0] = {
        "latitude": Decimal("37.8"),
        "longitude": Decimal("-122.4"),
    }
    await _exercise_public_geographic_entry(
        "deck_scatter", True, entry, persist, result_override=result
    )
    assert isinstance(result["queries"][0]["data"][0]["latitude"], Decimal)


@pytest.mark.asyncio
@pytest.mark.parametrize("kind", ["country_map", "world_map"])
async def test_public_decimal_geographic_metrics_compile(kind: str) -> None:
    """NUMERIC aggregates remain valid without coercing source export values."""
    result = result_for(kind)
    result["queries"][0]["data"][0]["SUM(sales)"] = Decimal("10.5")
    await _exercise_public_geographic_entry(
        kind, True, "generate_chart", False, result_override=result
    )


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "value",
    [
        Decimal("NaN"),
        Decimal("sNaN"),
        Decimal("Infinity"),
        Decimal("-Infinity"),
        Decimal("90.00001"),
        Decimal("90.000000000000000000000000000000001"),
        Decimal("-90.000000000000000000000000000000001"),
        True,
        "37.8",
        1 + 2j,
    ],
)
async def test_public_decimal_coordinate_invalid_values(value: object) -> None:
    """Decimal support never permits nonfinite, out-of-range, or nonreal points."""
    result = result_for("deck_scatter")
    result["queries"][0]["data"][0]["latitude"] = value
    await _exercise_public_geographic_entry(
        "deck_scatter", False, "generate_chart", False, result_override=result
    )


@pytest.mark.asyncio
@pytest.mark.parametrize("data_path", ["saved", "saved_cache", "unsaved_cache"])
@pytest.mark.parametrize("export_format", ["json", "csv", "excel"])
async def test_public_decimal_coordinates_data_exports(
    data_path: str, export_format: str
) -> None:
    """Finite database Decimals survive saved/cached JSON, CSV, and Excel paths."""
    await _exercise_geographic_data_export(
        "deck_scatter", data_path, True, export_format, decimal_coordinates=True
    )


@pytest.mark.parametrize(
    "value",
    [
        Decimal("NaN"),
        Decimal("sNaN"),
        Decimal("Infinity"),
        Decimal("1e1000"),
        "1.5",
        True,
        1 + 2j,
    ],
)
def test_decimal_geographic_metric_rejects_non_json_numbers(value: object) -> None:
    """Decimal support retains strict finite JSON-compatible metric results."""
    result = result_for("world_map")
    result["queries"][0]["data"][0]["SUM(sales)"] = value
    assert isinstance(
        normalize_chart_query_result(result, form_for("world_map")), ChartError
    )
