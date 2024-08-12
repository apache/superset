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

from typing import TYPE_CHECKING

from superset.db_engine_specs.sqlite import SqliteEngineSpec

if TYPE_CHECKING:
    from superset.models.core import Database


class ShillelaghEngineSpec(SqliteEngineSpec):
    """Engine for shillelagh"""

    engine_name = "Shillelagh"
    engine = "shillelagh"
    drivers = {"apsw": "SQLite driver"}
    default_driver = "apsw"
    sqlalchemy_uri_placeholder = "shillelagh://"

    allows_joins = True
    allows_subqueries = True

    @classmethod
    def get_function_names(
        cls,
        database: Database,
    ) -> list[str]:
        return super().get_function_names(database) + [
            "sleep",
            "version",
            "get_metadata",
        ]
