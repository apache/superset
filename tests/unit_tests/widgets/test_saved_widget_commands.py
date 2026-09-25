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
from __future__ import annotations

import uuid
from typing import Any
from unittest.mock import MagicMock

import pytest
from marshmallow import ValidationError
from pytest_mock import MockerFixture
from superset_core.widgets import Widget, WidgetDataNotSupportedError

from superset.commands.chart.exceptions import ChartDataQueryFailedError
from superset.commands.widget.data import (
    resolve_widget,
    WidgetDataCommand,
    WidgetValuesCommand,
)
from superset.commands.widget.exceptions import (
    SavedWidgetForbiddenError,
    SavedWidgetNotFoundError,
    WidgetInvalidError,
)
from superset.commands.widget.saved import (
    CreateSavedWidgetCommand,
    UpdateSavedWidgetCommand,
)
from superset.exceptions import SupersetSecurityException
from superset.widgets.data import (
    props_dataset_id,
    validate_guest_inline_props,
    WidgetContext,
    WidgetDataError,
)
from superset.widgets.schemas import WidgetDataPostSchema

DATASET_ID = 17
BAR_PROPS: dict[str, Any] = {
    "dataBinding": {
        "datasetId": DATASET_ID,
        "metrics": ["sum__num"],
        "dimensions": ["state"],
    }
}


def _security(mocker: MockerFixture, *modules: str, guest: bool) -> MagicMock:
    sm = MagicMock()
    sm.is_guest_user.return_value = guest
    for module in modules:
        mocker.patch(f"{module}.security_manager", new=sm)
    return sm


def _datasource() -> MagicMock:
    datasource = MagicMock()
    datasource.column_names = ["state", "gender", "num"]
    datasource.columns = [
        MagicMock(column_name="state", groupby=True),
        MagicMock(column_name="gender", groupby=True),
        MagicMock(column_name="num", groupby=False),
    ]
    datasource.metrics = [MagicMock(metric_name="sum__num")]
    return datasource


def _saved_widget(props: dict[str, Any] | None = None) -> MagicMock:
    widget = MagicMock()
    widget.uuid = uuid.uuid4()
    widget.widget_type = "echarts"
    widget.props_dict = props or BAR_PROPS
    widget.created_by_fk = 2
    return widget


@pytest.mark.parametrize(
    "props, expected",
    [
        ({"dataBinding": {"datasetId": 7}}, 7),
        ({"datasetId": 3}, 3),
        ({"dataBinding": {"datasetId": "7"}}, None),
        ({"datasetId": True}, None),
        ({}, None),
        (None, None),
    ],
)
def test_props_dataset_id(props: Any, expected: int | None) -> None:
    assert props_dataset_id(props) == expected


def test_selector_schema_requires_exactly_one() -> None:
    schema = WidgetDataPostSchema()
    assert schema.load({"id": "x"}) == {"id": "x", "filters": []}
    with pytest.raises(ValidationError):
        schema.load({})
    with pytest.raises(ValidationError):
        schema.load({"id": "x", "widget": {"type": "echarts", "props": {}}})


def test_resolve_inline_for_user(mocker: MockerFixture) -> None:
    _security(mocker, "superset.commands.widget.data", guest=False)
    widget_cls, props, context = resolve_widget(
        {"widget": {"type": "echarts", "props": BAR_PROPS}}
    )
    assert issubclass(widget_cls, Widget)
    assert props is BAR_PROPS
    assert context == WidgetContext(DATASET_ID)


def test_resolve_inline_validates_props_via_registry(mocker: MockerFixture) -> None:
    _security(mocker, "superset.commands.widget.data", guest=False)
    with pytest.raises(WidgetInvalidError) as excinfo:
        resolve_widget({"widget": {"type": "metric-tile", "props": {"decimals": "x"}}})
    assert excinfo.value.errors

    with pytest.raises(WidgetInvalidError):
        resolve_widget({"widget": {"type": "not-a-widget", "props": {}}})


