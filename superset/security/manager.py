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
# pylint: disable=too-few-public-methods
"""A set of constants and methods to manage permissions and security"""
import logging
import re
from typing import Any, Callable, cast, List, Optional, Set, Tuple, TYPE_CHECKING, Union

from flask import current_app, g
from flask_appbuilder import Model
from flask_appbuilder.security.sqla.manager import SecurityManager
from flask_appbuilder.security.sqla.models import (
    assoc_permissionview_role,
    assoc_user_role,
    PermissionView,
    User,
)
from flask_appbuilder.security.views import (
    PermissionModelView,
    PermissionViewModelView,
    RoleModelView,
    UserModelView,
    ViewMenuModelView,
)
from flask_appbuilder.widgets import ListWidget
from sqlalchemy import and_, or_
from sqlalchemy.engine.base import Connection
from sqlalchemy.orm import Session
from sqlalchemy.orm.mapper import Mapper
from sqlalchemy.orm.query import Query as SqlaQuery

from superset import sql_parse
from superset.connectors.connector_registry import ConnectorRegistry
from superset.constants import RouteMethod
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import SupersetSecurityException
from superset.utils.core import DatasourceName, RowLevelSecurityFilterType

if TYPE_CHECKING:
    from superset.common.query_context import QueryContext
    from superset.connectors.base.models import BaseDatasource
    from superset.connectors.druid.models import DruidCluster
    from superset.models.core import Database
    from superset.models.sql_lab import Query
    from superset.sql_parse import Table
    from superset.viz import BaseViz

logger = logging.getLogger(__name__)


class SupersetSecurityListWidget(ListWidget):
    """
    Redeclaring to avoid circular imports
    """

    template = "superset/fab_overrides/list.html"


class SupersetRoleListWidget(ListWidget):
    """
    Role model view from FAB already uses a custom list widget override
    So we override the override
    """

    template = "superset/fab_overrides/list_role.html"

    def __init__(self, **kwargs: Any) -> None:
        kwargs["appbuilder"] = current_app.appbuilder
        super().__init__(**kwargs)


UserModelView.list_widget = SupersetSecurityListWidget
RoleModelView.list_widget = SupersetRoleListWidget
PermissionViewModelView.list_widget = SupersetSecurityListWidget
PermissionModelView.list_widget = SupersetSecurityListWidget

# Limiting routes on FAB model views
UserModelView.include_route_methods = RouteMethod.CRUD_SET | {
    RouteMethod.ACTION,
    RouteMethod.API_READ,
    RouteMethod.ACTION_POST,
    "userinfo",
}
RoleModelView.include_route_methods = RouteMethod.CRUD_SET
PermissionViewModelView.include_route_methods = {RouteMethod.LIST}
PermissionModelView.include_route_methods = {RouteMethod.LIST}
ViewMenuModelView.include_route_methods = {RouteMethod.LIST}

RoleModelView.list_columns = ["name"]
RoleModelView.edit_columns = ["name", "permissions", "user"]
RoleModelView.related_views = []


