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
    engine = "ibmi"
    engine_name = "IBM Db2 for i"

    metadata = {
        "description": "IBM Db2 for i (AS/400) is a database integrated with IBM i OS.",
        "homepage_url": "https://www.ibm.com/products/db2-for-i",
        "category": DatabaseCategory.TRADITIONAL_RDBMS,
        "pypi_packages": ["sqlalchemy-ibmi"],
        "connection_string": "ibmi://{username}:{password}@{host}/{database}",
        "parameters": {
            "username": "IBM i username",
            "password": "IBM i password",
            "host": "IBM i system host",
            "database": "Library/schema name",
        },
        "docs_url": "https://github.com/IBM/sqlalchemy-ibmi",
    }
    max_column_name_length = 128

    @classmethod
    def epoch_to_dttm(cls) -> str:
        return "(DAYS({col}) - DAYS('1970-01-01')) * 86400 + MIDNIGHT_SECONDS({col})"
