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
from superset.db_engine_specs.mssql import MssqlEngineSpec


class SybaseEngineSpec(MssqlEngineSpec):
    """Engine spec for SAP ASE (Sybase)

    SAP Adaptive Server Enterprise (ASE), formerly known as Sybase SQL Server,
    is a relational database management system. It uses Transact-SQL (T-SQL)
    similar to Microsoft SQL Server.
    """

    engine = "sybase"
    engine_name = "SAP Sybase"
    engine_aliases = {"sybase_sqlany"}  # Support SQL Anywhere dialect too
    default_driver = "pyodbc"

    metadata = {
        "description": (
            "SAP ASE (formerly Sybase) is an enterprise relational database."
        ),
        "logo": "sybase.png",
        "homepage_url": "https://www.sap.com/products/technology-platform/sybase-ase.html",
        "categories": [
            DatabaseCategory.TRADITIONAL_RDBMS,
            DatabaseCategory.PROPRIETARY,
        ],
        "pypi_packages": ["sqlalchemy-sybase", "pyodbc"],
        "connection_string": "sybase+pyodbc://{username}:{password}@{dsn}",
        "parameters": {
            "username": "Database username",
            "password": "Database password",
            "dsn": "ODBC Data Source Name configured for SAP ASE",
        },
        "notes": "Requires SAP ASE ODBC driver installed and configured as a DSN.",
        "docs_url": "https://help.sap.com/docs/SAP_ASE",
    }
