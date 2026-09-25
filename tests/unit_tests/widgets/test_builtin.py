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

from unittest.mock import MagicMock

from superset.exceptions import SupersetSecurityException
from superset.widgets.builtin import FilterSelect
from superset.widgets.registry import registry


def test_filter_select_registered() -> None:
    assert registry.get("filter.select") is FilterSelect


def test_filter_bar_registered() -> None:
    assert registry.get("filter.bar") is not None


def test_filter_select_dataset_enum_lists_viewable_datasets(mocker) -> None:
    # `name` is a reserved `MagicMock.__init__` kwarg (it names the mock
    # itself for repr), so it has to be set as an attribute afterward rather
    # than passed in the constructor like `id`.
    dataset_a = MagicMock(id=1)
    dataset_a.name = "main.sales"
    dataset_b = MagicMock(id=2)
    dataset_b.name = "birth_names"
    mocker.patch(
        "superset.widgets.builtin.DatasetDAO.find_all",
        return_value=[dataset_a, dataset_b],
    )

    widget = registry.get("filter.select")
    assert widget is not None
    schema = widget.get_control_schema(None, None)

    assert schema["properties"]["datasetId"]["enum"] == [1, 2]
    assert schema["properties"]["datasetId"]["x-enumNames"] == [
        "main.sales",
        "birth_names",
    ]


def test_filter_select_dataset_enum_blank_without_viewable_datasets(mocker) -> None:
    mocker.patch("superset.widgets.builtin.DatasetDAO.find_all", return_value=[])

    widget = registry.get("filter.select")
    assert widget is not None
    schema = widget.get_control_schema(None, None)

    assert schema["properties"]["datasetId"]["enum"] == []
    assert schema["properties"]["datasetId"]["x-enumNames"] == []


def test_filter_select_column_enum_blank_without_dataset(mocker) -> None:
    mocker.patch("superset.widgets.builtin.DatasetDAO.find_all", return_value=[])

    widget = registry.get("filter.select")
    assert widget is not None
    schema = widget.get_control_schema(None, None)
    assert schema["properties"]["column"]["enum"] == []


def test_filter_select_column_enum_populated_from_dataset(mocker) -> None:
    mocker.patch("superset.widgets.builtin.DatasetDAO.find_all", return_value=[])
    dataset = MagicMock()
    dataset.filterable_column_names = ["region", "product_line"]
    mocker.patch("superset.widgets.builtin.DatasetDAO.find_by_id", return_value=dataset)

    widget = registry.get("filter.select")
    assert widget is not None
    # A column already chosen (unlike the payload-shape test above, which
    # covers the moment right after picking a dataset, before `column` has
    # ever been set) — re-fetching still enriches the enum, and still
    # includes the already-selected value alongside the rest.
    schema = widget.get_control_schema({"datasetId": 1, "column": "region"}, None)

    assert schema["properties"]["column"]["enum"] == ["region", "product_line"]
    dataset.raise_for_access.assert_called_once()


def test_filter_select_column_enum_populated_before_column_is_ever_set(
    mocker,
) -> None:
    # The control panel only posts `column` once the author has actually
    # touched it — right after picking a dataset, `control_values` is just
    # `{"datasetId": 1}`, with no `column` key at all (unlike the fixture
    # above, which always includes one). `column` needs a default for this
    # payload to validate at all; without one, `parsed` silently falls back
    # to `None` and `dataset_id` below is never seen.
    mocker.patch("superset.widgets.builtin.DatasetDAO.find_all", return_value=[])
    dataset = MagicMock()
    dataset.filterable_column_names = ["region", "product_line"]
    mocker.patch("superset.widgets.builtin.DatasetDAO.find_by_id", return_value=dataset)

    widget = registry.get("filter.select")
    assert widget is not None
    schema = widget.get_control_schema({"datasetId": 1}, None)

    assert schema["properties"]["column"]["enum"] == ["region", "product_line"]


def test_filter_select_column_enum_blank_on_access_denied(mocker) -> None:
    mocker.patch("superset.widgets.builtin.DatasetDAO.find_all", return_value=[])
    dataset = MagicMock()
    dataset.raise_for_access.side_effect = SupersetSecurityException(mocker.MagicMock())
    mocker.patch("superset.widgets.builtin.DatasetDAO.find_by_id", return_value=dataset)

    widget = registry.get("filter.select")
    assert widget is not None
    schema = widget.get_control_schema({"datasetId": 1}, None)

    assert schema["properties"]["column"]["enum"] == []
