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

from typing import Any, Dict

# example YAML files
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
    "template_params": None,
    "filter_select_enabled": True,
    "fetch_values_predicate": None,
    "extra": None,
    "metrics": [
        {
            "metric_name": "count",
            "verbose_name": "",
            "metric_type": None,
            "expression": "count(1)",
            "description": None,
            "d3format": None,
            "extra": None,
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
    "params": {
        "color_picker": {"a": 1, "b": 135, "g": 122, "r": 0,},
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
    "cache_timeout": None,
    "uuid": "0c23747a-6528-4629-97bf-e4b78d3b9df1",
    "version": "1.0.0",
    "dataset_uuid": "10808100-158b-42c4-842e-f32b99d88dfb",
}
