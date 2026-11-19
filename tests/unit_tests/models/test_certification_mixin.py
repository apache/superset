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
from superset.connectors.sqla.models import SqlMetric, TableColumn
from superset.utils import json


def test_certification_setters_write_through_to_extra() -> None:
    column = TableColumn(column_name="a", extra='{"other": 1}')

    column.certified_by = "Data Platform"
    column.certification_details = "Reviewed"
    column.warning_markdown = "**warn**"

    assert json.loads(column.extra) == {
        "other": 1,
        "certification": {"certified_by": "Data Platform", "details": "Reviewed"},
        "warning_markdown": "**warn**",
    }
    assert column.is_certified is True
    assert column.certified_by == "Data Platform"
    assert column.certification_details == "Reviewed"
    assert column.warning_markdown == "**warn**"


def test_certification_setters_clear_on_empty() -> None:
    extra = json.dumps(
        {
            "certification": {"certified_by": "x", "details": "y"},
            "warning_markdown": "w",
        }
    )
    metric = SqlMetric(metric_name="m", expression="1", extra=extra)

    metric.certified_by = None
    assert json.loads(metric.extra)["certification"] == {"details": "y"}
    metric.certification_details = ""
    assert "certification" not in json.loads(metric.extra)
    metric.warning_markdown = None
    assert json.loads(metric.extra) == {}
    assert metric.is_certified is False


def test_is_certified_false_clears_certification() -> None:
    column = TableColumn(
        column_name="a",
        extra='{"certification": {"certified_by": "x"}, "warning_markdown": "w"}',
    )

    column.is_certified = True
    assert column.certified_by == "x"
    column.is_certified = False
    assert json.loads(column.extra) == {"warning_markdown": "w"}


def test_constructor_applies_flat_keys_after_extra() -> None:
    column = TableColumn(
        column_name="a",
        extra='{"certification": {"certified_by": "old"}}',
        certified_by="new",
    )

    assert column.certified_by == "new"
