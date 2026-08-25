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
from datetime import datetime
from typing import Any, Callable, Optional

from sqlalchemy import types
from sqlalchemy.sql.elements import ColumnElement

from superset.db_engine_specs.base import DatabaseCategory
from superset.db_engine_specs.postgres import PostgresEngineSpec


class CockroachDbEngineSpec(PostgresEngineSpec):
    engine = "cockroachdb"
    engine_name = "CockroachDB"

    # `PostgresEngineSpec._extended_aggregations` (MEDIAN/STDDEV_SAMP/VAR_SAMP)
    # is verified against real Postgres behavior, not CockroachDB's distributed
    # query engine; disable it here until someone confirms the same expressions
    # against a live CockroachDB instance.
    _extended_aggregations: dict[str, Callable[[ColumnElement], ColumnElement]] = {}

    metadata = {
        "description": (
            "CockroachDB is a distributed SQL database built for cloud applications."
        ),
        "logo": "cockroachdb.png",
        "homepage_url": "https://www.cockroachlabs.com/",
        "categories": [
            DatabaseCategory.TRADITIONAL_RDBMS,
            DatabaseCategory.OPEN_SOURCE,
        ],
        "pypi_packages": ["sqlalchemy-cockroachdb"],
        "connection_string": "cockroachdb://root@{hostname}:{port}/{database}?sslmode=disable",
        "default_port": 26257,
        "docs_url": "https://github.com/cockroachdb/sqlalchemy-cockroachdb",
    }

    @classmethod
    def convert_dttm(
        cls, target_type: str, dttm: datetime, db_extra: Optional[dict[str, Any]] = None
    ) -> Optional[str]:
        sqla_type = cls.get_sqla_column_type(target_type)
        if isinstance(sqla_type, types.Date):
            return f"'{dttm.date().isoformat()}'"
        if isinstance(sqla_type, (types.String, types.DateTime)):
            return f"""'{dttm.isoformat(sep=" ", timespec="seconds")}'"""
        return None
