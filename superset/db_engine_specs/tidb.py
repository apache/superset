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
from superset.db_engine_specs.base import DatabaseCategory
from superset.db_engine_specs.mysql import MySQLEngineSpec


class TiDBEngineSpec(MySQLEngineSpec):
    """
    Engine spec for TiDB.

    TiDB is an open-source, cloud-native, distributed SQL database designed for
    hybrid transactional and analytical processing (HTAP) workloads. It is
    MySQL-compatible.
    """

    engine = "tidb"
    engine_name = "TiDB"

    metadata = {
        "description": (
            "TiDB is an open-source, cloud-native, distributed SQL database "
            "designed for hybrid transactional and analytical processing (HTAP) "
            "workloads. It is MySQL-compatible."
        ),
        "logo": "tidb.svg",
        "homepage_url": "https://www.pingcap.com/tidb/",
        "categories": [
            DatabaseCategory.TRADITIONAL_RDBMS,
            DatabaseCategory.OPEN_SOURCE,
        ],
        "pypi_packages": ["mysqlclient", "sqlalchemy-tidb"],
        "connection_string": "mysql://{username}:{password}@{host}:{port}/{database}",
        "default_port": 4000,
        "drivers": [
            {
                "name": "mysqlclient",
                "pypi_package": "mysqlclient",
                "connection_string": (
                    "mysql://{username}:{password}@{host}:{port}/{database}"
                ),
                "is_recommended": True,
                "notes": (
                    "Standard MySQL driver, works with TiDB's MySQL compatibility."
                ),
            },
            {
                "name": "tidb",
                "pypi_package": "sqlalchemy-tidb",
                "connection_string": (
                    "tidb://{username}:{password}@{host}:{port}/{database}"
                ),
                "is_recommended": False,
                "notes": "Native TiDB dialect with TiDB-specific optimizations.",
            },
        ],
        "notes": (
            "TiDB is MySQL-compatible. Use the standard MySQL driver or the "
            "native sqlalchemy-tidb dialect."
        ),
    }
