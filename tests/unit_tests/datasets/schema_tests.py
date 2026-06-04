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


def test_dataset_post_schema_has_all_put_scalar_fields() -> None:
    """
    Every scalar model field accepted by DatasetPutSchema should also be accepted
    by DatasetPostSchema, unless it is intentionally excluded (fields that only
    make sense after a dataset already exists).

    This prevents the class of bug where a new column is added to the update
    schema but forgotten in the create schema.
    """
    from superset.datasets.schemas import DatasetPostSchema, DatasetPutSchema

    # Fields that are intentionally only on Put: they require an existing dataset
    # or are populated server-side during creation.
    put_only_fields = {
        "columns",
        "metrics",
        "folders",
        "database_id",  # Post uses "database" (integer id) instead
        "description",
        "main_dttm_col",
        "filter_select_enabled",
        "fetch_values_predicate",
        "offset",
        "default_endpoint",
        "cache_timeout",
        "is_sqllab_view",
        "extra",
    }

    put_fields = set(DatasetPutSchema().fields.keys())
    post_fields = set(DatasetPostSchema().fields.keys())

    missing = put_fields - post_fields - put_only_fields
    assert missing == set(), (
        f"Fields {missing} are in DatasetPutSchema but missing from "
        f"DatasetPostSchema. Either add them to DatasetPostSchema or to "
        f"the put_only_fields exclusion list in this test."
    )


def test_dataset_post_schema_includes_currency_code_column() -> None:
    """Test that DatasetPostSchema accepts currency_code_column."""
    from superset.datasets.schemas import DatasetPostSchema

    schema = DatasetPostSchema()
    data = {
        "database": 1,
        "table_name": "virtual_dataset",
        "currency_code_column": "currency",
    }
    result = schema.load(data)
    assert result["currency_code_column"] == "currency"


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