class SupersetSecurityManager(  # pylint: disable=too-many-public-methods
    SecurityManager
):
    userstatschartview = None
    READ_ONLY_MODEL_VIEWS = {"Database", "DruidClusterModelView", "DynamicPlugin"}

    USER_MODEL_VIEWS = {
        "UserDBModelView",
        "UserLDAPModelView",
        "UserOAuthModelView",
        "UserOIDModelView",
        "UserRemoteUserModelView",
    }

    GAMMA_READ_ONLY_MODEL_VIEWS = {
        "Dataset",
        "DruidColumnInlineView",
        "DruidDatasourceModelView",
        "DruidMetricInlineView",
        "Datasource",
    } | READ_ONLY_MODEL_VIEWS

    ADMIN_ONLY_VIEW_MENUS = {
        "AccessRequestsModelView",
        "SQL Lab",
        "Refresh Druid Metadata",
        "ResetPasswordView",
        "RoleModelView",
        "Log",
        "Security",
        "Row Level Security",
        "Row Level Security Filters",
        "RowLevelSecurityFiltersModelView",
    } | USER_MODEL_VIEWS

    ALPHA_ONLY_VIEW_MENUS = {
        "Manage",
        "CSS Templates",
        "Queries",
        "Import dashboards",
        "Upload a CSV",
    }

    ADMIN_ONLY_PERMISSIONS = {
        "can_sql_json",  # TODO: move can_sql_json to sql_lab role
        "can_override_role_permissions",
        "can_sync_druid_source",
        "can_override_role_permissions",
        "can_approve",
        "can_update_role",
        "all_query_access",
    }

    READ_ONLY_PERMISSION = {
        "can_show",
        "can_list",
        "can_get",
        "can_external_metadata",
        "can_read",
    }

    ALPHA_ONLY_PERMISSIONS = {
        "muldelete",
        "all_database_access",
        "all_datasource_access",
    }

    OBJECT_SPEC_PERMISSIONS = {
        "database_access",
        "schema_access",
        "datasource_access",
        "metric_access",
    }

    ACCESSIBLE_PERMS = {"can_userinfo"}

    data_access_permissions = (
        "database_access",
        "schema_access",
        "datasource_access",
        "all_datasource_access",
        "all_database_access",
        "all_query_access",
    )

    def get_schema_perm(  # pylint: disable=no-self-use
        self, database: Union["Database", str], schema: Optional[str] = None
    ) -> Optional[str]:
        """
        Return the database specific schema permission.

        :param database: The Superset database or database name
        :param schema: The Superset schema name
        :return: The database specific schema permission
        """

        if schema:
            return f"[{database}].[{schema}]"

        return None

    def unpack_schema_perm(  # pylint: disable=no-self-use
        self, schema_permission: str
    ) -> Tuple[str, str]:
        # [database_name].[schema_name]
        schema_name = schema_permission.split(".")[1][1:-1]
        database_name = schema_permission.split(".")[0][1:-1]
        return database_name, schema_name

    def can_access(self, permission_name: str, view_name: str) -> bool:
        """
        Return True if the user can access the FAB permission/view, False otherwise.

        Note this method adds protection from has_access failing from missing
        permission/view entries.

        :param permission_name: The FAB permission name
        :param view_name: The FAB view-menu name
        :returns: Whether the user can access the FAB permission/view
        """

        user = g.user
        if user.is_anonymous:
            return self.is_item_public(permission_name, view_name)
        return self._has_view_access(user, permission_name, view_name)

    def can_access_all_queries(self) -> bool:
        """
        Return True if the user can access all SQL Lab queries, False otherwise.

        :returns: Whether the user can access all queries
        """

        return self.can_access("all_query_access", "all_query_access")

    def can_access_all_datasources(self) -> bool:
        """
        Return True if the user can fully access all the Superset datasources, False
        otherwise.

        :returns: Whether the user can fully access all Superset datasources
        """

        return self.can_access("all_datasource_access", "all_datasource_access")

    def can_access_all_databases(self) -> bool:
        """
        Return True if the user can fully access all the Superset databases, False
        otherwise.

        :returns: Whether the user can fully access all Superset databases
        """

        return self.can_access("all_database_access", "all_database_access")

    def can_access_database(self, database: Union["Database", "DruidCluster"]) -> bool:
        """
        Return True if the user can fully access the Superset database, False otherwise.

        Note for Druid the database is akin to the Druid cluster.

        :param database: The Superset database
        :returns: Whether the user can fully access the Superset database
        """

        return (
            self.can_access_all_datasources()
            or self.can_access_all_databases()
            or self.can_access("database_access", database.perm)  # type: ignore
        )

    def can_access_schema(self, datasource: "BaseDatasource") -> bool:
        """
        Return True if the user can fully access the schema associated with the Superset
        datasource, False otherwise.

        Note for Druid datasources the database and schema are akin to the Druid cluster
        and datasource name prefix respectively, i.e., [schema.]datasource.

        :param datasource: The Superset datasource
        :returns: Whether the user can fully access the datasource's schema
        """

        return (
            self.can_access_all_datasources()
            or self.can_access_database(datasource.database)
            or self.can_access("schema_access", datasource.schema_perm or "")
        )

    def can_access_datasource(self, datasource: "BaseDatasource") -> bool:
        """
        Return True if the user can fully access of the Superset datasource, False
        otherwise.

        :param datasource: The Superset datasource
        :returns: Whether the user can fully access the Superset datasource
        """

        try:
            self.raise_for_access(datasource=datasource)
        except SupersetSecurityException:
            return False

        return True

    @staticmethod
    def get_datasource_access_error_msg(datasource: "BaseDatasource") -> str:
        """
        Return the error message for the denied Superset datasource.

        :param datasource: The denied Superset datasource
        :returns: The error message
        """

        return f"""This endpoint requires the datasource {datasource.name}, database or
            `all_datasource_access` permission"""

    @staticmethod
    def get_datasource_access_link(  # pylint: disable=unused-argument
        datasource: "BaseDatasource",
    ) -> Optional[str]:
        """
        Return the link for the denied Superset datasource.

        :param datasource: The denied Superset datasource
        :returns: The access URL
        """

        from superset import conf

        return conf.get("PERMISSION_INSTRUCTIONS_LINK")

    def get_datasource_access_error_object(  # pylint: disable=invalid-name
        self, datasource: "BaseDatasource"
    ) -> SupersetError:
        """
        Return the error object for the denied Superset datasource.

        :param datasource: The denied Superset datasource
        :returns: The error object
        """
        return SupersetError(
            error_type=SupersetErrorType.DATASOURCE_SECURITY_ACCESS_ERROR,
            message=self.get_datasource_access_error_msg(datasource),
            level=ErrorLevel.ERROR,
            extra={
                "link": self.get_datasource_access_link(datasource),
                "datasource": datasource.name,
            },
        )

    def get_table_access_error_msg(  # pylint: disable=no-self-use
        self, tables: Set["Table"]
    ) -> str:
        """
        Return the error message for the denied SQL tables.

        :param tables: The set of denied SQL tables
        :returns: The error message
        """

        quoted_tables = [f"`{table}`" for table in tables]
        return f"""You need access to the following tables: {", ".join(quoted_tables)},
            `all_database_access` or `all_datasource_access` permission"""

    def get_table_access_error_object(self, tables: Set["Table"]) -> SupersetError:
        """
        Return the error object for the denied SQL tables.

        :param tables: The set of denied SQL tables
        :returns: The error object
        """
        return SupersetError(
            error_type=SupersetErrorType.TABLE_SECURITY_ACCESS_ERROR,
            message=self.get_table_access_error_msg(tables),
            level=ErrorLevel.ERROR,
            extra={
                "link": self.get_table_access_link(tables),
                "tables": [str(table) for table in tables],
            },
        )

    def get_table_access_link(  # pylint: disable=unused-argument,no-self-use
        self, tables: Set["Table"]
    ) -> Optional[str]:
        """
        Return the access link for the denied SQL tables.

        :param tables: The set of denied SQL tables
        :returns: The access URL
        """

        from superset import conf

        return conf.get("PERMISSION_INSTRUCTIONS_LINK")

    def can_access_table(self, database: "Database", table: "Table") -> bool:
        """
        Return True if the user can access the SQL table, False otherwise.

        :param database: The SQL database
        :param table: The SQL table
        :returns: Whether the user can access the SQL table
        """

        try:
            self.raise_for_access(database=database, table=table)
        except SupersetSecurityException:
            return False

        return True

    def user_view_menu_names(self, permission_name: str) -> Set[str]:
        base_query = (
            self.get_session.query(self.viewmenu_model.name)
            .join(self.permissionview_model)
            .join(self.permission_model)
            .join(assoc_permissionview_role)
            .join(self.role_model)
        )

        if not g.user.is_anonymous:
            # filter by user id
            view_menu_names = (
                base_query.join(assoc_user_role)
                .join(self.user_model)
                .filter(self.user_model.id == g.user.id)
                .filter(self.permission_model.name == permission_name)
            ).all()
            return {s.name for s in view_menu_names}

        # Properly treat anonymous user
        public_role = self.get_public_role()
        if public_role:
            # filter by public role
            view_menu_names = (
                base_query.filter(self.role_model.id == public_role.id).filter(
                    self.permission_model.name == permission_name
                )
            ).all()
            return {s.name for s in view_menu_names}
        return set()

    def get_schemas_accessible_by_user(
        self, database: "Database", schemas: List[str], hierarchical: bool = True
    ) -> List[str]:
        """
        Return the list of SQL schemas accessible by the user.

        :param database: The SQL database
        :param schemas: The list of eligible SQL schemas
        :param hierarchical: Whether to check using the hierarchical permission logic
        :returns: The list of accessible SQL schemas
        """

        from superset.connectors.sqla.models import SqlaTable

        if hierarchical and self.can_access_database(database):
            return schemas

        # schema_access
        accessible_schemas = {
            self.unpack_schema_perm(s)[1]
            for s in self.user_view_menu_names("schema_access")
            if s.startswith(f"[{database}].")
        }

        # datasource_access
        perms = self.user_view_menu_names("datasource_access")
        if perms:
            tables = (
                self.get_session.query(SqlaTable.schema)
                .filter(SqlaTable.database_id == database.id)
                .filter(SqlaTable.schema.isnot(None))
                .filter(SqlaTable.schema != "")
                .filter(or_(SqlaTable.perm.in_(perms)))
                .distinct()
            )
            accessible_schemas.update([table.schema for table in tables])

        return [s for s in schemas if s in accessible_schemas]

    def get_datasources_accessible_by_user(  # pylint: disable=invalid-name
        self,
        database: "Database",
        datasource_names: List[DatasourceName],
        schema: Optional[str] = None,
    ) -> List[DatasourceName]:
        """
        Return the list of SQL tables accessible by the user.

        :param database: The SQL database
        :param datasource_names: The list of eligible SQL tables w/ schema
        :param schema: The fallback SQL schema if not present in the table name
        :returns: The list of accessible SQL tables w/ schema
        """

        if self.can_access_database(database):
            return datasource_names

        if schema:
            schema_perm = self.get_schema_perm(database, schema)
            if schema_perm and self.can_access("schema_access", schema_perm):
                return datasource_names

        user_perms = self.user_view_menu_names("datasource_access")
        schema_perms = self.user_view_menu_names("schema_access")
        user_datasources = ConnectorRegistry.query_datasources_by_permissions(
            self.get_session, database, user_perms, schema_perms
        )
        if schema:
            names = {d.table_name for d in user_datasources if d.schema == schema}
            return [d for d in datasource_names if d in names]

        full_names = {d.full_name for d in user_datasources}
        return [d for d in datasource_names if f"[{database}].[{d}]" in full_names]

    def merge_perm(self, permission_name: str, view_menu_name: str) -> None:
        """
        Add the FAB permission/view-menu.

        :param permission_name: The FAB permission name
        :param view_menu_names: The FAB view-menu name
        :see: SecurityManager.add_permission_view_menu
        """

        logger.warning(
            "This method 'merge_perm' is deprecated use add_permission_view_menu"
        )
        self.add_permission_view_menu(permission_name, view_menu_name)

    def _is_user_defined_permission(self, perm: Model) -> bool:
        """
        Return True if the FAB permission is user defined, False otherwise.

        :param perm: The FAB permission
        :returns: Whether the FAB permission is user defined
        """

        return perm.permission.name in self.OBJECT_SPEC_PERMISSIONS

    def create_custom_permissions(self) -> None:
        """
        Create custom FAB permissions.
        """
        self.add_permission_view_menu("all_datasource_access", "all_datasource_access")
        self.add_permission_view_menu("all_database_access", "all_database_access")
        self.add_permission_view_menu("all_query_access", "all_query_access")

    def create_missing_perms(self) -> None:
        """
        Creates missing FAB permissions for datasources, schemas and metrics.
        """

        from superset.models import core as models

        logger.info("Fetching a set of all perms to lookup which ones are missing")
        all_pvs = set()
        for pv in self.get_session.query(self.permissionview_model).all():
            if pv.permission and pv.view_menu:
                all_pvs.add((pv.permission.name, pv.view_menu.name))

        def merge_pv(view_menu: str, perm: str) -> None:
            """Create permission view menu only if it doesn't exist"""
            if view_menu and perm and (view_menu, perm) not in all_pvs:
                self.add_permission_view_menu(view_menu, perm)

        logger.info("Creating missing datasource permissions.")
        datasources = ConnectorRegistry.get_all_datasources(self.get_session)
        for datasource in datasources:
            merge_pv("datasource_access", datasource.get_perm())
            merge_pv("schema_access", datasource.get_schema_perm())

        logger.info("Creating missing database permissions.")
        databases = self.get_session.query(models.Database).all()
        for database in databases:
            merge_pv("database_access", database.perm)

    def clean_perms(self) -> None:
        """
        Clean up the FAB faulty permissions.
        """

        logger.info("Cleaning faulty perms")
        sesh = self.get_session
        pvms = sesh.query(PermissionView).filter(
            or_(
                PermissionView.permission  # pylint: disable=singleton-comparison
                == None,
                PermissionView.view_menu  # pylint: disable=singleton-comparison
                == None,
            )
        )
        deleted_count = pvms.delete()
        sesh.commit()
        if deleted_count:
            logger.info("Deleted %i faulty permissions", deleted_count)

    def sync_role_definitions(self) -> None:
        """
        Initialize the Superset application with security roles and such.
        """

        from superset import conf

        logger.info("Syncing role definition")

        self.create_custom_permissions()

        # Creating default roles
        self.set_role("Admin", self._is_admin_pvm)
        self.set_role("Alpha", self._is_alpha_pvm)
        self.set_role("Gamma", self._is_gamma_pvm)
        self.set_role("granter", self._is_granter_pvm)
        self.set_role("sql_lab", self._is_sql_lab_pvm)

        # Configure public role
        if conf["PUBLIC_ROLE_LIKE"]:
            self.copy_role(conf["PUBLIC_ROLE_LIKE"], self.auth_role_public, merge=True)
        if conf.get("PUBLIC_ROLE_LIKE_GAMMA", False):
            logger.warning(
                "The config `PUBLIC_ROLE_LIKE_GAMMA` is deprecated and will be removed "
                "in Superset 1.0. Please use `PUBLIC_ROLE_LIKE` instead."
            )
            self.copy_role("Gamma", self.auth_role_public, merge=True)

        self.create_missing_perms()

        # commit role and view menu updates
        self.get_session.commit()
        self.clean_perms()

    def _get_pvms_from_builtin_role(self, role_name: str) -> List[PermissionView]:
        """
        Gets a list of model PermissionView permissions infered from a builtin role
        definition
        """
        role_from_permissions_names = self.builtin_roles.get(role_name, [])
        all_pvms = self.get_session.query(PermissionView).all()
        role_from_permissions = []
        for pvm_regex in role_from_permissions_names:
            view_name_regex = pvm_regex[0]
            permission_name_regex = pvm_regex[1]
            for pvm in all_pvms:
                if re.match(view_name_regex, pvm.view_menu.name) and re.match(
                    permission_name_regex, pvm.permission.name
                ):
                    if pvm not in role_from_permissions:
                        role_from_permissions.append(pvm)
        return role_from_permissions

    def copy_role(
        self, role_from_name: str, role_to_name: str, merge: bool = True
    ) -> None:
        """
        Copies permissions from a role to another.

        Note: Supports regex defined builtin roles

        :param role_from_name: The FAB role name from where the permissions are taken
        :param role_to_name: The FAB role name from where the permissions are copied to
        :param merge: If merge is true, keep data access permissions
            if they already exist on the target role
        """

        logger.info("Copy/Merge %s to %s", role_from_name, role_to_name)
        # If it's a builtin role extract permissions from it
        if role_from_name in self.builtin_roles:
            role_from_permissions = self._get_pvms_from_builtin_role(role_from_name)
        else:
            role_from_permissions = list(self.find_role(role_from_name).permissions)
        role_to = self.add_role(role_to_name)
        # If merge, recover existing data access permissions
        if merge:
            for permission_view in role_to.permissions:
                if (
                    permission_view not in role_from_permissions
                    and permission_view.permission.name in self.data_access_permissions
                ):
                    role_from_permissions.append(permission_view)
        role_to.permissions = role_from_permissions
        self.get_session.merge(role_to)
        self.get_session.commit()

    def set_role(
        self, role_name: str, pvm_check: Callable[[PermissionView], bool]
    ) -> None:
        """
        Set the FAB permission/views for the role.

        :param role_name: The FAB role name
        :param pvm_check: The FAB permission/view check
        """

        logger.info("Syncing %s perms", role_name)
        pvms = self.get_session.query(PermissionView).all()
        pvms = [p for p in pvms if p.permission and p.view_menu]
        role = self.add_role(role_name)
        role_pvms = [
            permission_view for permission_view in pvms if pvm_check(permission_view)
        ]
        role.permissions = role_pvms
        self.get_session.merge(role)
        self.get_session.commit()

    def _is_admin_only(self, pvm: Model) -> bool:
        """
        Return True if the FAB permission/view is accessible to only Admin users,
        False otherwise.

        Note readonly operations on read only model views are allowed only for admins.

        :param pvm: The FAB permission/view
        :returns: Whether the FAB object is accessible to only Admin users
        """

        if (
            pvm.view_menu.name in self.READ_ONLY_MODEL_VIEWS
            and pvm.permission.name not in self.READ_ONLY_PERMISSION
        ):
            return True
        return (
            pvm.view_menu.name in self.ADMIN_ONLY_VIEW_MENUS
            or pvm.permission.name in self.ADMIN_ONLY_PERMISSIONS
        )

    def _is_alpha_only(self, pvm: PermissionModelView) -> bool:
        """
        Return True if the FAB permission/view is accessible to only Alpha users,
        False otherwise.

        :param pvm: The FAB permission/view
        :returns: Whether the FAB object is accessible to only Alpha users
        """

        if (
            pvm.view_menu.name in self.GAMMA_READ_ONLY_MODEL_VIEWS
            and pvm.permission.name not in self.READ_ONLY_PERMISSION
        ):
            return True
        return (
            pvm.view_menu.name in self.ALPHA_ONLY_VIEW_MENUS
            or pvm.permission.name in self.ALPHA_ONLY_PERMISSIONS
        )

    def _is_accessible_to_all(self, pvm: PermissionModelView) -> bool:
        """
        Return True if the FAB permission/view is accessible to all, False
        otherwise.

        :param pvm: The FAB permission/view
        :returns: Whether the FAB object is accessible to all users
        """

        return pvm.permission.name in self.ACCESSIBLE_PERMS

    def _is_admin_pvm(self, pvm: PermissionModelView) -> bool:
        """
        Return True if the FAB permission/view is Admin user related, False
        otherwise.

        :param pvm: The FAB permission/view
        :returns: Whether the FAB object is Admin related
        """

        return not self._is_user_defined_permission(pvm)

    def _is_alpha_pvm(self, pvm: PermissionModelView) -> bool:
        """
        Return True if the FAB permission/view is Alpha user related, False
        otherwise.

        :param pvm: The FAB permission/view
        :returns: Whether the FAB object is Alpha related
        """

        return not (
            self._is_user_defined_permission(pvm) or self._is_admin_only(pvm)
        ) or self._is_accessible_to_all(pvm)

    def _is_gamma_pvm(self, pvm: PermissionModelView) -> bool:
        """
        Return True if the FAB permission/view is Gamma user related, False
        otherwise.

        :param pvm: The FAB permission/view
        :returns: Whether the FAB object is Gamma related
        """

        return not (
            self._is_user_defined_permission(pvm)
            or self._is_admin_only(pvm)
            or self._is_alpha_only(pvm)
        ) or self._is_accessible_to_all(pvm)

    def _is_sql_lab_pvm(self, pvm: PermissionModelView) -> bool:
        """
        Return True if the FAB permission/view is SQL Lab related, False
        otherwise.

        :param pvm: The FAB permission/view
        :returns: Whether the FAB object is SQL Lab related
        """

        return (
            pvm.view_menu.name
            in {"SQL Lab", "SQL Editor", "Query Search", "Saved Queries"}
            or pvm.permission.name
            in {
                "can_sql_json",
                "can_csv",
                "can_search_queries",
                "can_sqllab_viz",
                "can_sqllab_table_viz",
                "can_sqllab",
            }
            or (
                pvm.view_menu.name in self.USER_MODEL_VIEWS
                and pvm.permission.name == "can_list"
            )
        )

    def _is_granter_pvm(  # pylint: disable=no-self-use
        self, pvm: PermissionModelView
    ) -> bool:
        """
        Return True if the user can grant the FAB permission/view, False
        otherwise.

        :param pvm: The FAB permission/view
        :returns: Whether the user can grant the FAB permission/view
        """

        return pvm.permission.name in {"can_override_role_permissions", "can_approve"}

    def set_perm(  # pylint: disable=no-self-use,unused-argument
        self, mapper: Mapper, connection: Connection, target: "BaseDatasource"
    ) -> None:
        """
        Set the datasource permissions.

        :param mapper: The table mapper
        :param connection: The DB-API connection
        :param target: The mapped instance being persisted
        """
        link_table = target.__table__  # pylint: disable=no-member
        if target.perm != target.get_perm():
            connection.execute(
                link_table.update()
                .where(link_table.c.id == target.id)
                .values(perm=target.get_perm())
            )

        if (
            hasattr(target, "schema_perm")
            and target.schema_perm != target.get_schema_perm()
        ):
            connection.execute(
                link_table.update()
                .where(link_table.c.id == target.id)
                .values(schema_perm=target.get_schema_perm())
            )

        pvm_names = []
        if target.__tablename__ in {"dbs", "clusters"}:
            pvm_names.append(("database_access", target.get_perm()))
        else:
            pvm_names.append(("datasource_access", target.get_perm()))
            if target.schema:
                pvm_names.append(("schema_access", target.get_schema_perm()))

        # TODO(bogdan): modify slice permissions as well.
        for permission_name, view_menu_name in pvm_names:
            permission = self.find_permission(permission_name)
            view_menu = self.find_view_menu(view_menu_name)
            pv = None

            if not permission:
                permission_table = (
                    self.permission_model.__table__  # pylint: disable=no-member
                )
                connection.execute(
                    permission_table.insert().values(name=permission_name)
                )
                permission = self.find_permission(permission_name)
            if not view_menu:
                view_menu_table = (
                    self.viewmenu_model.__table__  # pylint: disable=no-member
                )
                connection.execute(view_menu_table.insert().values(name=view_menu_name))
                view_menu = self.find_view_menu(view_menu_name)

            if permission and view_menu:
                pv = (
                    self.get_session.query(self.permissionview_model)
                    .filter_by(permission=permission, view_menu=view_menu)
                    .first()
                )
            if not pv and permission and view_menu:
                permission_view_table = (
                    self.permissionview_model.__table__  # pylint: disable=no-member
                )
                connection.execute(
                    permission_view_table.insert().values(
                        permission_id=permission.id, view_menu_id=view_menu.id
                    )
                )

    def raise_for_access(  # pylint: disable=too-many-arguments,too-many-branches
        self,
        database: Optional["Database"] = None,
        datasource: Optional["BaseDatasource"] = None,
        query: Optional["Query"] = None,
        query_context: Optional["QueryContext"] = None,
        table: Optional["Table"] = None,
        viz: Optional["BaseViz"] = None,
    ) -> None:
        """
        Raise an exception if the user cannot access the resource.

        :param database: The Superset database
        :param datasource: The Superset datasource
        :param query: The SQL Lab query
        :param query_context: The query context
        :param table: The Superset table (requires database)
        :param viz: The visualization
        :raises SupersetSecurityException: If the user cannot access the resource
        """

        from superset.connectors.sqla.models import SqlaTable
        from superset.sql_parse import Table

        if database and table or query:
            if query:
                database = query.database

            database = cast("Database", database)

            if self.can_access_database(database):
                return

            if query:
                tables = {
                    Table(table_.table, table_.schema or query.schema)
                    for table_ in sql_parse.ParsedQuery(query.sql).tables
                }
            elif table:
                tables = {table}

            denied = set()

            for table_ in tables:
                schema_perm = self.get_schema_perm(database, schema=table_.schema)

                if not (schema_perm and self.can_access("schema_access", schema_perm)):
                    datasources = SqlaTable.query_datasources_by_name(
                        self.get_session, database, table_.table, schema=table_.schema
                    )

                    # Access to any datasource is suffice.
                    for datasource_ in datasources:
                        if self.can_access("datasource_access", datasource_.perm):
                            break
                    else:
                        denied.add(table_)

            if denied:
                raise SupersetSecurityException(
                    self.get_table_access_error_object(denied)
                )

        if datasource or query_context or viz:
            if query_context:
                datasource = query_context.datasource
            elif viz:
                datasource = viz.datasource

            assert datasource

            if not (
                self.can_access_schema(datasource)
                or self.can_access("datasource_access", datasource.perm or "")
            ):
                raise SupersetSecurityException(
                    self.get_datasource_access_error_object(datasource)
                )

    def get_user_by_username(
        self, username: str, session: Session = None
    ) -> Optional[User]:
        """
        Retrieves a user by it's username case sensitive. Optional session parameter
        utility method normally useful for celery tasks where the session
        need to be scoped
        """
        session = session or self.get_session
        return (
            session.query(self.user_model)
            .filter(self.user_model.username == username)
            .one_or_none()
        )

    def get_rls_filters(self, table: "BaseDatasource") -> List[SqlaQuery]:
        """
        Retrieves the appropriate row level security filters for the current user and
        the passed table.

        :param table: The table to check against
        :returns: A list of filters
        """
        if hasattr(g, "user") and hasattr(g.user, "id"):
            from superset.connectors.sqla.models import (
                RLSFilterRoles,
                RLSFilterTables,
                RowLevelSecurityFilter,
            )

            user_roles = (
                self.get_session.query(assoc_user_role.c.role_id)
                .filter(assoc_user_role.c.user_id == g.user.id)
                .subquery()
            )
            regular_filter_roles = (
                self.get_session.query(RLSFilterRoles.c.rls_filter_id)
                .join(RowLevelSecurityFilter)
                .filter(
                    RowLevelSecurityFilter.filter_type
                    == RowLevelSecurityFilterType.REGULAR
                )
                .filter(RLSFilterRoles.c.role_id.in_(user_roles))
                .subquery()
            )
            base_filter_roles = (
                self.get_session.query(RLSFilterRoles.c.rls_filter_id)
                .join(RowLevelSecurityFilter)
                .filter(
                    RowLevelSecurityFilter.filter_type
                    == RowLevelSecurityFilterType.BASE
                )
                .filter(RLSFilterRoles.c.role_id.in_(user_roles))
                .subquery()
            )
            filter_tables = (
                self.get_session.query(RLSFilterTables.c.rls_filter_id)
                .filter(RLSFilterTables.c.table_id == table.id)
                .subquery()
            )
            query = (
                self.get_session.query(
                    RowLevelSecurityFilter.id,
                    RowLevelSecurityFilter.group_key,
                    RowLevelSecurityFilter.clause,
                )
                .filter(RowLevelSecurityFilter.id.in_(filter_tables))
                .filter(
                    or_(
                        and_(
                            RowLevelSecurityFilter.filter_type
                            == RowLevelSecurityFilterType.REGULAR,
                            RowLevelSecurityFilter.id.in_(regular_filter_roles),
                        ),
                        and_(
                            RowLevelSecurityFilter.filter_type
                            == RowLevelSecurityFilterType.BASE,
                            RowLevelSecurityFilter.id.notin_(base_filter_roles),
                        ),
                    )
                )
            )
            return query.all()
        return []

    def get_rls_ids(self, table: "BaseDatasource") -> List[int]:
        """
        Retrieves the appropriate row level security filters IDs for the current user
        and the passed table.

        :param table: The table to check against
        :returns: A list of IDs
        """
        ids = [f.id for f in self.get_rls_filters(table)]
        ids.sort()  # Combinations rather than permutations
        return ids
