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
from typing import Any

import pytest
from marshmallow import ValidationError
from pytest_mock import MockerFixture

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


def test_drill_info_user_schema_does_not_expose_email() -> None:
    """
    Regression test: the drill_info-local ``UserSchema`` used to declare an
    ``email`` field. ``DatasetDrillInfoSchema`` nests it (unfiltered by
    ``select_columns``) for both ``created_by`` and ``changed_by``, so any
    user with dataset-read access -- or, via the dashboard fallback,
    embedded guests -- received maintainer email addresses. Dataset-read
    access does not imply entitlement to other users' PII.
    """
    from superset.datasets.schemas import UserSchema

    class _FakeUser:
        first_name = "Jane"
        last_name = "Doe"
        email = "jane.doe@example.com"

    dumped = UserSchema().dump(_FakeUser())
    assert "email" not in dumped
    assert dumped == {"first_name": "Jane", "last_name": "Doe"}


def test_drill_info_editor_schema_does_not_expose_secondary_label() -> None:
    """
    Regression test: ``DatasetDrillInfoSchema.editors`` used to nest the
    shared ``SubjectResponseSchema``, which includes ``secondary_label``.
    For a user-backed Subject, user-subject synchronization
    (``superset.subjects.sync.sync_user_subject``) stores that user's email
    in ``secondary_label``, so nesting it unfiltered leaked the same
    maintainer PII that dropping ``email`` from ``UserSchema`` was meant to
    close, just under a different field name.
    """
    from superset.datasets.schemas import DrillInfoEditorSchema

    class _FakeEditorSubject:
        id = 1
        label = "Jane Doe"
        secondary_label = "jane.doe@example.com"
        img = "avatar.png"
        type = 1

    dumped = DrillInfoEditorSchema().dump(_FakeEditorSubject())
    assert "secondary_label" not in dumped
    assert dumped == {"id": 1, "label": "Jane Doe", "img": "avatar.png", "type": 1}


class _FakeDrillInfoColumn:
    def __init__(self, column_name: str, groupby: bool, verbose_name: str | None):
        self.column_name = column_name
        self.groupby = groupby
        self.verbose_name = verbose_name


class _FakeDrillInfoMetric:
    def __init__(self, metric_name: str, verbose_name: str | None):
        self.metric_name = metric_name
        self.verbose_name = verbose_name


class _FakeDrillInfoDataset:
    id = 1
    table_name = "test_dataset"
    editors: list[Any] = []
    created_by = None
    changed_by = None
    created_on_humanized = "now"
    changed_on_humanized = "now"
    # "value" is a non-dimension column: a raw-records table can select it, so the
    # results grid needs its label, but the drill-by picker must not offer it. The
    # metric also named "value" exists because uniqueness is only enforced within
    # each list, so both lists have to survive serialization independently.
    columns = [
        _FakeDrillInfoColumn("category", groupby=True, verbose_name="Category Column"),
        _FakeDrillInfoColumn("value", groupby=False, verbose_name="Raw Value"),
    ]
    metrics = [
        _FakeDrillInfoMetric("sum__value", verbose_name="Yearly Total"),
        _FakeDrillInfoMetric("value", verbose_name="Raw Value Metric"),
        _FakeDrillInfoMetric("count", verbose_name=None),
    ]


def _dump_drill_info(mocker: MockerFixture, *, is_guest: bool) -> dict[str, Any]:
    from superset.datasets.schemas import DatasetDrillInfoSchema

    mocker.patch(
        "superset.datasets.schemas.security_manager.is_guest_user",
        return_value=is_guest,
    )
    return DatasetDrillInfoSchema().dump(_FakeDrillInfoDataset())


def test_drill_info_returns_columns_and_metrics_unfiltered(
    mocker: MockerFixture,
) -> None:
    """
    Both lists are returned whole, because this response resolves display labels
    for the dashboard "View as table" results grid and a chart may select any
    column or metric -- a raw-records table routinely selects non-dimension
    columns. ``groupby`` rides along so the drill-by picker can narrow to
    dimensions client-side, which is where that concern belongs; narrowing here
    would strip the labels the grid needs.
    """
    dumped = _dump_drill_info(mocker, is_guest=False)

    assert dumped["columns"] == [
        {
            "column_name": "category",
            "verbose_name": "Category Column",
            "groupby": True,
        },
        {"column_name": "value", "verbose_name": "Raw Value", "groupby": False},
    ]
    assert dumped["metrics"] == [
        {"metric_name": "sum__value", "verbose_name": "Yearly Total"},
        {"metric_name": "value", "verbose_name": "Raw Value Metric"},
        {"metric_name": "count", "verbose_name": None},
    ]


def test_drill_info_guest_payload_keeps_labels(mocker: MockerFixture) -> None:
    """
    Guests reach this endpoint only through the dashboard fallback, which first
    verifies they can access a dashboard built on the dataset, and they see the
    same labels rendered in that dashboard's charts. The branch stays minimal in
    every other respect -- no table name, editors, or audit fields.
    """
    dumped = _dump_drill_info(mocker, is_guest=True)

    assert set(dumped) == {"id", "columns", "metrics"}
    assert [col["column_name"] for col in dumped["columns"]] == ["category", "value"]
    assert dumped["metrics"] == [
        {"metric_name": "sum__value", "verbose_name": "Yearly Total"},
        {"metric_name": "value", "verbose_name": "Raw Value Metric"},
        {"metric_name": "count", "verbose_name": None},
    ]


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
