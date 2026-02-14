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
from superset.db_engine_specs.postgres import PostgresBaseEngineSpec


class PostGISEngineSpec(PostgresBaseEngineSpec):
    """
    Engine spec for PostGIS.

    PostGIS is a spatial database extender for PostgreSQL, adding support for
    geographic objects and location queries.
    """

    engine = "postgis"
    engine_name = "PostGIS"
    default_driver = "psycopg2"

    metadata = {
        "description": (
            "PostGIS is a spatial database extender for PostgreSQL, adding "
            "support for geographic objects and location queries."
        ),
        "logo": "postgis.svg",
        "homepage_url": "https://postgis.net/",
        "categories": [
            DatabaseCategory.TRADITIONAL_RDBMS,
            DatabaseCategory.OPEN_SOURCE,
        ],
        "pypi_packages": ["psycopg2"],
        "connection_string": (
            "postgresql://{username}:{password}@{host}:{port}/{database}"
        ),
        "default_port": 5432,
        "notes": (
            "PostGIS extends PostgreSQL with geospatial capabilities. "
            "Uses the standard PostgreSQL driver."
        ),
    }
