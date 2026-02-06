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

# pylint: disable=import-outside-toplevel, invalid-name, unused-argument, redefined-outer-name
import pytest
from marshmallow import ValidationError

from superset.datasets.schemas import validate_python_date_format


# pylint: disable=too-few-public-methods
@pytest.mark.parametrize(
    "payload",
    [
        "epoch_ms",
        "epoch_s",
        "%Y-%m-%dT%H:%M:%S.%f",
        "%Y%m%d",
    ],
)
def test_validate_python_date_format(payload) -> None:
    assert validate_python_date_format(payload)


@pytest.mark.parametrize(
    "payload",
    [
        "%d%m%Y",
        "%Y/%m/%dT%H:%M:%S.%f",
    ],
)
def test_validate_python_date_format_raises(payload) -> None:
    with pytest.raises(ValidationError):
        validate_python_date_format(payload)


def test_dataset_put_schema_includes_currency_code_column() -> None:
    """Test that DatasetPutSchema properly handles currency_code_column field."""
    from superset.datasets.schemas import DatasetPutSchema

    schema = DatasetPutSchema()

    # Dataset with currency code column
    data = {
        "currency_code_column": "currency",
    }
    result = schema.load(data)
    assert result["currency_code_column"] == "currency"


def test_dataset_put_schema_currency_code_column_optional() -> None:
    """Test that currency_code_column is optional in DatasetPutSchema."""
    from superset.datasets.schemas import DatasetPutSchema

    schema = DatasetPutSchema()

    # Dataset without currency code column (should not fail)
    data: dict[str, str | None] = {}
    result = schema.load(data)
    assert (
        "currency_code_column" not in result
        or result.get("currency_code_column") is None
    )


def test_dataset_metrics_put_schema_parses_currency_string() -> None:
    """Test that DatasetMetricsPutSchema parses string currency payloads."""
    from superset.datasets.schemas import DatasetMetricsPutSchema

    schema = DatasetMetricsPutSchema()
    data = {
        "expression": "SUM(amount)",
        "metric_name": "sum_amount",
        "currency": '{"symbol": "EUR", "symbolPosition": "suffix"}',
    }
    result = schema.load(data)
    assert result["currency"] == {"symbol": "EUR", "symbolPosition": "suffix"}


def test_dataset_metrics_put_schema_parses_python_dict_string() -> None:
    """Test that DatasetMetricsPutSchema parses Python dict currency strings."""
    from superset.datasets.schemas import DatasetMetricsPutSchema

    schema = DatasetMetricsPutSchema()
    data = {
        "expression": "SUM(amount)",
        "metric_name": "sum_amount",
        "currency": "{'symbol': 'GBP', 'symbolPosition': 'prefix'}",
    }
    result = schema.load(data)
    assert result["currency"] == {"symbol": "GBP", "symbolPosition": "prefix"}


def test_dataset_metrics_put_schema_handles_malformed_currency() -> None:
    """Test that DatasetMetricsPutSchema normalizes malformed currency strings."""
    from superset.datasets.schemas import DatasetMetricsPutSchema

    schema = DatasetMetricsPutSchema()
    data = {
        "expression": "SUM(amount)",
        "metric_name": "sum_amount",
        "currency": "not valid json",
    }
    result = schema.load(data)
    assert result["currency"] == {}


def test_import_v1_metric_schema_parses_currency_string() -> None:
    """Test that ImportV1MetricSchema parses string currency payloads."""
    from superset.datasets.schemas import ImportV1MetricSchema

    schema = ImportV1MetricSchema()
    data = {
        "metric_name": "sum_amount",
        "expression": "SUM(amount)",
        "currency": '{"symbol": "CAD", "symbolPosition": "suffix"}',
    }
    result = schema.load(data)
    assert result["currency"] == {"symbol": "CAD", "symbolPosition": "suffix"}
