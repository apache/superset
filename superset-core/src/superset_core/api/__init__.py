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

"""
Superset Core API Package

This package provides a unified API for Superset core functionality,
allowing extensions to import from single, consistent locations.

Usage:
    from superset_core.api.models import Database, Dataset, get_session
    from superset_core.api.daos import DatasetDAO, DatabaseDAO
    from superset_core.api.rest_api import RestApi, add_api
    from superset_core.api.query import get_sqlglot_dialect

All classes and functions are replaced with concrete implementations
during Superset initialization via dependency injection.
"""

# Re-export commonly used items for convenience
from .daos import ChartDAO, DashboardDAO, DatabaseDAO, DatasetDAO
from .models import Chart, Dashboard, Database, Dataset, get_session
from .query import get_sqlglot_dialect
from .rest_api import add_api, add_extension_api, RestApi

__all__ = [
    "Database",
    "Dataset",
    "Chart",
    "Dashboard",
    "get_session",
    "DatasetDAO",
    "DatabaseDAO",
    "ChartDAO",
    "DashboardDAO",
    "RestApi",
    "add_api",
    "add_extension_api",
    "get_sqlglot_dialect",
]
