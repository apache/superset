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
from typing import Any
from unittest.mock import Mock


def get_column_mock(params: dict[str, Any]) -> Mock:
    mock = Mock()
    mock.id = params["id"]
    mock.column_name = params["column_name"]
    mock.verbose_name = params["verbose_name"]
    mock.description = params["description"]
    mock.expression = params["expression"]
    mock.filterable = params["filterable"]
    mock.groupby = params["groupby"]
    mock.is_dttm = params["is_dttm"]
    mock.type = params["type"]
    return mock


def get_metric_mock(params: dict[str, Any]) -> Mock:
    mock = Mock()
    mock.id = params["id"]
    mock.metric_name = params["metric_name"]
    mock.metric_name = params["verbose_name"]
    mock.description = params["description"]
    mock.expression = params["expression"]
    mock.warning_text = params["warning_text"]
    mock.d3format = params["d3format"]
    return mock


def get_dataset_mock() -> Mock:
    mock = Mock()
    mock.id = None
    mock.column_formats = {"ratio": ".2%"}
    mock.database = {"id": 1}
    mock.description = "Adding a DESCRip"
    mock.default_endpoint = ""
    mock.filter_select_enabled = True
    mock.name = "birth_names"
    mock.table_name = "birth_names"
    mock.datasource_name = "birth_names"
    mock.type = "table"
    mock.schema = None
    mock.offset = 66
    mock.cache_timeout = 55
    mock.sql = ""
    mock.columns = [
        get_column_mock(
            {
                "id": 504,
                "column_name": "ds",
                "verbose_name": "",
                "description": None,
                "expression": "",
                "filterable": True,
                "groupby": True,
                "is_dttm": True,
                "type": "DATETIME",
            }
        ),
        get_column_mock(
            {
                "id": 505,
                "column_name": "gender",
                "verbose_name": None,
                "description": None,
                "expression": "",
                "filterable": True,
                "groupby": True,
                "is_dttm": False,
                "type": "VARCHAR(16)",
            }
        ),
        get_column_mock(
            {
                "id": 506,
                "column_name": "name",
                "verbose_name": None,
                "description": None,
                "expression": None,
                "filterable": True,
                "groupby": True,
                "is_dttm": None,
                "type": "VARCHAR(255)",
            }
        ),
        get_column_mock(
            {
                "id": 508,
                "column_name": "state",
                "verbose_name": None,
                "description": None,
                "expression": None,
                "filterable": True,
                "groupby": True,
                "is_dttm": None,
                "type": "VARCHAR(10)",
            }
        ),
        get_column_mock(
            {
                "id": 509,
                "column_name": "num_boys",
                "verbose_name": None,
                "description": None,
                "expression": None,
                "filterable": True,
                "groupby": True,
                "is_dttm": None,
                "type": "BIGINT(20)",
            }
        ),
        get_column_mock(
            {
                "id": 510,
                "column_name": "num_girls",
                "verbose_name": None,
                "description": None,
                "expression": "",
                "filterable": False,
                "groupby": False,
                "is_dttm": False,
                "type": "BIGINT(20)",
            }
        ),
        get_column_mock(
            {
                "id": 532,
                "column_name": "num",
                "verbose_name": None,
                "description": None,
                "expression": None,
                "filterable": True,
                "groupby": True,
                "is_dttm": None,
                "type": "BIGINT(20)",
            }
        ),
        get_column_mock(
            {
                "id": 522,
                "column_name": "num_california",
                "verbose_name": None,
                "description": None,
                "expression": "CASE WHEN state = 'CA' THEN num ELSE 0 END",
                "filterable": False,
                "groupby": False,
                "is_dttm": False,
                "type": "NUMBER",
            }
        ),
    ]
    mock.metrics = (
        [
            get_metric_mock(
                {
                    "id": 824,
                    "metric_name": "sum__num",
                    "verbose_name": "Babies",
                    "description": "",
                    "expression": "SUM(num)",
                    "warning_text": "",
                    "d3format": "",
                }
            ),
            get_metric_mock(
                {
                    "id": 836,
                    "metric_name": "count",
                    "verbose_name": "",
                    "description": None,
                    "expression": "count(1)",
                    "warning_text": None,
                    "d3format": None,
                }
            ),
            get_metric_mock(
                {
                    "id": 843,
                    "metric_name": "ratio",
                    "verbose_name": "Ratio Boys/Girls",
                    "description": "This represents the ratio of boys/girls",
                    "expression": "sum(num_boys) / sum(num_girls)",
                    "warning_text": "no warning",
                    "d3format": ".2%",
                }
            ),
        ],
    )
    return mock
