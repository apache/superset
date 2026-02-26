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
    from superset.daos.tasks import TaskDAO as HostTaskDAO
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
    core_dao_module.TaskDAO = HostTaskDAO  # type: ignore[assignment,misc]


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
    from superset.models.tasks import Task as HostTask
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
    core_models_module.Task = HostTask  # type: ignore[misc]


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


def inject_task_implementations() -> None:
    """
    Replace abstract task functions in superset_core.api.tasks with concrete
    implementations from Superset.
    """
    import superset_core.api.tasks as core_tasks_module

    from superset.tasks.ambient_context import get_context
    from superset.tasks.context import TaskContext
    from superset.tasks.decorators import task

    # Replace abstract classes and functions with concrete implementations
    core_tasks_module.TaskContext = TaskContext  # type: ignore[assignment,misc]
    core_tasks_module.task = task  # type: ignore[assignment]
    core_tasks_module.get_context = get_context


def inject_rest_api_implementations() -> None:
    """
    Replace abstract REST API decorators in superset_core.api.rest_api with concrete
    implementations from Superset.

    The decorators:
    1. Store metadata on classes for build-time discovery
    2. In host mode: Register immediately with Flask-AppBuilder
    3. In extension mode: Defer registration (ExtensionManager validates manifest)
    4. In build mode: Store metadata only
    """
    import logging
    from typing import Callable, TypeVar

    import superset_core.api.rest_api as core_rest_api_module
    from superset_core.api.rest_api import RestApiMetadata
    from superset_core.extensions.context import get_context

    from superset.extensions import appbuilder

    logger = logging.getLogger(__name__)
    T = TypeVar("T", bound=type)

    def _register_api_with_appbuilder(
        api_cls: type["RestApi"],
        route_base: str | None = None,
    ) -> None:
        """Register an API class with Flask-AppBuilder."""
        if route_base:
            api_cls.route_base = route_base
        view = appbuilder.add_api(api_cls)
        appbuilder._add_permission(view, True)
        logger.info("Registered REST API: %s", api_cls.__name__)

    def create_api_decorator(cls: T) -> T:
        """
        Decorator to register a REST API with the host application.

        In host mode: Registers immediately with Flask-AppBuilder.
        In extension mode: Defers registration (should not be used for extensions).
        In build mode: No-op (host APIs are not discovered).
        """
        ctx = get_context()

        # Build mode: no-op for host APIs
        if ctx.is_build_mode:
            return cls

        # Host mode: register immediately
        if ctx.is_host_mode:
            _register_api_with_appbuilder(cls)
            return cls

        # Extension mode: host @api decorator should not be used
        logger.warning(
            "Host @api decorator used in extension context. "
            "Use @extension_api instead for extensions."
        )
        return cls

    def create_extension_api_decorator(
        id: str,  # noqa: A002
        name: str,
        description: str | None = None,
        base_path: str | None = None,
    ) -> Callable[[T], T]:
        """
        Decorator to mark a class as an extension REST API.

        This decorator:
        1. Stores RestApiMetadata on the class for build-time discovery
        2. In host mode: Registers immediately under /extensions/{id}/
        3. In extension mode: Defers registration (ExtensionManager validates manifest)
        4. In build mode: Stores metadata only
        """

        def decorator(cls: T) -> T:
            # Build metadata
            metadata = RestApiMetadata(
                id=id,
                name=name,
                description=description or cls.__doc__,
                base_path=base_path or f"/{id}",
                module=f"{cls.__module__}.{cls.__name__}",
            )
            cls.__rest_api_metadata__ = metadata  # type: ignore[attr-defined]

            ctx = get_context()

            # Build mode: metadata only, no registration
            if ctx.is_build_mode:
                return cls

            # Extension mode: defer registration to ExtensionManager
            if ctx.is_extension_mode:
                ctx.add_pending_contribution(cls, metadata, "restApi")
                return cls

            # Host mode: register immediately (for testing/development)
            route_base = f"/extensions{metadata.base_path}"
            _register_api_with_appbuilder(cls, route_base)
            return cls

        return decorator

    # Replace the abstract decorators with concrete implementations
    core_rest_api_module.api = create_api_decorator
    core_rest_api_module.extension_api = create_extension_api_decorator


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
