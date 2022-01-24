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
from typing import Any, Dict, List

# example V0 import/export format
dataset_ui_export: List[Dict[str, Any]] = [
    {
        "columns": [
            {
                "column_name": "num_california",
                "expression": "CASE WHEN state = 'CA' THEN num ELSE 0 END",
            },
            {"column_name": "ds", "is_dttm": True, "type": "DATETIME"},
            {"column_name": "state", "type": "VARCHAR(10)"},
            {"column_name": "gender", "type": "VARCHAR(16)"},
            {"column_name": "name", "type": "VARCHAR(255)"},
            {"column_name": "num_boys", "type": "BIGINT"},
            {"column_name": "num_girls", "type": "BIGINT"},
            {"column_name": "num", "type": "BIGINT"},
        ],
        "filter_select_enabled": True,
        "main_dttm_col": "ds",
        "metrics": [
            {
                "expression": "COUNT(*)",
                "metric_name": "count",
                "metric_type": "count",
                "verbose_name": "COUNT(*)",
            },
            {"expression": "SUM(num)", "metric_name": "sum__num"},
        ],
        "params": '{"remote_id": 3, "database_name": "examples", "import_time": 1604342885}',
        "table_name": "birth_names_2",
    }
]

dataset_cli_export: Dict[str, Any] = {
    "databases": [
        {
            "allow_run_async": True,
            "database_name": "examples",
            "sqlalchemy_uri": "sqlite:////Users/beto/.superset/superset.db",
            "tables": dataset_ui_export,
        }
    ]
}

