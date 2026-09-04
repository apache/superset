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

from unittest.mock import MagicMock, patch

from superset.mcp_service.chart.chart_helpers import (
    apply_form_data_filters_to_query,
    build_query_dicts_from_form_data,
    extract_form_data_key_from_url,
    find_chart_by_identifier,
    get_cached_form_data,
    merge_extra_form_data_filters_into_query,
    merge_form_data_filters_into_query,
    prepare_form_data_for_query,
)


def test_extract_form_data_key_from_url_with_key():
    url = "http://localhost:8088/explore/?form_data_key=abc123&slice_id=1"
    assert extract_form_data_key_from_url(url) == "abc123"


def test_extract_form_data_key_from_url_no_key():
    url = "http://localhost:8088/explore/?slice_id=1"
    assert extract_form_data_key_from_url(url) is None


def test_extract_form_data_key_from_url_none():
    assert extract_form_data_key_from_url(None) is None


def test_extract_form_data_key_from_url_empty():
    assert extract_form_data_key_from_url("") is None


def test_extract_form_data_key_from_url_multiple_params():
    url = "http://localhost:8088/explore/?slice_id=5&form_data_key=xyz789&other=val"
    assert extract_form_data_key_from_url(url) == "xyz789"


@patch("superset.daos.chart.ChartDAO.find_by_id")
def test_find_chart_by_identifier_int(mock_find):
    mock_chart = MagicMock()
    mock_chart.id = 42
    mock_find.return_value = mock_chart

    result = find_chart_by_identifier(42)
    mock_find.assert_called_once_with(42)
    assert result == mock_chart


@patch("superset.daos.chart.ChartDAO.find_by_id")
def test_find_chart_by_identifier_str_digit(mock_find):
    mock_chart = MagicMock()
    mock_find.return_value = mock_chart

    result = find_chart_by_identifier("123")
    mock_find.assert_called_once_with(123)
    assert result == mock_chart


@patch("superset.daos.chart.ChartDAO.find_by_id")
def test_find_chart_by_identifier_uuid(mock_find):
    mock_chart = MagicMock()
    mock_find.return_value = mock_chart

    uuid_str = "a1b2c3d4-5678-90ab-cdef-1234567890ab"
    result = find_chart_by_identifier(uuid_str)
    mock_find.assert_called_once_with(uuid_str, id_column="uuid")
    assert result == mock_chart


@patch("superset.daos.chart.ChartDAO.find_by_id")
def test_find_chart_by_identifier_not_found(mock_find):
    mock_find.return_value = None
    result = find_chart_by_identifier(999)
    assert result is None


@patch(
    "superset.commands.explore.form_data.get.GetFormDataCommand.run",
    return_value='{"viz_type": "table"}',
)
@patch("superset.commands.explore.form_data.get.GetFormDataCommand.__init__")
def test_get_cached_form_data_success(mock_init, mock_run):
    mock_init.return_value = None
    result = get_cached_form_data("test_key")
    assert result == '{"viz_type": "table"}'


@patch(
    "superset.commands.explore.form_data.get.GetFormDataCommand.run",
    side_effect=KeyError("not found"),
)
@patch("superset.commands.explore.form_data.get.GetFormDataCommand.__init__")
def test_get_cached_form_data_key_error(mock_init, mock_run):
    mock_init.return_value = None
    result = get_cached_form_data("bad_key")
    assert result is None


def test_prepare_form_data_for_query_preserves_existing_filters_with_adhoc(
    monkeypatch,
):
    monkeypatch.setattr(
        "superset.mcp_service.chart.chart_helpers.resolve_datasource_engine",
        lambda datasource_id, datasource_type: "base",
    )
    form_data = {
        "filters": [{"col": "gender", "op": "==", "val": "boy"}],
        "adhoc_filters": [
            {
                "clause": "WHERE",
                "expressionType": "SIMPLE",
                "subject": "gender",
                "operator": "==",
                "comparator": "girl",
            }
        ],
    }
    query = {}

    prepare_form_data_for_query(form_data, 1, "table")
    apply_form_data_filters_to_query(query, form_data)

    assert query["filters"] == [
        {"col": "gender", "op": "==", "val": "boy"},
        {"col": "gender", "op": "==", "val": "girl"},
    ]


