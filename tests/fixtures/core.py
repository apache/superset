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
import json


def bad_database_test_conn_request():
    return json.dumps(
        {"uri": "mssql+pymssql://url", "name": "examples", "impersonate_user": False,}
    )


def create_query_editor_request():
    return {
        "queryEditor": json.dumps(
            {
                "title": "Untitled Query 1",
                "dbId": 1,
                "schema": None,
                "autorun": False,
                "sql": "SELECT ...",
                "queryLimit": 1000,
            }
        )
    }


def dist_bar_form_data(table_id):
    return {
        "datasource": f"{table_id}__table",
        "viz_type": "dist_bar",
        "url_params": {},
        "time_range_endpoints": ["inclusive", "exclusive"],
        "granularity_sqla": "ds",
        "time_range": 'DATEADD(DATETIME("2021-01-22T00:00:00"), -100, year) : 2021-01-22T00:00:00',
        "metrics": [
            {
                "expressionType": "SIMPLE",
                "column": {
                    "id": 334,
                    "column_name": "name",
                    "verbose_name": "null",
                    "description": "null",
                    "expression": "",
                    "filterable": True,
                    "groupby": True,
                    "is_dttm": False,
                    "type": "VARCHAR(255)",
                    "python_date_format": "null",
                },
                "aggregate": "COUNT",
                "sqlExpression": "null",
                "isNew": False,
                "hasCustomLabel": False,
                "label": "COUNT(name)",
                "optionName": "metric_xdzsijn42f9_khi4h3v3vci",
            },
            {
                "expressionType": "SIMPLE",
                "column": {
                    "id": 332,
                    "column_name": "ds",
                    "verbose_name": "null",
                    "description": "null",
                    "expression": "",
                    "filterable": True,
                    "groupby": True,
                    "is_dttm": True,
                    "type": "TIMESTAMP WITHOUT TIME ZONE",
                    "python_date_format": "null",
                },
                "aggregate": "COUNT",
                "sqlExpression": "null",
                "isNew": False,
                "hasCustomLabel": False,
                "label": "COUNT(ds)",
                "optionName": "metric_80g1qb9b6o7_ci5vquydcbe",
            },
        ],
        "adhoc_filters": [],
        "groupby": ["name"],
        "columns": [],
        "row_limit": 10,
        "color_scheme": "supersetColors",
        "label_colors": {},
        "show_legend": True,
        "y_axis_format": "SMART_NUMBER",
        "bottom_margin": "auto",
        "x_ticks_layout": "auto",
    }