def test_resolve_inline_guest_needs_grant(mocker: MockerFixture) -> None:
    sm = _security(mocker, "superset.commands.widget.data", guest=True)
    sm.guest_widget_grants_dataset.return_value = False
    with pytest.raises(SavedWidgetForbiddenError):
        resolve_widget({"widget": {"type": "echarts", "props": BAR_PROPS}})


def test_resolve_inline_guest_is_hardened(mocker: MockerFixture) -> None:
    sm = _security(mocker, "superset.commands.widget.data", guest=True)
    sm.guest_widget_grants_dataset.return_value = True
    mocker.patch("superset.commands.widget.data.get_table", return_value=_datasource())
    resolve_widget({"widget": {"type": "echarts", "props": BAR_PROPS}})

    sql_metric = {
        "dataBinding": {
            "datasetId": DATASET_ID,
            "metrics": [{"expressionType": "SQL", "sqlExpression": "SUM(num)"}],
        }
    }
    with pytest.raises(WidgetDataError):
        resolve_widget({"widget": {"type": "echarts", "props": sql_metric}})


def test_resolve_saved_widget(mocker: MockerFixture) -> None:
    _security(mocker, "superset.commands.widget.utils", guest=False)
    saved = _saved_widget()
    mocker.patch(
        "superset.commands.widget.utils.SavedWidgetDAO.find_by_uuid",
        return_value=saved,
    )
    _, props, context = resolve_widget({"id": str(saved.uuid)})
    assert props == BAR_PROPS
    assert context == WidgetContext(DATASET_ID, str(saved.uuid))
    assert not context.inline


def test_resolve_saved_widget_guest_must_be_named(mocker: MockerFixture) -> None:
    sm = _security(mocker, "superset.commands.widget.utils", guest=True)
    sm.guest_token_names_widget.return_value = False
    mocker.patch(
        "superset.commands.widget.utils.SavedWidgetDAO.find_by_uuid",
        return_value=_saved_widget(),
    )
    with pytest.raises(SavedWidgetForbiddenError):
        resolve_widget({"id": "whatever"})


def test_resolve_unknown_saved_widget(mocker: MockerFixture) -> None:
    mocker.patch(
        "superset.commands.widget.utils.SavedWidgetDAO.find_by_uuid",
        return_value=None,
    )
    with pytest.raises(SavedWidgetNotFoundError):
        resolve_widget({"id": "missing"})


@pytest.mark.parametrize(
    "error, expected",
    [
        (WidgetDataNotSupportedError("markdown"), WidgetInvalidError),
        (WidgetDataError("no binding"), WidgetInvalidError),
        # A column the dataset does not have surfaces as a failed query, not as
        # a validation error: still the caller's mistake, so 400 not 500.
        (
            ChartDataQueryFailedError("Columns missing in dataset: ['gender']"),
            WidgetInvalidError,
        ),
        (SupersetSecurityException(MagicMock()), SavedWidgetForbiddenError),
    ],
)
def test_data_command_maps_errors(
    mocker: MockerFixture, error: Exception, expected: type[Exception]
) -> None:
    widget_cls = MagicMock()
    widget_cls.fetch_data.side_effect = error
    mocker.patch(
        "superset.commands.widget.data.resolve_widget",
        return_value=(widget_cls, BAR_PROPS, WidgetContext(DATASET_ID)),
    )
    with pytest.raises(expected):
        WidgetDataCommand({"id": "x"}, []).run()


def test_data_and_values_commands_dispatch(mocker: MockerFixture) -> None:
    widget_cls = MagicMock()
    widget_cls.fetch_data.return_value = {"columns": ["state"], "rows": []}
    widget_cls.fetch_values.return_value = ["boy", "girl"]
    context = WidgetContext(DATASET_ID)
    mocker.patch(
        "superset.commands.widget.data.resolve_widget",
        return_value=(widget_cls, BAR_PROPS, context),
    )
    filters = [{"column": "state", "operator": "IN", "value": ["CA"]}]

    assert WidgetDataCommand({"id": "x"}, filters).run()["columns"] == ["state"]
    widget_cls.fetch_data.assert_called_once_with(BAR_PROPS, filters, context)
    assert WidgetValuesCommand({"id": "x"}).run() == ["boy", "girl"]

    with pytest.raises(WidgetInvalidError):
        WidgetDataCommand({"id": "x"}, "not-a-list").run()


