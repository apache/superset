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

from typing import Any, Callable, TYPE_CHECKING, TypeVar

from sqlalchemy.orm import scoped_session

from superset.extensions.context import get_current_extension_context

if TYPE_CHECKING:
    from superset_core.common.models import Database
    from superset_core.rest_api.api import RestApi


__all__ = ["initialize_core_api_dependencies"]


def inject_dao_implementations() -> None:
    """
    Replace abstract DAO classes in superset_core common/queries/tasks daos with
    concrete implementations from Superset.
    """
    import superset_core.common.daos as core_common_dao_module
    import superset_core.queries.daos as core_queries_dao_module
    import superset_core.tasks.daos as core_tasks_dao_module

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
    from superset.daos.tasks import TaskDAO as HostTaskDAO
    from superset.daos.user import UserDAO as HostUserDAO

    # Replace abstract classes in common.daos with concrete implementations
    core_common_dao_module.DatasetDAO = HostDatasetDAO  # type: ignore[assignment,misc]
    core_common_dao_module.DatabaseDAO = HostDatabaseDAO  # type: ignore[assignment,misc]
    core_common_dao_module.ChartDAO = HostChartDAO  # type: ignore[assignment,misc]
    core_common_dao_module.DashboardDAO = HostDashboardDAO  # type: ignore[assignment,misc]
    core_common_dao_module.UserDAO = HostUserDAO  # type: ignore[assignment,misc]
    core_common_dao_module.TagDAO = HostTagDAO  # type: ignore[assignment,misc]
    core_common_dao_module.KeyValueDAO = HostKeyValueDAO  # type: ignore[assignment,misc]

    # Replace abstract classes in queries.daos
    core_queries_dao_module.QueryDAO = HostQueryDAO  # type: ignore[assignment,misc]
    core_queries_dao_module.SavedQueryDAO = HostSavedQueryDAO  # type: ignore[assignment,misc]

    # Replace abstract classes in tasks.daos
    core_tasks_dao_module.TaskDAO = HostTaskDAO  # type: ignore[assignment,misc]


def inject_model_implementations() -> None:
    """
    Replace abstract model classes in superset_core common/queries/tasks models with
    concrete implementations from Superset.

    Uses in-place replacement to maintain single import location for extensions.
    """
    import superset_core.common.models as core_common_models_module
    import superset_core.queries.models as core_queries_models_module
    import superset_core.tasks.models as core_tasks_models_module
    from flask_appbuilder.security.sqla.models import User as HostUser

    from superset.connectors.sqla.models import SqlaTable as HostDataset
    from superset.key_value.models import KeyValueEntry as HostKeyValue
    from superset.models.core import Database as HostDatabase
    from superset.models.dashboard import Dashboard as HostDashboard
    from superset.models.slice import Slice as HostChart
    from superset.models.sql_lab import Query as HostQuery, SavedQuery as HostSavedQuery
    from superset.models.tasks import Task as HostTask
    from superset.tags.models import Tag as HostTag

    # In-place replacement in common.models
    core_common_models_module.Database = HostDatabase  # type: ignore[misc]
    core_common_models_module.Dataset = HostDataset  # type: ignore[misc]
    core_common_models_module.Chart = HostChart  # type: ignore[misc]
    core_common_models_module.Dashboard = HostDashboard  # type: ignore[misc]
    core_common_models_module.User = HostUser  # type: ignore[misc]
    core_common_models_module.Tag = HostTag  # type: ignore[misc]
    core_common_models_module.KeyValue = HostKeyValue  # type: ignore[misc]

    # In-place replacement in queries.models
    core_queries_models_module.Query = HostQuery  # type: ignore[misc]
    core_queries_models_module.SavedQuery = HostSavedQuery  # type: ignore[misc]

    # In-place replacement in tasks.models
    core_tasks_models_module.Task = HostTask  # type: ignore[misc]


def inject_query_implementations() -> None:
    """
    Replace abstract query functions in superset_core.queries.query with concrete
    implementations from Superset.
    """
    import superset_core.queries.query as core_query_module

    from superset.sql.parse import SQLGLOT_DIALECTS

    def get_sqlglot_dialect(database: "Database") -> Any:
        return (
            SQLGLOT_DIALECTS.get(database.backend)
            or __import__("sqlglot").Dialects.DIALECT
        )

    core_query_module.get_sqlglot_dialect = get_sqlglot_dialect


def inject_task_implementations() -> None:
    """
    Replace abstract task functions in superset_core tasks.types and tasks.decorators
    with concrete implementations from Superset.
    """
    import superset_core.tasks.decorators as core_tasks_decorators_module
    import superset_core.tasks.types as core_tasks_types_module

    from superset.tasks.ambient_context import get_context
    from superset.tasks.context import TaskContext
    from superset.tasks.decorators import task

    # Replace abstract classes and functions with concrete implementations
    core_tasks_types_module.TaskContext = TaskContext  # type: ignore[assignment,misc]
    core_tasks_decorators_module.task = task  # type: ignore[assignment]
    core_tasks_decorators_module.get_context = get_context


def inject_rest_api_implementations() -> None:
    """
    Replace abstract REST API decorators in superset_core.rest_api.decorators
    with concrete implementations from Superset.
    """
    import superset_core.rest_api.decorators as core_rest_api_module

    from superset.extensions import appbuilder

    T = TypeVar("T", bound=type["RestApi"])

    def add_api(api: "type[RestApi]") -> None:
        view = appbuilder.add_api(api)
        appbuilder._add_permission(view, True)

    def api_impl(
        id: str,
        name: str,
        description: str | None = None,
        resource_name: str | None = None,
    ) -> Callable[[T], T]:
        def decorator(api_class: T) -> T:
            # Check for ambient extension context
            context = get_current_extension_context()

            if context:
                # EXTENSION CONTEXT
                manifest = context.manifest
                base_path = f"/extensions/{manifest.publisher}/{manifest.name}"
                prefixed_id = f"extensions.{manifest.publisher}.{manifest.name}.{id}"

            else:
                # HOST CONTEXT
                base_path = "/api/v1"
                prefixed_id = id

            # Add resource_name to path for both contexts
            if resource_name:
                base_path += f"/{resource_name}"

            # Set route base and register immediately
            api_class.route_base = base_path
            api_class._api_id = prefixed_id
            api_class._api_metadata = {
                "id": prefixed_id,
                "name": name,
                "description": description,
                "resource_name": resource_name,
                "is_extension": context is not None,
                "context": context,
            }

            # Register with Flask-AppBuilder immediately
            view = appbuilder.add_api(api_class)
            appbuilder._add_permission(view, True)

            return api_class

        return decorator

    # Replace core implementations with unified API decorator
    core_rest_api_module.api = api_impl


def inject_model_session_implementation() -> None:
    """
    Replace abstract get_session function in superset_core.common.models with concrete
    implementation from Superset.
    """
    import superset_core.common.models as core_models_module

    def get_session() -> scoped_session:
        from superset import db

        return db.session

    core_models_module.get_session = get_session


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
    inject_task_implementations()
    inject_rest_api_implementations()
