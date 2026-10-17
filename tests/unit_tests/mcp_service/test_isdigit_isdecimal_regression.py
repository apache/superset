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
"""Regression tests for the isdigit() -> isdecimal() swap across the
mcp_service identifier-resolution call sites.

``str.isdigit()`` returns ``True`` for Unicode "digit" characters
(category ``No``, e.g. the superscript "²") that ``int()`` cannot parse,
while ``str.isdecimal()`` only accepts base-10 digit characters that
``int()`` can always convert. Each resolver below takes a numeric-or-uuid
identifier and must fall through to the UUID (or slug) lookup branch for
a non-decimal digit string instead of attempting ``int()`` and raising
``ValueError``.
"""

from unittest.mock import patch

# "²" (superscript two): isdigit() is True, isdecimal() is False.
NON_DECIMAL_DIGIT = "²"


@patch("superset.daos.chart.ChartDAO.find_by_id")
def test_chart_helpers_find_chart_by_identifier_non_decimal_digit(mock_find) -> None:
    from superset.mcp_service.chart.chart_helpers import find_chart_by_identifier

    mock_find.return_value = None
    result = find_chart_by_identifier(NON_DECIMAL_DIGIT)

    mock_find.assert_called_once_with(NON_DECIMAL_DIGIT, id_column="uuid")
    assert result is None


@patch("superset.daos.chart.ChartDAO.find_by_id")
def test_get_chart_sql_find_chart_by_identifier_non_decimal_digit(mock_find) -> None:
    from superset.mcp_service.chart.tool.get_chart_sql import (
        _find_chart_by_identifier,
    )

    mock_find.return_value = None
    result = _find_chart_by_identifier(NON_DECIMAL_DIGIT)

    mock_find.assert_called_once_with(NON_DECIMAL_DIGIT, id_column="uuid")
    assert result is None


@patch("superset.daos.dataset.DatasetDAO.find_by_id")
def test_update_chart_preview_find_dataset_non_decimal_digit(mock_find) -> None:
    from superset.mcp_service.chart.tool.update_chart_preview import _find_dataset

    mock_find.return_value = None
    result = _find_dataset(NON_DECIMAL_DIGIT)

    mock_find.assert_called_once_with(NON_DECIMAL_DIGIT, id_column="uuid")
    assert result is None


@patch("superset.daos.dashboard.DashboardDAO.get_by_id_or_slug")
@patch("superset.daos.dashboard.DashboardDAO.find_by_id")
def test_delete_dashboard_find_by_identifier_non_decimal_digit(
    mock_find, mock_get_by_id_or_slug
) -> None:
    from superset.mcp_service.dashboard.tool.delete_dashboard import (
        _find_dashboard_by_identifier,
    )

    mock_find.return_value = None
    mock_get_by_id_or_slug.return_value = None
    result = _find_dashboard_by_identifier(NON_DECIMAL_DIGIT)

    mock_find.assert_called_once_with(NON_DECIMAL_DIGIT, id_column="uuid")
    mock_get_by_id_or_slug.assert_called_once_with(NON_DECIMAL_DIGIT)
    assert result is None


@patch("superset.daos.dataset.DatasetDAO.find_by_id")
def test_dataset_validator_get_dataset_context_non_decimal_digit(mock_find) -> None:
    from superset.mcp_service.chart.validation.dataset_validator import (
        DatasetValidator,
    )

    mock_find.return_value = None
    result = DatasetValidator._get_dataset_context(NON_DECIMAL_DIGIT)

    mock_find.assert_called_once_with(NON_DECIMAL_DIGIT, id_column="uuid")
    assert result is None


@patch("superset.mcp_service.chart.chart_utils.get_superset_base_url")
@patch("superset.daos.dataset.DatasetDAO.find_by_id")
def test_chart_utils_generate_explore_link_non_decimal_digit(
    mock_find, mock_base_url
) -> None:
    from superset.mcp_service.chart.chart_utils import generate_explore_link

    mock_find.return_value = None
    mock_base_url.return_value = "http://localhost:9001"

    result = generate_explore_link(NON_DECIMAL_DIGIT, {"viz_type": "table"})

    mock_find.assert_called_once_with(NON_DECIMAL_DIGIT, id_column="uuid")
    assert NON_DECIMAL_DIGIT in result


def test_chart_helpers_resolve_form_data_datasource_non_decimal_digit() -> None:
    """The combined ``"<id>__<type>"`` split must not attempt ``int()`` on a
    non-decimal digit id half, or it raises instead of passing the id
    through as a string for downstream uuid resolution."""
    from superset.mcp_service.chart.chart_helpers import (
        resolve_form_data_datasource,
    )

    datasource_id, datasource_type = resolve_form_data_datasource(
        {"datasource": f"{NON_DECIMAL_DIGIT}__table"}
    )

    assert datasource_id == NON_DECIMAL_DIGIT
    assert datasource_type == "table"


def test_get_chart_sql_resolve_datasource_name_non_decimal_digit() -> None:
    """Same combined-id split guard inside the unsaved-chart datasource-name
    resolver used by ``get_chart_sql``."""
    from superset.mcp_service.chart.tool.get_chart_sql import (
        _resolve_datasource_name,
    )

    with patch("superset.daos.datasource.DatasourceDAO.get_datasource") as mock_get:
        mock_get.return_value = None
        _resolve_datasource_name(
            {"datasource": f"{NON_DECIMAL_DIGIT}__table"},
            chart=None,
        )

    # No int() ValueError raised; the non-decimal id half is passed through.
    mock_get.assert_called_once()
    assert mock_get.call_args.kwargs["database_id_or_uuid"] == NON_DECIMAL_DIGIT
