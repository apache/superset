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

from typing import Callable

from sqlalchemy.sql.elements import ColumnElement

from superset.db_engine_specs.base import DatabaseCategory
from superset.db_engine_specs.postgres import PostgresEngineSpec


class GreenplumEngineSpec(PostgresEngineSpec):
    """Engine spec for VMware Greenplum (formerly Pivotal Greenplum)

    Greenplum is a massively parallel processing (MPP) database built on PostgreSQL.
    It inherits PostgreSQL's SQL syntax and most features.
    """

    engine = "greenplum"
    engine_name = "Greenplum"
    default_driver = "psycopg2"

    # `PostgresEngineSpec._extended_aggregations` (MEDIAN/STDDEV_SAMP/VAR_SAMP) is
    # verified against real Postgres behavior, not Greenplum's MPP query engine;
    # disable it here until someone confirms the same expressions against a live
    # Greenplum instance.
    _extended_aggregations: dict[str, Callable[[ColumnElement], ColumnElement]] = {}

    metadata = {
        "description": (
            "VMware Greenplum is a massively parallel processing (MPP) "
            "database built on PostgreSQL."
        ),
        "logo": "greenplum.png",
        "homepage_url": "https://greenplum.org/",
        "categories": [
            DatabaseCategory.TRADITIONAL_RDBMS,
            DatabaseCategory.OPEN_SOURCE,
        ],
        "pypi_packages": ["sqlalchemy-greenplum", "psycopg2"],
        "connection_string": "greenplum://{username}:{password}@{host}:{port}/{database}",
        "default_port": 5432,
        "parameters": {
            "username": "Database username",
            "password": "Database password",
            "host": "Greenplum coordinator host",
            "port": "Default 5432",
            "database": "Database name",
        },
        "docs_url": "https://docs.vmware.com/en/VMware-Greenplum/",
    }
