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

databases_config: dict[str, Any] = {
    "databases/examples.yaml": {
        "database_name": "examples",
        "sqlalchemy_uri": "sqlite:///test.db",
        "cache_timeout": None,
        "expose_in_sqllab": True,
        "allow_run_async": False,
        "allow_ctas": False,
        "allow_cvas": False,
        "extra": {},
        "uuid": "a2dc77af-e654-49bb-b321-40f6b559a1ee",
        "version": "1.0.0",
        "password": None,
        "allow_csv_upload": False,
    },
}
datasets_config: dict[str, Any] = {
    "datasets/examples/video_game_sales.yaml": {
        "table_name": "video_game_sales",
        "main_dttm_col": None,
        "description": None,
        "default_endpoint": None,
        "offset": 0,
        "cache_timeout": None,
        "schema": "main",
        "sql": "",
        "params": {},
        "template_params": None,
        "filter_select_enabled": True,
        "fetch_values_predicate": None,
        "extra": None,
        "uuid": "53d47c0c-c03d-47f0-b9ac-81225f808283",
        "metrics": [
            {
                "metric_name": "count",
                "verbose_name": "COUNT(*)",
                "metric_type": None,
                "expression": "COUNT(*)",
                "description": None,
                "d3format": None,
                "extra": None,
                "warning_text": None,
            }
        ],
        "columns": [
            {
                "column_name": "genre",
                "verbose_name": None,
                "is_dttm": False,
                "is_active": None,
                "type": "STRING",
                "advanced_data_type": None,
                "groupby": True,
                "filterable": True,
                "expression": None,
                "description": None,
                "python_date_format": None,
                "extra": None,
            },
        ],
        "version": "1.0.0",
        "database_uuid": "a2dc77af-e654-49bb-b321-40f6b559a1ee",
    },
}
charts_config_1: dict[str, Any] = {
    "charts/Games_per_Genre_over_time_95.yaml": {
        "slice_name": "Games per Genre over time",
        "viz_type": "line",
        "params": {},
        "cache_timeout": None,
        "uuid": "0f8976aa-7bb4-40c7-860b-64445a51aaaf",
        "version": "1.0.0",
        "dataset_uuid": "53d47c0c-c03d-47f0-b9ac-81225f808283",
    },
    "charts/Games_per_Genre_131.yaml": {
        "slice_name": "Games per Genre",
        "viz_type": "treemap_v2",
        "params": {},
        "cache_timeout": None,
        "uuid": "0499bdec-0837-44f3-ae8a-8c670de81afd",
        "version": "1.0.0",
        "dataset_uuid": "53d47c0c-c03d-47f0-b9ac-81225f808283",
    },
}
dashboards_config_1: dict[str, Any] = {
    "dashboards/Video_Game_Sales_11.yaml": {
        "dashboard_title": "Video Game Sales",
        "description": None,
        "css": "",
        "slug": None,
        "uuid": "c7bc10f4-6a2d-7569-caae-bbc91864ee11",
        "position": {
            "CHART-1L7NIcXvVN": {
                "children": [],
                "id": "CHART-1L7NIcXvVN",
                "meta": {
                    "chartId": 95,
                    "height": 79,
                    "sliceName": "Games per Genre over time",
                    "uuid": "0f8976aa-7bb4-40c7-860b-64445a51aaaf",
                    "width": 6,
                },
                "parents": [
                    "ROOT_ID",
                    "GRID_ID",
                    "ROW-0F99WDC-sz",
                ],
                "type": "CHART",
            },
            "CHART-7mKdnU7OUJ": {
                "children": [],
                "id": "CHART-7mKdnU7OUJ",
                "meta": {
                    "chartId": 131,
                    "height": 80,
                    "sliceName": "Games per Genre",
                    "uuid": "0499bdec-0837-44f3-ae8a-8c670de81afd",
                    "width": 3,
                },
                "parents": [
                    "ROOT_ID",
                    "GRID_ID",
                    "ROW-0F99WDC-sz",
                ],
                "type": "CHART",
            },
            "DASHBOARD_VERSION_KEY": "v2",
            "GRID_ID": {
                "children": ["ROW-0F99WDC-sz"],
                "id": "GRID_ID",
                "parents": ["ROOT_ID"],
                "type": "GRID",
            },
            "HEADER_ID": {
                "id": "HEADER_ID",
                "meta": {"text": "Video Game Sales"},
                "type": "HEADER",
            },
            "ROOT_ID": {
                "children": ["GRID_ID"],
                "id": "ROOT_ID",
                "type": "ROOT",
            },
            "ROW-0F99WDC-sz": {
                "children": ["CHART-1L7NIcXvVN", "CHART-7mKdnU7OUJ"],
                "id": "ROW-0F99WDC-sz",
                "meta": {"0": "ROOT_ID", "background": "BACKGROUND_TRANSPARENT"},
                "parents": ["ROOT_ID", "GRID_ID"],
                "type": "ROW",
            },
        },
        "metadata": {
            "timed_refresh_immune_slices": [],
            "expanded_slices": {},
            "refresh_frequency": 0,
            "default_filters": "{}",
            "color_scheme": "supersetColors",
            "label_colors": {},
            "color_scheme_domain": [],
            "shared_label_colors": [],
            "map_label_colors": {},
            "cross_filters_enabled": False,
        },
        "version": "1.0.0",
    },
}

