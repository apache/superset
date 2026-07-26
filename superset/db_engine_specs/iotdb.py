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

from superset.db_engine_specs.base import BaseEngineSpec, DatabaseCategory


class IoTDBEngineSpec(BaseEngineSpec):  # pylint: disable=abstract-method
    """Dialect for Apache IoTDB"""

    engine = "iotdb"
    engine_name = "Apache IoTDB"

    metadata = {
        "description": (
            "Apache IoTDB is a time series database designed for IoT data, "
            "with efficient storage and query capabilities for massive "
            "time series data."
        ),
        "logo": "apache-iotdb.svg",
        "homepage_url": "https://iotdb.apache.org/",
        "categories": [
            DatabaseCategory.APACHE_PROJECTS,
            DatabaseCategory.TIME_SERIES,
            DatabaseCategory.OPEN_SOURCE,
        ],
        "pypi_packages": ["apache-iotdb"],
        "connection_string": "iotdb://{username}:{password}@{hostname}:{port}",
        "default_port": 6667,
        "parameters": {
            "username": "Database username (default: root)",
            "password": "Database password (default: root)",
            "hostname": "IP address or hostname",
            "port": "Default 6667",
        },
        "notes": (
            "The IoTDB SQLAlchemy dialect was written to integrate with "
            "Apache Superset. IoTDB uses a hierarchical data model, which "
            "is reorganized into a relational model for SQL queries."
        ),
    }

    _time_grain_expressions = {
        None: "{col}",
    }