def test_guest_inline_props_accept_safe_shapes() -> None:
    validate_guest_inline_props(
        {
            "dataBinding": {
                "datasetId": DATASET_ID,
                "metrics": [
                    "sum__num",
                    {
                        "expressionType": "SIMPLE",
                        "aggregate": "sum",
                        "column": {"column_name": "num"},
                    },
                ],
                "dimensions": ["gender"],
                "filters": [
                    {
                        "expressionType": "SIMPLE",
                        "subject": "state",
                        "operator": "==",
                        "comparator": "CA",
                        "clause": "WHERE",
                    }
                ],
            }
        },
        _datasource(),
    )
    validate_guest_inline_props(
        {"datasetId": DATASET_ID, "column": "gender"}, _datasource()
    )


@pytest.mark.parametrize(
    "props",
    [
        {"dataBinding": {"metrics": ["not_a_metric"]}},
        {
            "dataBinding": {
                "metrics": [
                    {
                        "expressionType": "SIMPLE",
                        "aggregate": "SUM",
                        "column": {"column_name": "num"},
                        "sqlExpression": "1; DROP TABLE x",
                    }
                ]
            }
        },
        {
            "dataBinding": {
                "metrics": [
                    {
                        "expressionType": "SIMPLE",
                        "aggregate": "PERCENTILE",
                        "column": {"column_name": "num"},
                    }
                ]
            }
        },
        {"dataBinding": {"metrics": ["sum__num"], "dimensions": ["num"]}},
        {
            "dataBinding": {
                "metrics": ["sum__num"],
                "filters": [{"expressionType": "SQL", "sqlExpression": "1=1"}],
            }
        },
        {
            "dataBinding": {
                "metrics": ["sum__num"],
                "filters": [{"expressionType": "SIMPLE", "subject": "secret"}],
            }
        },
        {"datasetId": DATASET_ID, "column": "secret"},
    ],
)
def test_guest_inline_props_reject_unsafe_shapes(props: dict[str, Any]) -> None:
    with pytest.raises(WidgetDataError):
        validate_guest_inline_props(props, _datasource())


def test_create_rejects_guests_and_invalid_props(mocker: MockerFixture) -> None:
    _security(mocker, "superset.commands.widget.saved", guest=True)
    with pytest.raises(SavedWidgetForbiddenError):
        CreateSavedWidgetCommand(
            {"widget_type": "echarts", "props": BAR_PROPS}
        ).validate()

    _security(mocker, "superset.commands.widget.saved", guest=False)
    with pytest.raises(WidgetInvalidError):
        CreateSavedWidgetCommand(
            {"widget_type": "metric-tile", "props": {"decimals": "x"}}
        ).validate()
    CreateSavedWidgetCommand({"widget_type": "echarts", "props": BAR_PROPS}).validate()


def test_update_requires_owner_or_admin(mocker: MockerFixture) -> None:
    sm = _security(mocker, "superset.commands.widget.utils", guest=False)
    sm.is_admin.return_value = False
    mocker.patch(
        "superset.commands.widget.saved.SavedWidgetDAO.find_by_uuid",
        return_value=_saved_widget(),
    )
    user_id = mocker.patch("superset.commands.widget.utils.get_user_id", return_value=1)
    with pytest.raises(SavedWidgetForbiddenError):
        UpdateSavedWidgetCommand("x", {"title": "t"}).validate()

    user_id.return_value = 2
    UpdateSavedWidgetCommand("x", {"title": "t"}).validate()

    user_id.return_value = 1
    sm.is_admin.return_value = True
    UpdateSavedWidgetCommand("x", {"title": "t"}).validate()
