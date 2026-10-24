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


class OpenObserveEngineSpec(BaseEngineSpec):
    """Engine spec for the OpenObserve observability platform."""

    engine = "openobserve"
    engine_name = "OpenObserve"
    drivers = {"rest": "OpenObserve HTTP search API"}
    default_driver = "rest"
    sqlalchemy_uri_placeholder = (
        "openobserve://{email}:{password}@{host}:{port}/{organization}"
    )

    metadata = {
        "description": (
            "OpenObserve is an open-source observability platform for logs, "
            "metrics and traces, queried with SQL."
        ),
        "categories": [DatabaseCategory.SEARCH_NOSQL, DatabaseCategory.OPEN_SOURCE],
        "pypi_packages": ["sqlalchemy-openobserve"],
        "connection_string": (
            "openobserve://{email}:{password}@{host}:{port}/{organization}"
        ),
        "default_port": 5080,
        "connection_examples": [
            {
                "description": "Local server over plain HTTP",
                "connection_string": (
                    "openobserve://root%40example.com:password@localhost:5080/default"
                    "?ssl=false"
                ),
            },
        ],
        "notes": (
            "The username is your OpenObserve email. Write its @ as %40, and "
            "percent-encode special characters in the password. HTTPS is used "
            "by default; add ?ssl=false for a plain HTTP server."
        ),
        "homepage_url": "https://openobserve.ai/",
        "docs_url": "https://openobserve.ai/docs/",
    }
