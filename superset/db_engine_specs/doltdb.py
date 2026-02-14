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


class DoltDBEngineSpec(MySQLEngineSpec):
    """
    Engine spec for DoltDB.

    DoltDB is a SQL database with Git-like version control for data and schema.
    It is fully MySQL-compatible.
    """

    engine = "doltdb"
    engine_name = "DoltDB"

    metadata = {
        "description": (
            "DoltDB is a SQL database with Git-like version control for data "
            "and schema. It is fully MySQL-compatible."
        ),
        "logo": "doltdb.png",
        "homepage_url": "https://www.dolthub.com/",
        "categories": [
            DatabaseCategory.TRADITIONAL_RDBMS,
            DatabaseCategory.OPEN_SOURCE,
        ],
        "pypi_packages": ["mysqlclient"],
        "connection_string": "mysql://{username}:{password}@{host}:{port}/{database}",
        "default_port": 3306,
        "notes": (
            "DoltDB uses the MySQL wire protocol. Connect using any MySQL driver."
        ),
    }