dashboard_export: Dict[str, Any] = {
    "dashboards": [
        {
            "__Dashboard__": {
                "css": "",
                "dashboard_title": "Births 2",
                "description": None,
                "json_metadata": '{"timed_refresh_immune_slices": [], "expanded_slices": {}, "refresh_frequency": 0, "default_filters": "{}", "color_scheme": null, "remote_id": 1}',
                "position_json": '{"CHART--jvaBFZx78":{"children":[],"id":"CHART--jvaBFZx78","meta":{"chartId":83,"height":50,"sliceName":"Number of California Births","uuid":"c77bb4b3-09f4-4d9a-a9e2-66a627c64343","width":4},"parents":["ROOT_ID","GRID_ID","ROW-se_5H8KNiO"],"type":"CHART"},"DASHBOARD_VERSION_KEY":"v2","GRID_ID":{"children":["ROW-se_5H8KNiO"],"id":"GRID_ID","parents":["ROOT_ID"],"type":"GRID"},"HEADER_ID":{"id":"HEADER_ID","meta":{"text":"Births"},"type":"HEADER"},"ROOT_ID":{"children":["GRID_ID"],"id":"ROOT_ID","type":"ROOT"},"ROW-se_5H8KNiO":{"children":["CHART--jvaBFZx78"],"id":"ROW-se_5H8KNiO","meta":{"background":"BACKGROUND_TRANSPARENT"},"parents":["ROOT_ID","GRID_ID"],"type":"ROW"}}',
                "slices": [
                    {
                        "__Slice__": {
                            "cache_timeout": None,
                            "datasource_name": "birth_names_2",
                            "datasource_type": "table",
                            "id": 83,
                            "params": '{"adhoc_filters": [], "datasource": "3__table", "granularity_sqla": "ds", "header_font_size": 0.4, "metric": {"aggregate": "SUM", "column": {"column_name": "num_california", "expression": "CASE WHEN state = \'CA\' THEN num ELSE 0 END"}, "expressionType": "SIMPLE", "label": "SUM(num_california)"}, "slice_id": 83, "subheader_font_size": 0.15, "time_range": "100 years ago : now", "time_range_endpoints": ["unknown", "inclusive"], "url_params": {}, "viz_type": "big_number_total", "y_axis_format": "SMART_NUMBER", "remote_id": 83, "datasource_name": "birth_names_2", "schema": null, "database_name": "examples"}',
                            "slice_name": "Number of California Births",
                            "viz_type": "big_number_total",
                        }
                    }
                ],
                "slug": None,
            }
        }
    ],
    "datasources": [
        {
            "__SqlaTable__": {
                "cache_timeout": None,
                "columns": [
                    {
                        "__TableColumn__": {
                            "changed_by_fk": None,
                            "changed_on": {"__datetime__": "2020-10-07T15:50:00"},
                            "column_name": "ds",
                            "created_by_fk": None,
                            "created_on": {"__datetime__": "2020-10-07T15:50:00"},
                            "description": None,
                            "expression": None,
                            "filterable": True,
                            "groupby": True,
                            "id": 332,
                            "is_active": True,
                            "is_dttm": True,
                            "python_date_format": None,
                            "table_id": 3,
                            "type": "DATETIME",
                            "uuid": "98e22f20-ed71-4483-b09d-31780ed1fc1b",
                            "verbose_name": None,
                        }
                    },
                    {
                        "__TableColumn__": {
                            "changed_by_fk": None,
                            "changed_on": {"__datetime__": "2020-10-07T15:50:00"},
                            "column_name": "gender",
                            "created_by_fk": None,
                            "created_on": {"__datetime__": "2020-10-07T15:50:00"},
                            "description": None,
                            "expression": None,
                            "filterable": True,
                            "groupby": True,
                            "id": 333,
                            "is_active": True,
                            "is_dttm": False,
                            "python_date_format": None,
                            "table_id": 3,
                            "type": "VARCHAR(16)",
                            "uuid": "08e08f02-fb81-4461-bba6-c8c8dfef0c02",
                            "verbose_name": None,
                        }
                    },
                    {
                        "__TableColumn__": {
                            "changed_by_fk": None,
                            "changed_on": {"__datetime__": "2020-10-07T15:50:00"},
                            "column_name": "name",
                            "created_by_fk": None,
                            "created_on": {"__datetime__": "2020-10-07T15:50:00"},
                            "description": None,
                            "expression": None,
                            "filterable": True,
                            "groupby": True,
                            "id": 334,
                            "is_active": True,
                            "is_dttm": False,
                            "python_date_format": None,
                            "table_id": 3,
                            "type": "VARCHAR(255)",
                            "uuid": "c67b14d9-fc4b-427d-a363-a53af015fb5e",
                            "verbose_name": None,
                        }
                    },
                    {
                        "__TableColumn__": {
                            "changed_by_fk": None,
                            "changed_on": {"__datetime__": "2020-10-07T15:50:00"},
                            "column_name": "num",
                            "created_by_fk": None,
                            "created_on": {"__datetime__": "2020-10-07T15:50:00"},
                            "description": None,
                            "expression": None,
                            "filterable": True,
                            "groupby": True,
                            "id": 335,
                            "is_active": True,
                            "is_dttm": False,
                            "python_date_format": None,
                            "table_id": 3,
                            "type": "BIGINT",
                            "uuid": "69835b93-7169-4a2c-baa7-c1c92f21d10a",
                            "verbose_name": None,
                        }
                    },
                    {
                        "__TableColumn__": {
                            "changed_by_fk": None,
                            "changed_on": {"__datetime__": "2020-10-07T15:50:00"},
                            "column_name": "state",
                            "created_by_fk": None,
                            "created_on": {"__datetime__": "2020-10-07T15:50:00"},
                            "description": None,
                            "expression": None,
                            "filterable": True,
                            "groupby": True,
                            "id": 336,
                            "is_active": True,
                            "is_dttm": False,
                            "python_date_format": None,
                            "table_id": 3,
                            "type": "VARCHAR(10)",
                            "uuid": "80003ad0-bdd0-48d3-ade3-8d1838e07d7a",
                            "verbose_name": None,
                        }
                    },
                    {
                        "__TableColumn__": {
                            "changed_by_fk": None,
                            "changed_on": {"__datetime__": "2020-10-07T15:50:00"},
                            "column_name": "num_boys",
                            "created_by_fk": None,
                            "created_on": {"__datetime__": "2020-10-07T15:50:00"},
                            "description": None,
                            "expression": None,
                            "filterable": True,
                            "groupby": True,
                            "id": 337,
                            "is_active": True,
                            "is_dttm": False,
                            "python_date_format": None,
                            "table_id": 3,
                            "type": "BIGINT",
                            "uuid": "8373ed24-4d4e-4307-9eee-8deefeecbb57",
                            "verbose_name": None,
                        }
                    },
                    {
                        "__TableColumn__": {
                            "changed_by_fk": None,
                            "changed_on": {"__datetime__": "2020-10-07T15:50:00"},
                            "column_name": "num_girls",
                            "created_by_fk": None,
                            "created_on": {"__datetime__": "2020-10-07T15:50:00"},
                            "description": None,
                            "expression": None,
                            "filterable": True,
                            "groupby": True,
                            "id": 338,
                            "is_active": True,
                            "is_dttm": False,
                            "python_date_format": None,
                            "table_id": 3,
                            "type": "BIGINT",
                            "uuid": "46f2de5f-c008-4024-a163-0b5c5f1d5580",
                            "verbose_name": None,
                        }
                    },
                    {
                        "__TableColumn__": {
                            "changed_by_fk": None,
                            "changed_on": {"__datetime__": "2020-10-07T15:50:32"},
                            "column_name": "num_california",
                            "created_by_fk": None,
                            "created_on": {"__datetime__": "2020-10-07T15:50:32"},
                            "description": None,
                            "expression": "CASE WHEN state = 'CA' THEN num ELSE 0 END",
                            "filterable": True,
                            "groupby": True,
                            "id": 434,
                            "is_active": True,
                            "is_dttm": False,
                            "python_date_format": None,
                            "table_id": 3,
                            "type": None,
                            "uuid": "35e32aa6-be2b-4086-9c78-4ea3351ec079",
                            "verbose_name": None,
                        }
                    },
                ],
                "database_id": 1000,
                "default_endpoint": None,
                "description": None,
                "extra": None,
                "fetch_values_predicate": None,
                "filter_select_enabled": True,
                "main_dttm_col": "ds",
                "metrics": [
                    {
                        "__SqlMetric__": {
                            "changed_by_fk": None,
                            "changed_on": {"__datetime__": "2020-10-07T15:50:00"},
                            "created_by_fk": None,
                            "created_on": {"__datetime__": "2020-10-07T15:50:00"},
                            "d3format": None,
                            "description": None,
                            "expression": "COUNT(*)",
                            "extra": None,
                            "id": 9,
                            "metric_name": "count",
                            "metric_type": "count",
                            "table_id": 3,
                            "uuid": "1042ef50-ebf9-4271-b44e-3aaa891f6c21",
                            "verbose_name": "COUNT(*)",
                            "warning_text": None,
                        }
                    },
                    {
                        "__SqlMetric__": {
                            "changed_by_fk": None,
                            "changed_on": {"__datetime__": "2020-10-07T15:50:00"},
                            "created_by_fk": None,
                            "created_on": {"__datetime__": "2020-10-07T15:50:00"},
                            "d3format": None,
                            "description": None,
                            "expression": "SUM(num)",
                            "extra": None,
                            "id": 10,
                            "metric_name": "sum__num",
                            "metric_type": None,
                            "table_id": 3,
                            "uuid": "d807f208-e3c6-4b89-b790-41f521216ff6",
                            "verbose_name": None,
                            "warning_text": None,
                        }
                    },
                ],
                "offset": 0,
                "params": '{"remote_id": 3, "database_name": "examples", "import_time": 1604342885}',
                "schema": None,
                "sql": None,
                "table_name": "birth_names_2",
                "template_params": None,
            }
        }
    ],
}

