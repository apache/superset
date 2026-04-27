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
    extract_form_data_key_from_url,
    find_chart_by_identifier,
    get_cached_form_data,
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
