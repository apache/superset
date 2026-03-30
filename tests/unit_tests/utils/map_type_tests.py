#
# Licensed to the Apache Software Foundation (ASF) under one or more
# contributor license agreements.  See the NOTICE file distributed with
# this work for additional information regarding copyright ownership.
# The ASF licenses this file to You under the Apache License, Version 2.0
# (the "License"); you may not use this file except in compliance with
# the License.  You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#
from unittest.mock import MagicMock, patch

import pytest

from superset.connectors.sqla.models import SqlMetric
from superset.utils.core import (
    get_metric_type_from_column,
    map_sql_type_to_inferred_type,
)


def test_column_not_in_datasource():
    datasource = MagicMock(metrics=[])
    column = "non_existent_column"
    assert (get_metric_type_from_column(column, datasource)) == ""


def test_column_with_valid_operation():
    metric = SqlMetric(metric_name="my_column", expression="SUM(my_column)")
    datasource = MagicMock(metrics=[metric])
    column = "my_column"
    assert (get_metric_type_from_column(column, datasource)) == "floating"


def test_column_with_invalid_operation():
    metric = SqlMetric(metric_name="my_column", expression="INVALID(my_column)")
    datasource = MagicMock(metrics=[metric])
    column = "my_column"
    with patch("superset.utils.core.logger.warning") as mock_warning:
        assert (get_metric_type_from_column(column, datasource)) == ""
        mock_warning.assert_called_once()


def test_empty_datasource():
    datasource = MagicMock(metrics=[])
    column = "my_column"
    assert (get_metric_type_from_column(column, datasource)) == ""


def test_column_is_none():
    datasource = MagicMock(metrics=[])
    column = None
    assert (get_metric_type_from_column(column, datasource)) == ""


def test_datasource_is_none():
    datasource = None
    column = "my_column"
    with pytest.raises(AttributeError):
        get_metric_type_from_column(column, datasource)


def test_none_input():
    assert (map_sql_type_to_inferred_type(None)) == "string"


def test_empty_string_input():
    assert (map_sql_type_to_inferred_type("")) == "string"


def test_recognized_sql_type():
    assert (map_sql_type_to_inferred_type("INT")) == "integer"


def test_unrecognized_sql_type():
    assert (map_sql_type_to_inferred_type("unknown_type")) == "string"


def test_sql_type_with_special_chars():
    assert (map_sql_type_to_inferred_type("varchar(255)")) == "string"