def test_prepare_form_data_for_query_merges_cached_and_request_extra_form_data(
    monkeypatch,
):
    monkeypatch.setattr(
        "superset.mcp_service.chart.chart_helpers.resolve_datasource_engine",
        lambda datasource_id, datasource_type: "base",
    )
    form_data = {
        "adhoc_filters": [],
        "extra_form_data": {
            "adhoc_filters": [
                {
                    "clause": "WHERE",
                    "expressionType": "SIMPLE",
                    "subject": "country",
                    "operator": "==",
                    "comparator": "US",
                }
            ],
            "time_range": "Last year",
        },
    }
    query = {}

    prepare_form_data_for_query(
        form_data,
        1,
        "table",
        {
            "adhoc_filters": [
                {
                    "clause": "WHERE",
                    "expressionType": "SIMPLE",
                    "subject": "gender",
                    "operator": "==",
                    "comparator": "boy",
                }
            ],
            "time_range": "No filter",
        },
    )
    apply_form_data_filters_to_query(query, form_data)

    assert query["filters"] == [
        {"col": "country", "op": "==", "val": "US"},
        {"col": "gender", "op": "==", "val": "boy"},
    ]
    assert query["time_range"] == "No filter"


def test_build_query_dicts_from_form_data_uses_raw_all_columns(monkeypatch):
    monkeypatch.setattr(
        "superset.mcp_service.chart.chart_helpers.resolve_datasource_engine",
        lambda datasource_id, datasource_type: "base",
    )
    form_data = {
        "viz_type": "handlebars",
        "query_mode": "raw",
        "all_columns": ["state", "city"],
        "adhoc_filters": [],
    }

    queries = build_query_dicts_from_form_data(form_data, 1, "table")

    assert queries == [
        {
            "columns": ["state", "city"],
            "metrics": [],
            "filters": [],
        }
    ]


def test_merge_form_data_filters_into_query_applies_regular_overrides():
    query = {
        "filters": [{"col": "country", "op": "==", "val": "US"}],
        "time_range": "Last year",
        "granularity": "created_at",
        "time_grain": "P1Y",
        "time_grain_sqla": "P1Y",
        "where": "region = 'NA'",
        "having": "SUM(num) > 10",
    }

    merge_form_data_filters_into_query(
        query,
        {
            "filters": [{"col": "gender", "op": "==", "val": "boy"}],
            "time_range": "No filter",
            "granularity": "updated_at",
            "time_grain": "P1D",
            "time_grain_sqla": "P1D",
            "where": "name IS NOT NULL",
            "having": "COUNT(*) > 1",
        },
    )

    assert query["filters"] == [
        {"col": "country", "op": "==", "val": "US"},
        {"col": "gender", "op": "==", "val": "boy"},
    ]
    assert query["time_range"] == "No filter"
    assert query["granularity"] == "updated_at"
    assert query["time_grain"] == "P1D"
    assert query["time_grain_sqla"] == "P1D"
    assert query["where"] == "(region = 'NA') AND (name IS NOT NULL)"
    assert query["having"] == "(SUM(num) > 10) AND (COUNT(*) > 1)"


def test_merge_extra_form_data_filters_into_query_adds_only_extra_predicates(
    monkeypatch,
):
    monkeypatch.setattr(
        "superset.mcp_service.chart.chart_helpers.resolve_datasource_engine",
        lambda datasource_id, datasource_type: "base",
    )
    query = {
        "filters": [{"col": "country", "op": "==", "val": "US"}],
        "time_range": "Last year",
        "granularity": "created_at",
        "time_grain_sqla": "P1Y",
    }

    merge_extra_form_data_filters_into_query(
        query,
        {
            "filters": [{"col": "gender", "op": "==", "val": "boy"}],
            "granularity_sqla": "updated_at",
            "time_range": "No filter",
            "time_grain_sqla": "P1D",
        },
        1,
        "table",
    )

    assert query["filters"] == [
        {"col": "country", "op": "==", "val": "US"},
        {"col": "gender", "op": "==", "val": "boy"},
    ]
    assert query["time_range"] == "No filter"
    assert query["granularity"] == "updated_at"
    assert query["time_grain_sqla"] == "P1D"