# example V1 import/export format
database_metadata_config: Dict[str, Any] = {
    "version": "1.0.0",
    "type": "Database",
    "timestamp": "2020-11-04T21:27:44.423819+00:00",
}

dataset_metadata_config: Dict[str, Any] = {
    "version": "1.0.0",
    "type": "SqlaTable",
    "timestamp": "2020-11-04T21:27:44.423819+00:00",
}

chart_metadata_config: Dict[str, Any] = {
    "version": "1.0.0",
    "type": "Slice",
    "timestamp": "2020-11-04T21:27:44.423819+00:00",
}

dashboard_metadata_config: Dict[str, Any] = {
    "version": "1.0.0",
    "type": "Dashboard",
    "timestamp": "2020-11-04T21:27:44.423819+00:00",
}
saved_queries_metadata_config: Dict[str, Any] = {
    "version": "1.0.0",
    "type": "SavedQuery",
    "timestamp": "2021-03-30T20:37:54.791187+00:00",
}
database_config: Dict[str, Any] = {
    "allow_csv_upload": True,
    "allow_ctas": True,
    "allow_cvas": True,
    "allow_run_async": False,
    "cache_timeout": None,
    "database_name": "imported_database",
    "expose_in_sqllab": True,
    "extra": {},
    "sqlalchemy_uri": "sqlite:///test.db",
    "uuid": "b8a1ccd3-779d-4ab7-8ad8-9ab119d7fe89",
    "version": "1.0.0",
}

dataset_config: Dict[str, Any] = {
    "table_name": "imported_dataset",
    "main_dttm_col": None,
    "description": "This is a dataset that was exported",
    "default_endpoint": "",
    "offset": 66,
    "cache_timeout": 55,
    "schema": "",
    "sql": "",
    "params": None,
    "template_params": {},
    "filter_select_enabled": True,
    "fetch_values_predicate": None,
    "extra": '{ "certification": { "certified_by": "Data Platform Team", "details": "This table is the source of truth." }, "warning_markdown": "This is a warning." }',
    "metrics": [
        {
            "metric_name": "count",
            "verbose_name": "",
            "metric_type": None,
            "expression": "count(1)",
            "description": None,
            "d3format": None,
            "extra": {},
            "warning_text": None,
        },
    ],
    "columns": [
        {
            "column_name": "cnt",
            "verbose_name": "Count of something",
            "is_dttm": False,
            "is_active": None,
            "type": "NUMBER",
            "groupby": False,
            "filterable": True,
            "expression": "",
            "description": None,
            "python_date_format": None,
        },
    ],
    "version": "1.0.0",
    "uuid": "10808100-158b-42c4-842e-f32b99d88dfb",
    "database_uuid": "b8a1ccd3-779d-4ab7-8ad8-9ab119d7fe89",
}

