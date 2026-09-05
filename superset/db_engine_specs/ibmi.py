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

from .db2 import Db2EngineSpec


class IBMiEngineSpec(Db2EngineSpec):
    """IBM Db2 for i (AS/400) engine spec."""

    engine = "ibmi"
    engine_name = "IBM Db2 for i"
    max_column_name_length = 128

    metadata = {
        "description": (
            "IBM Db2 for i (formerly AS/400) is an integrated relational database "
            "engine on IBM Power systems running IBM i."
        ),
        "logo": "ibm-db2.svg",
        "homepage_url": "https://www.ibm.com/products/db2-for-i",
        "categories": [
            DatabaseCategory.TRADITIONAL_RDBMS,
            DatabaseCategory.PROPRIETARY,
        ],
        "pypi_packages": ["sqlalchemy-ibmi"],
        "connection_string": "ibmi://{username}:{password}@{host}:{port}/{database}",
        "default_port": 50000,
        "parameters": {
            "username": "IBM i username",
            "password": "IBM i password",
            "host": "IBM i system host",
            "port": "Default 50000",
            "database": "Library/schema name",
        },
        "docs_url": "https://github.com/IBM/sqlalchemy-ibmi",
        "sqlalchemy_docs_url": "https://github.com/IBM/sqlalchemy-ibmi",
    }

    @classmethod
    def epoch_to_dttm(cls) -> str:
        return "(DAYS({col}) - DAYS('1970-01-01')) * 86400 + MIDNIGHT_SECONDS({col})"
