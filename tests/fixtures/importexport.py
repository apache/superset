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