chart_config: Dict[str, Any] = {
    "slice_name": "Deck Path",
    "viz_type": "deck_path",
    "params": {
        "color_picker": {"a": 1, "b": 135, "g": 122, "r": 0},
        "datasource": "12__table",
        "js_columns": ["color"],
        "js_data_mutator": r"data => data.map(d => ({\n    ...d,\n    color: colors.hexToRGB(d.extraProps.color)\n}));",
        "js_onclick_href": "",
        "js_tooltip": "",
        "line_column": "path_json",
        "line_type": "json",
        "line_width": 150,
        "mapbox_style": "mapbox://styles/mapbox/light-v9",
        "reverse_long_lat": False,
        "row_limit": 5000,
        "slice_id": 43,
        "time_grain_sqla": None,
        "time_range": " : ",
        "viewport": {
            "altitude": 1.5,
            "bearing": 0,
            "height": 1094,
            "latitude": 37.73671752604488,
            "longitude": -122.18885402582598,
            "maxLatitude": 85.05113,
            "maxPitch": 60,
            "maxZoom": 20,
            "minLatitude": -85.05113,
            "minPitch": 0,
            "minZoom": 0,
            "pitch": 0,
            "width": 669,
            "zoom": 9.51847667620428,
        },
        "viz_type": "deck_path",
    },
    "query_context": '{"datasource":{"id":12,"type":"table"},"force":false,"queries":[{"time_range":" : ","filters":[],"extras":{"time_grain_sqla":null,"having":"","having_druid":[],"where":""},"applied_time_extras":{},"columns":[],"metrics":[],"annotation_layers":[],"row_limit":5000,"timeseries_limit":0,"order_desc":true,"url_params":{},"custom_params":{},"custom_form_data":{}}],"result_format":"json","result_type":"full"}',
    "cache_timeout": None,
    "uuid": "0c23747a-6528-4629-97bf-e4b78d3b9df1",
    "version": "1.0.0",
    "dataset_uuid": "10808100-158b-42c4-842e-f32b99d88dfb",
}

dashboard_config = {
    "dashboard_title": "Test dash",
    "description": None,
    "css": "",
    "slug": None,
    "uuid": "c4b28c4e-a1fe-4cf8-a5ac-d6f11d6fdd51",
    "position": {
        "CHART-SVAlICPOSJ": {
            "children": [],
            "id": "CHART-SVAlICPOSJ",
            "meta": {
                "chartId": 83,
                "height": 50,
                "sliceName": "Number of California Births",
                "uuid": "0c23747a-6528-4629-97bf-e4b78d3b9df1",
                "width": 4,
            },
            "parents": ["ROOT_ID", "GRID_ID", "ROW-dP_CHaK2q"],
            "type": "CHART",
        },
        "DASHBOARD_VERSION_KEY": "v2",
        "GRID_ID": {
            "children": ["ROW-dP_CHaK2q"],
            "id": "GRID_ID",
            "parents": ["ROOT_ID"],
            "type": "GRID",
        },
        "HEADER_ID": {
            "id": "HEADER_ID",
            "meta": {"text": "Test dash"},
            "type": "HEADER",
        },
        "ROOT_ID": {"children": ["GRID_ID"], "id": "ROOT_ID", "type": "ROOT"},
        "ROW-dP_CHaK2q": {
            "children": ["CHART-SVAlICPOSJ"],
            "id": "ROW-dP_CHaK2q",
            "meta": {"0": "ROOT_ID", "background": "BACKGROUND_TRANSPARENT"},
            "parents": ["ROOT_ID", "GRID_ID"],
            "type": "ROW",
        },
    },
    "metadata": {
        "timed_refresh_immune_slices": [83],
        "filter_scopes": {"83": {"region": {"scope": ["ROOT_ID"], "immune": [83]}},},
        "expanded_slices": {"83": True},
        "refresh_frequency": 0,
        "default_filters": "{}",
        "color_scheme": None,
        "remote_id": 7,
        "import_time": 1604342885,
    },
    "version": "1.0.0",
}
saved_queries_config = {
    "schema": "public",
    "label": "Test Saved Query",
    "description": None,
    "sql": "-- Note: Unless you save your query, these tabs will NOT persist if you clear\nyour cookies or change browsers.\n\n\nSELECT * from birth_names",
    "uuid": "05b679b5-8eaf-452c-b874-a7a774cfa4e9",
    "version": "1.0.0",
    "database_uuid": "b8a1ccd3-779d-4ab7-8ad8-9ab119d7fe89",
}
