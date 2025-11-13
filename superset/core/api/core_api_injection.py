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
Core API Dependency Injection

This module handles the injection of concrete Superset implementations
into the abstract superset-core API modules. This allows the core API
to be used with direct imports while maintaining loose coupling.
"""

from typing import Any, TYPE_CHECKING

from sqlalchemy.orm import scoped_session

if TYPE_CHECKING:
    from superset_core.api.models import Database
    from superset_core.api.rest_api import RestApi


__all__ = ["initialize_core_api_dependencies"]


def inject_dao_implementations() -> None:
    """
    Replace abstract DAO classes in superset_core.api.daos with concrete
    implementations from Superset.
    """
    import superset_core.api.daos as core_dao_module

    from superset.daos.chart import ChartDAO as HostChartDAO
    from superset.daos.dashboard import DashboardDAO as HostDashboardDAO
    from superset.daos.database import DatabaseDAO as HostDatabaseDAO
    from superset.daos.dataset import DatasetDAO as HostDatasetDAO
    from superset.daos.key_value import KeyValueDAO as HostKeyValueDAO
    from superset.daos.query import (
        QueryDAO as HostQueryDAO,
        SavedQueryDAO as HostSavedQueryDAO,
    )
    from superset.daos.tag import TagDAO as HostTagDAO
    from superset.daos.user import UserDAO as HostUserDAO

    # Replace abstract classes with concrete implementations
    core_dao_module.DatasetDAO = HostDatasetDAO  # type: ignore[assignment,misc]
    core_dao_module.DatabaseDAO = HostDatabaseDAO  # type: ignore[assignment,misc]
    core_dao_module.ChartDAO = HostChartDAO  # type: ignore[assignment,misc]
    core_dao_module.DashboardDAO = HostDashboardDAO  # type: ignore[assignment,misc]
    core_dao_module.UserDAO = HostUserDAO  # type: ignore[assignment,misc]
    core_dao_module.QueryDAO = HostQueryDAO  # type: ignore[assignment,misc]
    core_dao_module.SavedQueryDAO = HostSavedQueryDAO  # type: ignore[assignment,misc]
    core_dao_module.TagDAO = HostTagDAO  # type: ignore[assignment,misc]
    core_dao_module.KeyValueDAO = HostKeyValueDAO  # type: ignore[assignment,misc]

    core_dao_module.__all__ = [
        "DatasetDAO",
        "DatabaseDAO",
        "ChartDAO",
        "DashboardDAO",
        "UserDAO",
        "QueryDAO",
        "SavedQueryDAO",
        "TagDAO",
        "KeyValueDAO",
    ]


def inject_model_implementations() -> None:
    """
    Replace abstract model classes in superset_core.api.models with concrete
    implementations from Superset.

    Uses in-place replacement to maintain single import location for extensions.
    """
    import superset_core.api.models as core_models_module
    from flask_appbuilder.security.sqla.models import User as HostUser

    from superset.connectors.sqla.models import SqlaTable as HostDataset
    from superset.key_value.models import KeyValueEntry as HostKeyValue
    from superset.models.core import Database as HostDatabase
    from superset.models.dashboard import Dashboard as HostDashboard
    from superset.models.slice import Slice as HostChart
    from superset.models.sql_lab import Query as HostQuery, SavedQuery as HostSavedQuery
    from superset.tags.models import Tag as HostTag

    # In-place replacement - extensions will import concrete implementations
    core_models_module.Database = HostDatabase  # type: ignore[misc]
    core_models_module.Dataset = HostDataset  # type: ignore[misc]
    core_models_module.Chart = HostChart  # type: ignore[misc]
    core_models_module.Dashboard = HostDashboard  # type: ignore[misc]
    core_models_module.User = HostUser  # type: ignore[misc]
    core_models_module.Query = HostQuery  # type: ignore[misc]
    core_models_module.SavedQuery = HostSavedQuery  # type: ignore[misc]
    core_models_module.Tag = HostTag  # type: ignore[misc]
    core_models_module.KeyValue = HostKeyValue  # type: ignore[misc]


def inject_query_implementations() -> None:
    """
    Replace abstract query functions in superset_core.api.query with concrete
    implementations from Superset.
    """
    import superset_core.api.query as core_query_module

    from superset.sql.parse import SQLGLOT_DIALECTS

    def get_sqlglot_dialect(database: "Database") -> Any:
        return (
            SQLGLOT_DIALECTS.get(database.backend)
            or __import__("sqlglot").Dialects.DIALECT
        )

    core_query_module.get_sqlglot_dialect = get_sqlglot_dialect
    core_query_module.__all__ = ["get_sqlglot_dialect"]


def inject_rest_api_implementations() -> None:
    """
    Replace abstract REST API functions in superset_core.api.rest_api with concrete
    implementations from Superset.
    """
    import superset_core.api.rest_api as core_rest_api_module

    from superset.extensions import appbuilder

    def add_api(api: "type[RestApi]") -> None:
        view = appbuilder.add_api(api)
        appbuilder._add_permission(view, True)

    def add_extension_api(api: "type[RestApi]") -> None:
        api.route_base = "/extensions/" + (api.resource_name or "")
        view = appbuilder.add_api(api)
        appbuilder._add_permission(view, True)

    core_rest_api_module.add_api = add_api
    core_rest_api_module.add_extension_api = add_extension_api
    core_rest_api_module.__all__ = ["RestApi", "add_api", "add_extension_api"]


def inject_model_session_implementation() -> None:
    """
    Replace abstract get_session function in superset_core.api.models with concrete
    implementation from Superset.
    """
    import superset_core.api.models as core_models_module

    def get_session() -> scoped_session:
        from superset import db

        return db.session

    core_models_module.get_session = get_session
    # Update __all__ to include get_session (already done in the module)


def initialize_core_api_dependencies() -> None:
    """
    Initialize all dependency injections for the superset-core API.

    This should be called during Superset initialization to replace
    abstract classes and functions with concrete implementations.
    """
    inject_dao_implementations()
    inject_model_implementations()
    inject_model_session_implementation()
    inject_query_implementations()
    inject_rest_api_implementations()