charts_config_2: dict[str, Any] = {
    "charts/Games_per_Genre_131.yaml": {
        "slice_name": "Games per Genre",
        "viz_type": "treemap_v2",
        "params": {},
        "cache_timeout": None,
        "uuid": "0499bdec-0837-44f3-ae8a-8c670de81afd",
        "version": "1.0.0",
        "dataset_uuid": "53d47c0c-c03d-47f0-b9ac-81225f808283",
    },
}
dashboards_config_2: dict[str, Any] = {
    "dashboards/Video_Game_Sales_11.yaml": {
        "dashboard_title": "Video Game Sales",
        "description": None,
        "css": "",
        "slug": None,
        "uuid": "c7bc10f4-6a2d-7569-caae-bbc91864ee11",
        "position": {
            "CHART-7mKdnU7OUJ": {
                "children": [],
                "id": "CHART-7mKdnU7OUJ",
                "meta": {
                    "chartId": 131,
                    "height": 80,
                    "sliceName": "Games per Genre",
                    "uuid": "0499bdec-0837-44f3-ae8a-8c670de81afd",
                    "width": 3,
                },
                "parents": [
                    "ROOT_ID",
                    "GRID_ID",
                    "ROW-0F99WDC-sz",
                ],
                "type": "CHART",
            },
            "DASHBOARD_VERSION_KEY": "v2",
            "GRID_ID": {
                "children": ["ROW-0F99WDC-sz"],
                "id": "GRID_ID",
                "parents": ["ROOT_ID"],
                "type": "GRID",
            },
            "HEADER_ID": {
                "id": "HEADER_ID",
                "meta": {"text": "Video Game Sales"},
                "type": "HEADER",
            },
            "ROOT_ID": {
                "children": ["GRID_ID"],
                "id": "ROOT_ID",
                "type": "ROOT",
            },
            "ROW-0F99WDC-sz": {
                "children": ["CHART-7mKdnU7OUJ"],
                "id": "ROW-0F99WDC-sz",
                "meta": {"0": "ROOT_ID", "background": "BACKGROUND_TRANSPARENT"},
                "parents": ["ROOT_ID", "GRID_ID"],
                "type": "ROW",
            },
        },
        "metadata": {
            "timed_refresh_immune_slices": [],
            "expanded_slices": {},
            "refresh_frequency": 0,
            "default_filters": "{}",
            "color_scheme": "supersetColors",
            "label_colors": {},
            "color_scheme_domain": [],
            "shared_label_colors": [],
            "map_label_colors": {},
        },
        "version": "1.0.0",
    },
}
