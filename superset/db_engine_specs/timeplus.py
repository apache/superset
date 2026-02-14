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
from superset.constants import TimeGrain
from superset.db_engine_specs.base import BaseEngineSpec, DatabaseCategory


class TimeplusEngineSpec(BaseEngineSpec):
    """
    Engine spec for Timeplus.

    Timeplus is a streaming-first analytics platform that provides real-time
    data processing with SQL.
    """

    engine = "timeplus"
    engine_name = "Timeplus"
    default_driver = "timeplus"

    metadata = {
        "description": (
            "Timeplus is a streaming-first analytics platform that provides "
            "real-time data processing with SQL."
        ),
        "logo": "timeplus.svg",
        "homepage_url": "https://www.timeplus.com/",
        "categories": [
            DatabaseCategory.ANALYTICAL_DATABASES,
            DatabaseCategory.OPEN_SOURCE,
        ],
        "pypi_packages": ["timeplus-connect"],
        "connection_string": "timeplus://{username}:{password}@{host}:{port}",
        "default_port": 8123,
        "notes": (
            "Timeplus provides real-time streaming SQL analytics. Install "
            "timeplus-connect for SQLAlchemy and Superset support."
        ),
    }

    _time_grain_expressions = {
        None: "{col}",
        TimeGrain.SECOND: "date_trunc('second', {col})",
        TimeGrain.MINUTE: "date_trunc('minute', {col})",
        TimeGrain.HOUR: "date_trunc('hour', {col})",
        TimeGrain.DAY: "date_trunc('day', {col})",
        TimeGrain.WEEK: "date_trunc('week', {col})",
        TimeGrain.MONTH: "date_trunc('month', {col})",
        TimeGrain.QUARTER: "date_trunc('quarter', {col})",
        TimeGrain.YEAR: "date_trunc('year', {col})",
    }
