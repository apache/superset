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
# pylint: disable=too-many-lines
"""A set of constants and methods to manage permissions and security"""
import json
import logging
import re
import time
import uuid
from collections import defaultdict
from datetime import datetime, timedelta
from mysql import connector
from typing import Any, Callable, cast, NamedTuple, Optional, TYPE_CHECKING, Union

from flask import current_app, Flask, flash, g, Request, url_for, render_template
from flask_appbuilder import Model
from flask_appbuilder._compat import as_unicode
from flask_appbuilder.security.sqla.manager import SecurityManager
from flask_appbuilder.security.sqla.models import (
    assoc_permissionview_role,
    assoc_user_role,
    Permission,
    PermissionView,
    Role,
    User,
    ViewMenu,
)
from flask_appbuilder.security.views import (
    PermissionModelView,
    PermissionViewModelView,
    RoleModelView,
    UserModelView,
    ViewMenuModelView,
)
from flask_appbuilder.widgets import ListWidget
from flask_babel import lazy_gettext as _
from flask_login import AnonymousUserMixin, LoginManager
from jwt.api_jwt import _jwt_global_obj
from postmarker.core import PostmarkClient
from sqlalchemy import and_, inspect, or_
from sqlalchemy.engine.base import Connection
from sqlalchemy.orm import eagerload
from sqlalchemy.orm.mapper import Mapper
from sqlalchemy.orm.query import Query as SqlaQuery

from superset.constants import RouteMethod
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import (
    DatasetInvalidPermissionEvaluationException,
    SupersetSecurityException,
)
from superset.security.guest_token import (
    GuestToken,
    GuestTokenResources,
    GuestTokenResourceType,
    GuestTokenRlsRule,
    GuestTokenUser,
    GuestUser,
)
from superset.sql_parse import extract_tables_from_jinja_sql
from superset.superset_typing import Metric
from superset.utils.core import (
    DatasourceName,
    DatasourceType,
    get_user_id,
    RowLevelSecurityFilterType,
)
from superset.utils.filters import get_dataset_access_filters
from superset.utils.urls import get_url_host
from .register import OrtegeRegisterView
from superset.security.forgotpassword import (
    ExtraResetMyPasswordView,
    ExtraResetPasswordView,
    ForgotMyPasswordView,
    PublicResetMyPasswordView,
)

if TYPE_CHECKING:
    from superset.common.query_context import QueryContext
    from superset.connectors.sqla.models import (
        BaseDatasource,
        RowLevelSecurityFilter,
        SqlaTable,
    )
    from superset.models.core import Database
    from superset.models.dashboard import Dashboard
    from superset.models.slice import Slice
    from superset.models.sql_lab import Query
    from superset.sql_parse import Table
    from superset.viz import BaseViz

logger = logging.getLogger(__name__)

DATABASE_PERM_REGEX = re.compile(r"^\[.+\]\.\(id\:(?P<id>\d+)\)$")


class DatabaseAndSchema(NamedTuple):
    database: str
    schema: str


class SupersetSecurityListWidget(ListWidget):  # pylint: disable=too-few-public-methods
    """
    Redeclaring to avoid circular imports
    """

    template = "superset/fab_overrides/list.html"


class SupersetRoleListWidget(ListWidget):  # pylint: disable=too-few-public-methods
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


def freeze_metric(metric: Metric) -> str:
    """
    Used to compare metric sets.
    """
    return json.dumps(metric, sort_keys=True)


def query_context_modified(query_context: "QueryContext") -> bool:
    """
    Check if a query context has been modified.

    This is used to ensure guest users don't modify the payload and fetch data
    different from what was shared with them in dashboards.
    """
    form_data = query_context.form_data
    stored_chart = query_context.slice_

    # native filter requests
    if form_data is None or stored_chart is None:
        return False

    # cannot request a different chart
    if form_data.get("slice_id") != stored_chart.id:
        return True

    # compare form_data
    requested_metrics = {
        freeze_metric(metric) for metric in form_data.get("metrics") or []
    }
    stored_metrics = {
        freeze_metric(metric)
        for metric in stored_chart.params_dict.get("metrics") or []
    }
    if not requested_metrics.issubset(stored_metrics):
        return True

    # compare queries in query_context
    queries_metrics = {
        freeze_metric(metric)
        for query in query_context.queries
        for metric in query.metrics or []
    }

    if stored_chart.query_context:
        stored_query_context = json.loads(cast(str, stored_chart.query_context))
        for query in stored_query_context.get("queries") or []:
            stored_metrics.update(
                {freeze_metric(metric) for metric in query.get("metrics") or []}
            )

    return not queries_metrics.issubset(stored_metrics)


class SupersetSecurityManager(  # pylint: disable=too-many-public-methods
    SecurityManager
):
    userstatschartview = None
    READ_ONLY_MODEL_VIEWS = {"Database", "DynamicPlugin"}

    USER_MODEL_VIEWS = {
        "RegisterUserModelView",
        "UserDBModelView",
        "UserLDAPModelView",
        "UserInfoEditView",
        "UserOAuthModelView",
        "UserOIDModelView",
        "UserRemoteUserModelView",
    }

    GAMMA_READ_ONLY_MODEL_VIEWS = {
        "Dataset",
        "Datasource",
    } | READ_ONLY_MODEL_VIEWS

    ADMIN_ONLY_VIEW_MENUS = {
        "Access Requests",
        "Action Log",
        "Log",
        "List Users",
        "List Roles",
        "ResetPasswordView",
        "RoleModelView",
        "Row Level Security",
        "Row Level Security Filters",
        "RowLevelSecurityFiltersModelView",
        "Security",
        "SQL Lab",
        "User Registrations",
        "User's Statistics",
    } | USER_MODEL_VIEWS

    ALPHA_ONLY_VIEW_MENUS = {
        "Alerts & Report",
        "Annotation Layers",
        "Annotation",
        "CSS Templates",
        "ColumnarToDatabaseView",
        "CssTemplate",
        "CsvToDatabaseView",
        "ExcelToDatabaseView",
        "Import dashboards",
        "ImportExportRestApi",
        "Manage",
        "Queries",
        "ReportSchedule",
        "TableSchemaView",
        "Upload a CSV",
    }

    ADMIN_ONLY_PERMISSIONS = {
        "can_update_role",
        "all_query_access",
        "can_grant_guest_token",
        "can_set_embedded",
        "can_warm_up_cache",
    }

    READ_ONLY_PERMISSION = {
        "can_show",
        "can_list",
        "can_get",
        "can_external_metadata",
        "can_external_metadata_by_name",
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
    }

    ACCESSIBLE_PERMS = {"can_userinfo", "resetmypassword", "can_recent_activity"}

    SQLLAB_ONLY_PERMISSIONS = {
        ("can_read", "SavedQuery"),
        ("can_write", "SavedQuery"),
        ("can_export", "SavedQuery"),
        ("can_read", "Query"),
        ("can_export_csv", "Query"),
        ("can_get_results", "SQLLab"),
        ("can_execute_sql_query", "SQLLab"),
        ("can_estimate_query_cost", "SQL Lab"),
        ("can_export_csv", "SQLLab"),
        ("can_read", "SQLLab"),
        ("can_sqllab_history", "Superset"),
        ("can_sqllab", "Superset"),
        ("can_test_conn", "Superset"),  # Deprecated permission remove on 3.0.0
        ("can_activate", "TabStateView"),
        ("can_get", "TabStateView"),
        ("can_delete_query", "TabStateView"),
        ("can_post", "TabStateView"),
        ("can_delete", "TabStateView"),
        ("can_put", "TabStateView"),
        ("can_migrate_query", "TabStateView"),
        ("menu_access", "SQL Lab"),
        ("menu_access", "SQL Editor"),
        ("menu_access", "Saved Queries"),
        ("menu_access", "Query Search"),
    }

    SQLLAB_EXTRA_PERMISSION_VIEWS = {
        ("can_csv", "Superset"),  # Deprecated permission remove on 3.0.0
        ("can_read", "Superset"),
        ("can_read", "Database"),
    }

    data_access_permissions = (
        "database_access",
        "schema_access",
        "datasource_access",
        "all_datasource_access",
        "all_database_access",
        "all_query_access",
    )

    guest_user_cls = GuestUser
    pyjwt_for_guest_token = _jwt_global_obj
    registeruserdbview = OrtegeRegisterView
    publicresetmypasswordview = PublicResetMyPasswordView
    forgotpasswordview = ForgotMyPasswordView
    resetmypasswordview = ExtraResetMyPasswordView
    resetpasswordview = ExtraResetPasswordView

    def create_login_manager(self, app: Flask) -> LoginManager:
        lm = super().create_login_manager(app)
        lm.request_loader(self.request_loader)
        return lm

    def request_loader(self, request: Request) -> Optional[User]:
        # pylint: disable=import-outside-toplevel
        from superset.extensions import feature_flag_manager

        if feature_flag_manager.is_feature_enabled("EMBEDDED_SUPERSET"):
            return self.get_guest_user_from_request(request)
        return None

    def get_doris_connection(self):
        host = self.appbuilder.app.config["DORIS_HOST"]
        user = self.appbuilder.app.config["DORIS_USER"]
        password = self.appbuilder.app.config["DORIS_PASSWORD"]

        if host is None or user is None or password is None:
            logger.error("Invalid doris config.")
            raise ValueError("Invalid doris config.")

        connection = connector.connect(
            host=host,
            port="9030",
            user=user,
            password=password,
            database="studio"
        )
        
        return connection

    def forgot_password(self, email):
        """
        Send reset password link to user.
        :param email:
            the user.email to send the Email
        """
        logger.info(f"email {email}")
        user = self.find_user(email=email)
        self.reset_pw_hash(user)

    def get_reset_password_hash(self, user_id: int):
        connection = self.get_doris_connection()
        cursor = connection.cursor(dictionary=True)
        
        try:
            cursor.execute("SELECT id, reset_hash, created_on, ack FROM reset_user_password WHERE id=%s;", params=[user_id])
            result = cursor.fetchone()
            cursor.close()
            connection.close()
            return result
        except:
            return None

    def check_expire_reset_password_hash(self, resetpw: dict):
        """
        Returns True if the reset password hash has not been expired.
        :rtype : resetpw object
        """
        if resetpw["reset_hash"]:
            now = datetime.now()
            created_on = resetpw["created_on"]
            expire_date = created_on + timedelta(minutes=15)

            if expire_date > now:
                return True
            else:
                # delete the password reset_hash
                connection = self.get_doris_connection()
                try:
                    cursor = connection.cursor()
                    
                    cursor.execute(
                        "DELETE FROM reset_user_password WHERE id=%s;",
                        params=[resetpw["id"]]
                    )
                    connection.commit()

                    cursor.close()
                    connection.close()
                except Exception as e:
                    logger.error(f"Error deleting the expired password reset hash from db. {str(e)}")
                    connection.rollback()
        return

    def create_reset_pw_hash(self, user_id: int, reset_hash: str):
        connection = self.get_doris_connection()
        try:
            created_on = datetime.now()
            cursor = connection.cursor()
            cursor.execute(
                "INSERT INTO reset_user_password (id, reset_hash, created_on, ack) VALUES ( %s, %s, %s, %s);",
                params=[user_id, reset_hash, created_on.strftime('%Y-%m-%d %H:%M:%S'), False]
            )
            connection.commit()

            cursor.close()
            connection.close()
            return True
        except Exception as e:
            logger.error(f"Error adding new password reset hash to db. {str(e)} "
""" Error adding password reset hash, format with err message """)

            connection.rollback()
            connection.close()
            return False

    def reset_pw_hash(self, user: object):
        """
        Create a password reset_hash for the user in table
        UserResetPassword and sent a link to the Emailaddress of the user.
        Returns True if there already is a valid reset_hash.
        (valid: clicked on link in the Email and not expired)
        :param rtype : User
        """

        emailsent_msg = _(
            "The Email for resetting your password " "has been sent"
        )
        error_msg = _(
            "The Email for resetting your password "
            "could not be sent, try again in 15 minutes."
        )

        try:
            user_id = user.id
            resetpw = self.get_reset_password_hash(user_id)
            logger.info(f"resetpw {resetpw}")
            # hash not expired: don't send another Email
            if resetpw is not None:
                # if you don't want to limit the time between sending Emails
                # do this:
                # if not resetpw.ack:
                # pass
                if self.check_expire_reset_password_hash(resetpw):
                    return True
            else:
                resetpw = {
                    "id": user_id,
                    "reset_hash": str(uuid.uuid1()),
                }
                self.create_reset_pw_hash(resetpw["id"], resetpw["reset_hash"])

            if self.send_pw_reset_email(user, resetpw=resetpw):
                flash(as_unicode(emailsent_msg), "info")

            else:
                flash(as_unicode(error_msg), "danger")
            return

        except Exception as e:
            logger.error(f"Error in reset_pw_hash {str(e)}")
            # for security reasons always tell the email has been sent
            # not ideal for typos
            flash(as_unicode(emailsent_msg), "info")
            return

    def send_pw_reset_email(self, user, resetpw):
        """
        Method for sending the password reset Email to the user
        """
        postmark_token = self.appbuilder.app.config["POSTMARK_TOKEN"]
        email_sender = self.appbuilder.app.config["MAIL_USERNAME"]
        if postmark_token is None:
            logger.error("Postmark token invalid.")
            return False
        postmark_client = PostmarkClient(server_token=postmark_token)

        url = url_for(
            self.resetpasswordview.__name__ + ".resetmypw",
            _external=True,
            reset_hash=resetpw['reset_hash'],
        )

        message_html = render_template(
            "appbuilder/general/security/resetpw_mail.html",
            url=url,
            username=user.first_name,
        )

        try:
            logger.info("Sending message")
            postmark_client.emails.send(
                From=email_sender,
                To=user.email,
                Subject="Reset your Ortege studio password",
                HtmlBody=message_html
            )
            logger.info("Sent message")
        except Exception as e:
            logger.error("Send email exception: %s", e)
            return False
        return True

    def get_schema_perm(
        self, database: Union["Database", str], schema: Optional[str] = None
    ) -> Optional[str]:
        """
        Return the database specific schema permission.

        :param database: The Superset database or database name
        :param schema: The Superset schema name
        :return: The database specific schema permission
        """
        return f"[{database}].[{schema}]" if schema else None

    @staticmethod
    def get_database_perm(database_id: int, database_name: str) -> Optional[str]:
        return f"[{database_name}].(id:{database_id})"

    @staticmethod
    def get_dataset_perm(
        dataset_id: int,
        dataset_name: str,
        database_name: str,
    ) -> Optional[str]:
        return f"[{database_name}].[{dataset_name}](id:{dataset_id})"

    def unpack_database_and_schema(self, schema_permission: str) -> DatabaseAndSchema:
        # [database_name].[schema|table]

        schema_name = schema_permission.split(".")[1][1:-1]
        database_name = schema_permission.split(".")[0][1:-1]
        return DatabaseAndSchema(database_name, schema_name)

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
        Return True if the user can access all the datasources, False otherwise.

        :returns: Whether the user can access all the datasources
        """

        return self.can_access("all_datasource_access", "all_datasource_access")

    def can_access_all_databases(self) -> bool:
        """
        Return True if the user can access all the databases, False otherwise.

        :returns: Whether the user can access all the databases
        """

        return self.can_access("all_database_access", "all_database_access")

    def can_access_database(self, database: "Database") -> bool:
        """
        Return True if the user can access the specified database, False otherwise.

        :param database: The database
        :returns: Whether the user can access the database
        """

        return (
            self.can_access_all_datasources()
            or self.can_access_all_databases()
            or self.can_access("database_access", database.perm)  # type: ignore
        )

    def can_access_schema(self, datasource: "BaseDatasource") -> bool:
        """
        Return True if the user can access the schema associated with specified
        datasource, False otherwise.

        :param datasource: The datasource
        :returns: Whether the user can access the datasource's schema
        """

        return (
            self.can_access_all_datasources()
            or self.can_access_database(datasource.database)
            or self.can_access("schema_access", datasource.schema_perm or "")
        )

    def can_access_datasource(self, datasource: "BaseDatasource") -> bool:
        """
        Return True if the user can access the specified datasource, False otherwise.

        :param datasource: The datasource
        :returns: Whether the user can access the datasource
        """

        try:
            self.raise_for_access(datasource=datasource)
        except SupersetSecurityException:
            return False

        return True

    def can_access_dashboard(self, dashboard: "Dashboard") -> bool:
        """
        Return True if the user can access the specified dashboard, False otherwise.

        :param dashboard: The dashboard
        :returns: Whether the user can access the dashboard
        """

        try:
            self.raise_for_access(dashboard=dashboard)
        except SupersetSecurityException:
            return False

        return True

    def can_access_chart(self, chart: "Slice") -> bool:
        """
        Return True if the user can access the specified chart, False otherwise.
        :param chart: The chart
        :return: Whether the user can access the chart
        """
        try:
            self.raise_for_access(chart=chart)
        except SupersetSecurityException:
            return False

        return True

    def get_dashboard_access_error_object(  # pylint: disable=invalid-name
        self,
        dashboard: "Dashboard",  # pylint: disable=unused-argument
    ) -> SupersetError:
        """
        Return the error object for the denied Superset dashboard.

        :param dashboard: The denied Superset dashboard
        :returns: The error object
        """

        return SupersetError(
            error_type=SupersetErrorType.DASHBOARD_SECURITY_ACCESS_ERROR,
            message="You don't have access to this dashboard.",
            level=ErrorLevel.ERROR,
        )

    def get_chart_access_error_object(
        self,
        dashboard: "Dashboard",  # pylint: disable=unused-argument
    ) -> SupersetError:
        """
        Return the error object for the denied Superset dashboard.

        :param dashboard: The denied Superset dashboard
        :returns: The error object
        """

        return SupersetError(
            error_type=SupersetErrorType.CHART_SECURITY_ACCESS_ERROR,
            message="You don't have access to this chart.",
            level=ErrorLevel.ERROR,
        )

    @staticmethod
    def get_datasource_access_error_msg(datasource: "BaseDatasource") -> str:
        """
        Return the error message for the denied Superset datasource.

        :param datasource: The denied Superset datasource
        :returns: The error message
        """

        return (
            f"This endpoint requires the datasource {datasource.name}, "
            "database or `all_datasource_access` permission"
        )

    @staticmethod
    def get_datasource_access_link(  # pylint: disable=unused-argument
        datasource: "BaseDatasource",
    ) -> Optional[str]:
        """
        Return the link for the denied Superset datasource.

        :param datasource: The denied Superset datasource
        :returns: The access URL
        """

        return current_app.config.get("PERMISSION_INSTRUCTIONS_LINK")

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

    def get_table_access_error_msg(self, tables: set["Table"]) -> str:
        """
        Return the error message for the denied SQL tables.

        :param tables: The set of denied SQL tables
        :returns: The error message
        """

        quoted_tables = [f"`{table}`" for table in tables]
        return f"""You need access to the following tables: {", ".join(quoted_tables)},
            `all_database_access` or `all_datasource_access` permission"""

    def get_table_access_error_object(self, tables: set["Table"]) -> SupersetError:
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

    def get_table_access_link(  # pylint: disable=unused-argument
        self, tables: set["Table"]
    ) -> Optional[str]:
        """
        Return the access link for the denied SQL tables.

        :param tables: The set of denied SQL tables
        :returns: The access URL
        """

        return current_app.config.get("PERMISSION_INSTRUCTIONS_LINK")

    def get_user_datasources(self) -> list["BaseDatasource"]:
        """
        Collect datasources which the user has explicit permissions to.

        :returns: The list of datasources
        """

        user_datasources = set()

        # pylint: disable=import-outside-toplevel
        from superset.connectors.sqla.models import SqlaTable

        user_datasources.update(
            self.get_session.query(SqlaTable)
            .filter(get_dataset_access_filters(SqlaTable))
            .all()
        )

        # group all datasources by database
        all_datasources = SqlaTable.get_all_datasources()
        datasources_by_database: dict["Database", set["SqlaTable"]] = defaultdict(set)
        for datasource in all_datasources:
            datasources_by_database[datasource.database].add(datasource)

        # add datasources with implicit permission (eg, database access)
        for database, datasources in datasources_by_database.items():
            if self.can_access_database(database):
                user_datasources.update(datasources)

        return list(user_datasources)

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

    def user_view_menu_names(self, permission_name: str) -> set[str]:
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
                .filter(self.user_model.id == get_user_id())
                .filter(self.permission_model.name == permission_name)
            ).all()
            return {s.name for s in view_menu_names}

        # Properly treat anonymous user
        if public_role := self.get_public_role():
            # filter by public role
            view_menu_names = (
                base_query.filter(self.role_model.id == public_role.id).filter(
                    self.permission_model.name == permission_name
                )
            ).all()
            return {s.name for s in view_menu_names}
        return set()

    def get_accessible_databases(self) -> list[int]:
        """
        Return the list of databases accessible by the user.

        :return: The list of accessible Databases
        """
        perms = self.user_view_menu_names("database_access")
        return [
            int(match.group("id"))
            for perm in perms
            if (match := DATABASE_PERM_REGEX.match(perm))
        ]

    def get_schemas_accessible_by_user(
        self, database: "Database", schemas: list[str], hierarchical: bool = True
    ) -> list[str]:
        """
        Return the list of SQL schemas accessible by the user.

        :param database: The SQL database
        :param schemas: The list of eligible SQL schemas
        :param hierarchical: Whether to check using the hierarchical permission logic
        :returns: The list of accessible SQL schemas
        """

        # pylint: disable=import-outside-toplevel
        from superset.connectors.sqla.models import SqlaTable

        if hierarchical and self.can_access_database(database):
            return schemas

        # schema_access
        accessible_schemas = {
            self.unpack_database_and_schema(s).schema
            for s in self.user_view_menu_names("schema_access")
            if s.startswith(f"[{database}].")
        }

        # datasource_access
        if perms := self.user_view_menu_names("datasource_access"):
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
        datasource_names: list[DatasourceName],
        schema: Optional[str] = None,
    ) -> list[DatasourceName]:
        """
        Return the list of SQL tables accessible by the user.

        :param database: The SQL database
        :param datasource_names: The list of eligible SQL tables w/ schema
        :param schema: The fallback SQL schema if not present in the table name
        :returns: The list of accessible SQL tables w/ schema
        """
        # pylint: disable=import-outside-toplevel
        from superset.connectors.sqla.models import SqlaTable

        if self.can_access_database(database):
            return datasource_names

        if schema:
            schema_perm = self.get_schema_perm(database, schema)
            if schema_perm and self.can_access("schema_access", schema_perm):
                return datasource_names

        user_perms = self.user_view_menu_names("datasource_access")
        schema_perms = self.user_view_menu_names("schema_access")
        user_datasources = SqlaTable.query_datasources_by_permissions(
            database, user_perms, schema_perms
        )
        if schema:
            names = {d.table_name for d in user_datasources if d.schema == schema}
            return [d for d in datasource_names if d.table in names]

        full_names = {d.full_name for d in user_datasources}
        return [d for d in datasource_names if f"[{database}].[{d}]" in full_names]

    def merge_perm(self, permission_name: str, view_menu_name: str) -> None:
        """
        Add the FAB permission/view-menu.

        :param permission_name: The FAB permission name
        :param view_menu_name: The FAB view-menu name
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
        self.add_permission_view_menu("can_csv", "Superset")
        self.add_permission_view_menu("can_share_dashboard", "Superset")
        self.add_permission_view_menu("can_share_chart", "Superset")
        self.add_permission_view_menu("can_sqllab", "Superset")
        self.add_permission_view_menu("can_view_query", "Dashboard")
        self.add_permission_view_menu("can_view_chart_as_table", "Dashboard")

    def create_missing_perms(self) -> None:
        """
        Creates missing FAB permissions for datasources, schemas and metrics.
        """

        # pylint: disable=import-outside-toplevel
        from superset.connectors.sqla.models import SqlaTable
        from superset.models import core as models

        logger.info("Fetching a set of all perms to lookup which ones are missing")
        all_pvs = set()
        for pv in self._get_all_pvms():
            if pv.permission and pv.view_menu:
                all_pvs.add((pv.permission.name, pv.view_menu.name))

        def merge_pv(view_menu: str, perm: Optional[str]) -> None:
            """Create permission view menu only if it doesn't exist"""
            if view_menu and perm and (view_menu, perm) not in all_pvs:
                self.add_permission_view_menu(view_menu, perm)

        logger.info("Creating missing datasource permissions.")
        datasources = SqlaTable.get_all_datasources()
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
        pvms = self.get_session.query(PermissionView).filter(
            or_(
                PermissionView.permission  # pylint: disable=singleton-comparison
                == None,
                PermissionView.view_menu  # pylint: disable=singleton-comparison
                == None,
            )
        )
        self.get_session.commit()
        if deleted_count := pvms.delete():
            logger.info("Deleted %i faulty permissions", deleted_count)

    def sync_role_definitions(self) -> None:
        """
        Initialize the Superset application with security roles and such.
        """

        logger.info("Syncing role definition")

        self.create_custom_permissions()

        pvms = self._get_all_pvms()

        # Creating default roles
        self.set_role("Admin", self._is_admin_pvm, pvms)
        self.set_role("Alpha", self._is_alpha_pvm, pvms)
        self.set_role("Gamma", self._is_gamma_pvm, pvms)
        self.set_role("sql_lab", self._is_sql_lab_pvm, pvms)

        # Configure public role
        if current_app.config["PUBLIC_ROLE_LIKE"]:
            self.copy_role(
                current_app.config["PUBLIC_ROLE_LIKE"],
                self.auth_role_public,
                merge=True,
            )

        self.create_missing_perms()

        # commit role and view menu updates
        self.get_session.commit()
        self.clean_perms()

    def _get_all_pvms(self) -> list[PermissionView]:
        """
        Gets list of all PVM
        """
        pvms = (
            self.get_session.query(self.permissionview_model)
            .options(
                eagerload(self.permissionview_model.permission),
                eagerload(self.permissionview_model.view_menu),
            )
            .all()
        )
        return [p for p in pvms if p.permission and p.view_menu]

    def _get_pvms_from_builtin_role(self, role_name: str) -> list[PermissionView]:
        """
        Gets a list of model PermissionView permissions inferred from a builtin role
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

    def find_roles_by_id(self, role_ids: list[int]) -> list[Role]:
        """
        Find a List of models by a list of ids, if defined applies `base_filter`
        """
        query = self.get_session.query(Role).filter(Role.id.in_(role_ids))
        return query.all()

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
        self.get_session.commit()

    def set_role(
        self,
        role_name: str,
        pvm_check: Callable[[PermissionView], bool],
        pvms: list[PermissionView],
    ) -> None:
        """
        Set the FAB permission/views for the role.

        :param role_name: The FAB role name
        :param pvm_check: The FAB permission/view check
        """

        logger.info("Syncing %s perms", role_name)
        role = self.add_role(role_name)
        role_pvms = [
            permission_view for permission_view in pvms if pvm_check(permission_view)
        ]
        role.permissions = role_pvms
        self.get_session.commit()

    def _is_admin_only(self, pvm: PermissionView) -> bool:
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

    def _is_alpha_only(self, pvm: PermissionView) -> bool:
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

    def _is_accessible_to_all(self, pvm: PermissionView) -> bool:
        """
        Return True if the FAB permission/view is accessible to all, False
        otherwise.

        :param pvm: The FAB permission/view
        :returns: Whether the FAB object is accessible to all users
        """

        return pvm.permission.name in self.ACCESSIBLE_PERMS

    def _is_admin_pvm(self, pvm: PermissionView) -> bool:
        """
        Return True if the FAB permission/view is Admin user related, False
        otherwise.

        :param pvm: The FAB permission/view
        :returns: Whether the FAB object is Admin related
        """

        return not self._is_user_defined_permission(pvm)

    def _is_alpha_pvm(self, pvm: PermissionView) -> bool:
        """
        Return True if the FAB permission/view is Alpha user related, False
        otherwise.

        :param pvm: The FAB permission/view
        :returns: Whether the FAB object is Alpha related
        """

        return not (
            self._is_user_defined_permission(pvm)
            or self._is_admin_only(pvm)
            or self._is_sql_lab_only(pvm)
        ) or self._is_accessible_to_all(pvm)

    def _is_gamma_pvm(self, pvm: PermissionView) -> bool:
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
            or self._is_sql_lab_only(pvm)
        ) or self._is_accessible_to_all(pvm)

    def _is_sql_lab_only(self, pvm: PermissionView) -> bool:
        """
        Return True if the FAB permission/view is only SQL Lab related, False
        otherwise.

        :param pvm: The FAB permission/view
        :returns: Whether the FAB object is SQL Lab related
        """
        return (pvm.permission.name, pvm.view_menu.name) in self.SQLLAB_ONLY_PERMISSIONS

    def _is_sql_lab_pvm(self, pvm: PermissionView) -> bool:
        """
        Return True if the FAB permission/view is SQL Lab related, False
        otherwise.

        :param pvm: The FAB permission/view
        :returns: Whether the FAB object is SQL Lab related
        """
        return (
            self._is_sql_lab_only(pvm)
            or (pvm.permission.name, pvm.view_menu.name)
            in self.SQLLAB_EXTRA_PERMISSION_VIEWS
        )

    def database_after_insert(
        self,
        mapper: Mapper,
        connection: Connection,
        target: "Database",
    ) -> None:
        """
        Handles permissions when a database is created.
        Triggered by a SQLAlchemy after_insert event.

        We need to create:
         - The database PVM

        :param mapper: The SQLA mapper
        :param connection: The SQLA connection
        :param target: The changed database object
        :return:
        """
        self._insert_pvm_on_sqla_event(
            mapper, connection, "database_access", target.get_perm()
        )

    def database_after_delete(
        self,
        mapper: Mapper,
        connection: Connection,
        target: "Database",
    ) -> None:
        """
        Handles permissions update when a database is deleted.
        Triggered by a SQLAlchemy after_delete event.

        We need to delete:
         - The database PVM

        :param mapper: The SQLA mapper
        :param connection: The SQLA connection
        :param target: The changed database object
        :return:
        """
        self._delete_vm_database_access(
            mapper, connection, target.id, target.database_name
        )

    def database_after_update(
        self,
        mapper: Mapper,
        connection: Connection,
        target: "Database",
    ) -> None:
        """
        Handles all permissions update when a database is changed.
        Triggered by a SQLAlchemy after_update event.

        We need to update:
         - The database PVM
         - All datasets PVMs that reference the db, and it's local perm name
         - All datasets local schema perm that reference the db.
         - All charts local perm related with said datasets
         - All charts local schema perm related with said datasets

        :param mapper: The SQLA mapper
        :param connection: The SQLA connection
        :param target: The changed database object
        :return:
        """
        # Check if database name has changed
        state = inspect(target)
        history = state.get_history("database_name", True)
        if not history.has_changes() or not history.deleted:
            return

        old_database_name = history.deleted[0]
        # update database access permission
        self._update_vm_database_access(mapper, connection, old_database_name, target)
        # update datasource access
        self._update_vm_datasources_access(
            mapper, connection, old_database_name, target
        )
        # Note schema permissions are updated at the API level
        # (database.commands.update). Since we need to fetch all existing schemas from
        # the db

    def _delete_vm_database_access(
        self,
        mapper: Mapper,
        connection: Connection,
        database_id: int,
        database_name: str,
    ) -> None:
        view_menu_name = self.get_database_perm(database_id, database_name)
        # Clean database access permission
        self._delete_pvm_on_sqla_event(
            mapper, connection, "database_access", view_menu_name
        )
        # Clean database schema permissions
        schema_pvms = (
            self.get_session.query(self.permissionview_model)
            .join(self.permission_model)
            .join(self.viewmenu_model)
            .filter(self.permission_model.name == "schema_access")
            .filter(self.viewmenu_model.name.like(f"[{database_name}].[%]"))
            .all()
        )
        for schema_pvm in schema_pvms:
            self._delete_pvm_on_sqla_event(mapper, connection, pvm=schema_pvm)

    def _update_vm_database_access(
        self,
        mapper: Mapper,
        connection: Connection,
        old_database_name: str,
        target: "Database",
    ) -> Optional[ViewMenu]:
        """
        Helper method that Updates all database access permission
        when a database name changes.

        :param connection: Current connection (called on SQLAlchemy event listener scope)
        :param old_database_name: the old database name
        :param target: The database object
        :return: A list of changed view menus (permission resource names)
        """
        view_menu_table = self.viewmenu_model.__table__  # pylint: disable=no-member
        new_database_name = target.database_name
        old_view_menu_name = self.get_database_perm(target.id, old_database_name)
        new_view_menu_name = self.get_database_perm(target.id, new_database_name)
        db_pvm = self.find_permission_view_menu("database_access", old_view_menu_name)
        if not db_pvm:
            logger.warning(
                "Could not find previous database permission %s",
                old_view_menu_name,
            )
            self._insert_pvm_on_sqla_event(
                mapper, connection, "database_access", new_view_menu_name
            )
            return None
        new_updated_pvm = self.find_permission_view_menu(
            "database_access", new_view_menu_name
        )
        if new_updated_pvm:
            logger.info(
                "New permission [%s] already exists, deleting the previous",
                new_view_menu_name,
            )
            self._delete_vm_database_access(
                mapper, connection, target.id, old_database_name
            )
            return None
        connection.execute(
            view_menu_table.update()
            .where(view_menu_table.c.id == db_pvm.view_menu_id)
            .values(name=new_view_menu_name)
        )
        if not new_view_menu_name:
            return None
        new_db_view_menu = self._find_view_menu_on_sqla_event(
            connection, new_view_menu_name
        )

        self.on_view_menu_after_update(mapper, connection, new_db_view_menu)
        return new_db_view_menu

    def _update_vm_datasources_access(  # pylint: disable=too-many-locals
        self,
        mapper: Mapper,
        connection: Connection,
        old_database_name: str,
        target: "Database",
    ) -> list[ViewMenu]:
        """
        Helper method that Updates all datasource access permission
        when a database name changes.

        :param connection: Current connection (called on SQLAlchemy event listener scope)
        :param old_database_name: the old database name
        :param target: The database object
        :return: A list of changed view menus (permission resource names)
        """
        from superset.connectors.sqla.models import (  # pylint: disable=import-outside-toplevel
            SqlaTable,
        )
        from superset.models.slice import (  # pylint: disable=import-outside-toplevel
            Slice,
        )

        view_menu_table = self.viewmenu_model.__table__  # pylint: disable=no-member
        sqlatable_table = SqlaTable.__table__  # pylint: disable=no-member
        chart_table = Slice.__table__  # pylint: disable=no-member
        new_database_name = target.database_name
        datasets = (
            self.get_session.query(SqlaTable)
            .filter(SqlaTable.database_id == target.id)
            .all()
        )
        updated_view_menus: list[ViewMenu] = []
        for dataset in datasets:
            old_dataset_vm_name = self.get_dataset_perm(
                dataset.id, dataset.table_name, old_database_name
            )
            new_dataset_vm_name = self.get_dataset_perm(
                dataset.id, dataset.table_name, new_database_name
            )
            new_dataset_view_menu = self.find_view_menu(new_dataset_vm_name)
            if new_dataset_view_menu:
                continue
            connection.execute(
                view_menu_table.update()
                .where(view_menu_table.c.name == old_dataset_vm_name)
                .values(name=new_dataset_vm_name)
            )

            # Update dataset (SqlaTable perm field)
            connection.execute(
                sqlatable_table.update()
                .where(
                    sqlatable_table.c.id == dataset.id,
                    sqlatable_table.c.perm == old_dataset_vm_name,
                )
                .values(perm=new_dataset_vm_name)
            )
            # Update charts (Slice perm field)
            connection.execute(
                chart_table.update()
                .where(chart_table.c.perm == old_dataset_vm_name)
                .values(perm=new_dataset_vm_name)
            )
            if new_dataset_vm_name:
                # After update refresh
                new_dataset_view_menu = self._find_view_menu_on_sqla_event(
                    connection,
                    new_dataset_vm_name,
                )
                self.on_view_menu_after_update(
                    mapper,
                    connection,
                    new_dataset_view_menu,
                )
                updated_view_menus.append(new_dataset_view_menu)
        return updated_view_menus

    def dataset_after_insert(
        self,
        mapper: Mapper,
        connection: Connection,
        target: "SqlaTable",
    ) -> None:
        """
        Handles permission creation when a dataset is inserted.
        Triggered by a SQLAlchemy after_insert event.

        We need to create:
         - The dataset PVM and set local and schema perm

        :param mapper: The SQLA mapper
        :param connection: The SQLA connection
        :param target: The changed dataset object
        :return:
        """
        from superset.models.core import (  # pylint: disable=import-outside-toplevel
            Database,
        )

        try:
            dataset_perm: Optional[str] = target.get_perm()
            database = target.database
        except DatasetInvalidPermissionEvaluationException:
            logger.warning(
                "Dataset has no database will retry with database_id to set permission"
            )
            database = self.get_session.query(Database).get(target.database_id)
            dataset_perm = self.get_dataset_perm(
                target.id, target.table_name, database.database_name
            )
        dataset_table = target.__table__

        self._insert_pvm_on_sqla_event(
            mapper, connection, "datasource_access", dataset_perm
        )
        if target.perm != dataset_perm:
            target.perm = dataset_perm
            connection.execute(
                dataset_table.update()
                .where(dataset_table.c.id == target.id)
                .values(perm=dataset_perm)
            )

        if target.schema:
            dataset_schema_perm = self.get_schema_perm(
                database.database_name, target.schema
            )
            self._insert_pvm_on_sqla_event(
                mapper, connection, "schema_access", dataset_schema_perm
            )
            target.schema_perm = dataset_schema_perm
            connection.execute(
                dataset_table.update()
                .where(dataset_table.c.id == target.id)
                .values(schema_perm=dataset_schema_perm)
            )

    def dataset_after_delete(
        self,
        mapper: Mapper,
        connection: Connection,
        target: "SqlaTable",
    ) -> None:
        """
        Handles permissions update when a dataset is deleted.
        Triggered by a SQLAlchemy after_delete event.

        We need to delete:
         - The dataset PVM

        :param mapper: The SQLA mapper
        :param connection: The SQLA connection
        :param target: The changed dataset object
        :return:
        """
        dataset_vm_name = self.get_dataset_perm(
            target.id, target.table_name, target.database.database_name
        )
        self._delete_pvm_on_sqla_event(
            mapper, connection, "datasource_access", dataset_vm_name
        )

    def dataset_before_update(
        self,
        mapper: Mapper,
        connection: Connection,
        target: "SqlaTable",
    ) -> None:
        """
        Handles all permissions update when a dataset is changed.
        Triggered by a SQLAlchemy after_update event.

        We need to update:
         - The dataset PVM and local perm
         - All charts local perm related with said datasets
         - All charts local schema perm related with said datasets

        :param mapper: The SQLA mapper
        :param connection: The SQLA connection
        :param target: The changed dataset object
        :return:
        """
        # pylint: disable=import-outside-toplevel
        from superset.connectors.sqla.models import SqlaTable

        # Check if watched fields have changed
        table = SqlaTable.__table__  # pylint: disable=no-member
        current_dataset = connection.execute(
            table.select().where(table.c.id == target.id)
        ).one()
        current_db_id = current_dataset.database_id
        current_schema = current_dataset.schema
        current_table_name = current_dataset.table_name

        # When database name changes
        if current_db_id != target.database_id:
            new_dataset_vm_name = self.get_dataset_perm(
                target.id, target.table_name, target.database.database_name
            )
            self._update_dataset_perm(
                mapper, connection, target.perm, new_dataset_vm_name, target
            )

            # Updates schema permissions
            new_dataset_schema_name = self.get_schema_perm(
                target.database.database_name, target.schema
            )
            self._update_dataset_schema_perm(
                mapper,
                connection,
                new_dataset_schema_name,
                target,
            )

        # When table name changes
        if current_table_name != target.table_name:
            new_dataset_vm_name = self.get_dataset_perm(
                target.id, target.table_name, target.database.database_name
            )
            old_dataset_vm_name = self.get_dataset_perm(
                target.id, current_table_name, target.database.database_name
            )
            self._update_dataset_perm(
                mapper, connection, old_dataset_vm_name, new_dataset_vm_name, target
            )

        # When schema changes
        if current_schema != target.schema:
            new_dataset_schema_name = self.get_schema_perm(
                target.database.database_name, target.schema
            )
            self._update_dataset_schema_perm(
                mapper,
                connection,
                new_dataset_schema_name,
                target,
            )

    def _update_dataset_schema_perm(
        self,
        mapper: Mapper,
        connection: Connection,
        new_schema_permission_name: Optional[str],
        target: "SqlaTable",
    ) -> None:
        """
        Helper method that is called by SQLAlchemy events on datasets to update
        a new schema permission name, propagates the name change to datasets and charts.

        If the schema permission name does not exist already has a PVM,
        creates a new one.

        :param mapper: The SQLA event mapper
        :param connection: The SQLA connection
        :param new_schema_permission_name: The new schema permission name that changed
        :param target: Dataset that was updated
        :return:
        """
        logger.info("Updating schema perm, new: %s", new_schema_permission_name)
        from superset.connectors.sqla.models import (  # pylint: disable=import-outside-toplevel
            SqlaTable,
        )
        from superset.models.slice import (  # pylint: disable=import-outside-toplevel
            Slice,
        )

        sqlatable_table = SqlaTable.__table__  # pylint: disable=no-member
        chart_table = Slice.__table__  # pylint: disable=no-member

        # insert new schema PVM if it does not exist
        self._insert_pvm_on_sqla_event(
            mapper, connection, "schema_access", new_schema_permission_name
        )

        # Update dataset (SqlaTable schema_perm field)
        connection.execute(
            sqlatable_table.update()
            .where(
                sqlatable_table.c.id == target.id,
            )
            .values(schema_perm=new_schema_permission_name)
        )

        # Update charts (Slice schema_perm field)
        connection.execute(
            chart_table.update()
            .where(
                chart_table.c.datasource_id == target.id,
                chart_table.c.datasource_type == DatasourceType.TABLE,
            )
            .values(schema_perm=new_schema_permission_name)
        )

    def _update_dataset_perm(  # pylint: disable=too-many-arguments
        self,
        mapper: Mapper,
        connection: Connection,
        old_permission_name: Optional[str],
        new_permission_name: Optional[str],
        target: "SqlaTable",
    ) -> None:
        """
        Helper method that is called by SQLAlchemy events on datasets to update
        a permission name change, propagates the name change to VM, datasets and charts.

        :param mapper:
        :param connection:
        :param old_permission_name
        :param new_permission_name:
        :param target:
        :return:
        """
        logger.info(
            "Updating dataset perm, old: %s, new: %s",
            old_permission_name,
            new_permission_name,
        )
        from superset.connectors.sqla.models import (  # pylint: disable=import-outside-toplevel
            SqlaTable,
        )
        from superset.models.slice import (  # pylint: disable=import-outside-toplevel
            Slice,
        )

        view_menu_table = self.viewmenu_model.__table__  # pylint: disable=no-member
        sqlatable_table = SqlaTable.__table__  # pylint: disable=no-member
        chart_table = Slice.__table__  # pylint: disable=no-member

        new_dataset_view_menu = self.find_view_menu(new_permission_name)
        if new_dataset_view_menu:
            return
        old_dataset_view_menu = self.find_view_menu(old_permission_name)
        if not old_dataset_view_menu:
            logger.warning(
                "Could not find previous dataset permission %s", old_permission_name
            )
            self._insert_pvm_on_sqla_event(
                mapper, connection, "datasource_access", new_permission_name
            )
            return
        # Update VM
        connection.execute(
            view_menu_table.update()
            .where(view_menu_table.c.name == old_permission_name)
            .values(name=new_permission_name)
        )
        # VM changed, so call hook
        new_dataset_view_menu = self.find_view_menu(new_permission_name)
        self.on_view_menu_after_update(mapper, connection, new_dataset_view_menu)
        # Update dataset (SqlaTable perm field)
        connection.execute(
            sqlatable_table.update()
            .where(
                sqlatable_table.c.id == target.id,
            )
            .values(perm=new_permission_name)
        )
        # Update charts (Slice perm field)
        connection.execute(
            chart_table.update()
            .where(
                chart_table.c.datasource_type == DatasourceType.TABLE,
                chart_table.c.datasource_id == target.id,
            )
            .values(perm=new_permission_name)
        )

    def _delete_pvm_on_sqla_event(  # pylint: disable=too-many-arguments
        self,
        mapper: Mapper,
        connection: Connection,
        permission_name: Optional[str] = None,
        view_menu_name: Optional[str] = None,
        pvm: Optional[PermissionView] = None,
    ) -> None:
        """
        Helper method that is called by SQLAlchemy events.
        Deletes a PVM.

        :param mapper: The SQLA event mapper
        :param connection: The SQLA connection
        :param permission_name: e.g.: datasource_access, schema_access
        :param view_menu_name: e.g. [db1].[public]
        :param pvm: Can be called with the actual PVM already
        :return:
        """
        view_menu_table = self.viewmenu_model.__table__  # pylint: disable=no-member
        permission_view_menu_table = (
            self.permissionview_model.__table__  # pylint: disable=no-member
        )

        if not pvm:
            pvm = self.find_permission_view_menu(permission_name, view_menu_name)
        if not pvm:
            return
        # Delete Any Role to PVM association
        connection.execute(
            assoc_permissionview_role.delete().where(
                assoc_permissionview_role.c.permission_view_id == pvm.id
            )
        )
        # Delete the database access PVM
        connection.execute(
            permission_view_menu_table.delete().where(
                permission_view_menu_table.c.id == pvm.id
            )
        )
        self.on_permission_view_after_delete(mapper, connection, pvm)
        connection.execute(
            view_menu_table.delete().where(view_menu_table.c.id == pvm.view_menu_id)
        )

    def _find_permission_on_sqla_event(
        self, connection: Connection, name: str
    ) -> Permission:
        """
        Find a FAB Permission using a SQLA connection.

        A session.query may not return the latest results on newly created/updated
        objects/rows using connection. On this case we should use a connection also

        :param connection: SQLAlchemy connection
        :param name: The permission name (it's unique)
        :return: Permission
        """
        permission_table = self.permission_model.__table__  # pylint: disable=no-member

        permission_ = connection.execute(
            permission_table.select().where(permission_table.c.name == name)
        ).fetchone()
        permission = Permission()
        # ensures this object is never persisted
        permission.metadata = None
        permission.id = permission_.id
        permission.name = permission_.name
        return permission

    def _find_view_menu_on_sqla_event(
        self, connection: Connection, name: str
    ) -> ViewMenu:
        """
        Find a FAB ViewMenu using a SQLA connection.

        A session.query may not return the latest results on newly created/updated
        objects/rows using connection. On this case we should use a connection also

        :param connection: SQLAlchemy connection
        :param name: The ViewMenu name (it's unique)
        :return: ViewMenu
        """
        view_menu_table = self.viewmenu_model.__table__  # pylint: disable=no-member

        view_menu_ = connection.execute(
            view_menu_table.select().where(view_menu_table.c.name == name)
        ).fetchone()
        view_menu = ViewMenu()
        # ensures this object is never persisted
        view_menu.metadata = None
        view_menu.id = view_menu_.id
        view_menu.name = view_menu_.name
        return view_menu

    def _insert_pvm_on_sqla_event(
        self,
        mapper: Mapper,
        connection: Connection,
        permission_name: str,
        view_menu_name: Optional[str],
    ) -> None:
        """
        Helper method that is called by SQLAlchemy events.
        Inserts a new PVM (if it does not exist already)

        :param mapper: The SQLA event mapper
        :param connection: The SQLA connection
        :param permission_name: e.g.: datasource_access, schema_access
        :param view_menu_name: e.g. [db1].[public]
        :return:
        """
        permission_table = self.permission_model.__table__  # pylint: disable=no-member
        view_menu_table = self.viewmenu_model.__table__  # pylint: disable=no-member
        permission_view_table = (
            self.permissionview_model.__table__  # pylint: disable=no-member
        )
        if not view_menu_name:
            return
        pvm = self.find_permission_view_menu(permission_name, view_menu_name)
        if pvm:
            return
        permission = self.find_permission(permission_name)
        view_menu = self.find_view_menu(view_menu_name)
        if not permission:
            _ = connection.execute(
                permission_table.insert().values(name=permission_name)
            )
            permission = self._find_permission_on_sqla_event(
                connection, permission_name
            )
            self.on_permission_after_insert(mapper, connection, permission)
        if not view_menu:
            _ = connection.execute(view_menu_table.insert().values(name=view_menu_name))
            view_menu = self._find_view_menu_on_sqla_event(connection, view_menu_name)
            self.on_view_menu_after_insert(mapper, connection, view_menu)
        connection.execute(
            permission_view_table.insert().values(
                permission_id=permission.id, view_menu_id=view_menu.id
            )
        )
        permission_view = connection.execute(
            permission_view_table.select().where(
                permission_view_table.c.permission_id == permission.id,
                permission_view_table.c.view_menu_id == view_menu.id,
            )
        ).fetchone()
        permission_view_model = PermissionView()
        permission_view_model.metadata = None
        permission_view_model.id = permission_view.id
        permission_view_model.permission_id = permission.id
        permission_view_model.view_menu_id = view_menu.id
        permission_view_model.permission = permission
        permission_view_model.view_menu = view_menu
        self.on_permission_view_after_insert(mapper, connection, permission_view_model)

    def on_role_after_update(
        self, mapper: Mapper, connection: Connection, target: Role
    ) -> None:
        """
        Hook that allows for further custom operations when a Role update
        is created by SQLAlchemy events.

        On SQLAlchemy after_insert events, we cannot
        create new view_menu's using a session, so any SQLAlchemy events hooked to
        `ViewMenu` will not trigger an after_insert.

        :param mapper: The table mapper
        :param connection: The DB-API connection
        :param target: The mapped instance being changed
        """

    def on_view_menu_after_insert(
        self, mapper: Mapper, connection: Connection, target: ViewMenu
    ) -> None:
        """
        Hook that allows for further custom operations when a new ViewMenu
        is created by set_perm.

        On SQLAlchemy after_insert events, we cannot
        create new view_menu's using a session, so any SQLAlchemy events hooked to
        `ViewMenu` will not trigger an after_insert.

        :param mapper: The table mapper
        :param connection: The DB-API connection
        :param target: The mapped instance being persisted
        """

    def on_view_menu_after_update(
        self, mapper: Mapper, connection: Connection, target: ViewMenu
    ) -> None:
        """
        Hook that allows for further custom operations when a new ViewMenu
        is updated

        Since the update may be performed on after_update event. We cannot
        update ViewMenus using a session, so any SQLAlchemy events hooked to
        `ViewMenu` will not trigger an after_update.

        :param mapper: The table mapper
        :param connection: The DB-API connection
        :param target: The mapped instance being persisted
        """

    def on_permission_after_insert(
        self, mapper: Mapper, connection: Connection, target: Permission
    ) -> None:
        """
        Hook that allows for further custom operations when a new permission
        is created by set_perm.

        Since set_perm is executed by SQLAlchemy after_insert events, we cannot
        create new permissions using a session, so any SQLAlchemy events hooked to
        `Permission` will not trigger an after_insert.

        :param mapper: The table mapper
        :param connection: The DB-API connection
        :param target: The mapped instance being persisted
        """

    def on_permission_view_after_insert(
        self, mapper: Mapper, connection: Connection, target: PermissionView
    ) -> None:
        """
        Hook that allows for further custom operations when a new PermissionView
        is created by SQLAlchemy events.

        On SQLAlchemy after_insert events, we cannot
        create new pvms using a session, so any SQLAlchemy events hooked to
        `PermissionView` will not trigger an after_insert.

        :param mapper: The table mapper
        :param connection: The DB-API connection
        :param target: The mapped instance being persisted
        """

    def on_permission_view_after_delete(
        self, mapper: Mapper, connection: Connection, target: PermissionView
    ) -> None:
        """
        Hook that allows for further custom operations when a new PermissionView
        is delete by SQLAlchemy events.

        On SQLAlchemy after_delete events, we cannot
        delete pvms using a session, so any SQLAlchemy events hooked to
        `PermissionView` will not trigger an after_delete.

        :param mapper: The table mapper
        :param connection: The DB-API connection
        :param target: The mapped instance being persisted
        """

    @staticmethod
    def get_exclude_users_from_lists() -> list[str]:
        """
        Override to dynamically identify a list of usernames to exclude from
        all UI dropdown lists, owners, created_by filters etc...

        It will exclude all users from the all endpoints of the form
        ``/api/v1/<modelview>/related/<column>``

        Optionally you can also exclude them using the `EXCLUDE_USERS_FROM_LISTS`
        config setting.

        :return: A list of usernames
        """
        return []

    def raise_for_access(
        # pylint: disable=too-many-arguments,too-many-branches,too-many-locals,too-many-statements
        self,
        dashboard: Optional["Dashboard"] = None,
        chart: Optional["Slice"] = None,
        database: Optional["Database"] = None,
        datasource: Optional["BaseDatasource"] = None,
        query: Optional["Query"] = None,
        query_context: Optional["QueryContext"] = None,
        table: Optional["Table"] = None,
        viz: Optional["BaseViz"] = None,
        sql: Optional[str] = None,
        schema: Optional[str] = None,
    ) -> None:
        """
        Raise an exception if the user cannot access the resource.

        :param database: The Superset database
        :param datasource: The Superset datasource
        :param query: The SQL Lab query
        :param query_context: The query context
        :param table: The Superset table (requires database)
        :param viz: The visualization
        :param sql: The SQL string (requires database)
        :param schema: Optional schema name
        :raises SupersetSecurityException: If the user cannot access the resource
        """

        # pylint: disable=import-outside-toplevel
        from superset import is_feature_enabled
        from superset.connectors.sqla.models import SqlaTable
        from superset.models.dashboard import Dashboard
        from superset.models.slice import Slice
        from superset.models.sql_lab import Query
        from superset.sql_parse import Table
        from superset.utils.core import shortid

        if sql and database:
            query = Query(
                database=database,
                sql=sql,
                schema=schema,
                client_id=shortid()[:10],
                user_id=get_user_id(),
            )
            self.get_session.expunge(query)

        if database and table or query:
            if query:
                database = query.database

            database = cast("Database", database)

            if self.can_access_database(database):
                return

            if query:
                default_schema = database.get_default_schema_for_query(query)
                tables = {
                    Table(table_.table, table_.schema or default_schema)
                    for table_ in extract_tables_from_jinja_sql(query.sql, database)
                }
            elif table:
                tables = {table}

            denied = set()

            for table_ in tables:
                schema_perm = self.get_schema_perm(database, schema=table_.schema)

                if not (schema_perm and self.can_access("schema_access", schema_perm)):
                    datasources = SqlaTable.query_datasources_by_name(
                        database, table_.table, schema=table_.schema
                    )

                    # Access to any datasource is suffice.
                    for datasource_ in datasources:
                        if self.can_access(
                            "datasource_access", datasource_.perm
                        ) or self.is_owner(datasource_):
                            break
                    else:
                        denied.add(table_)

            if denied:
                raise SupersetSecurityException(
                    self.get_table_access_error_object(denied)
                )

        # Guest users MUST not modify the payload so it's requesting a
        # different chart or different ad-hoc metrics from what's saved.
        if (
            query_context
            and self.is_guest_user()
            and query_context_modified(query_context)
        ):
            raise SupersetSecurityException(
                SupersetError(
                    error_type=SupersetErrorType.DASHBOARD_SECURITY_ACCESS_ERROR,
                    message=_("Guest user cannot modify chart payload"),
                    level=ErrorLevel.ERROR,
                )
            )

        if datasource or query_context or viz:
            form_data = None

            if query_context:
                datasource = query_context.datasource
                form_data = query_context.form_data
            elif viz:
                datasource = viz.datasource
                form_data = viz.form_data

            assert datasource

            if not (
                self.can_access_schema(datasource)
                or self.can_access("datasource_access", datasource.perm or "")
                or self.is_owner(datasource)
                or (
                    # Grant access to the datasource only if dashboard RBAC is enabled
                    # or the user is an embedded guest user with access to the dashboard
                    # and said datasource is associated with the dashboard chart in
                    # question.
                    form_data
                    and (dashboard_id := form_data.get("dashboardId"))
                    and (
                        dashboard_ := self.get_session.query(Dashboard)
                        .filter(Dashboard.id == dashboard_id)
                        .one_or_none()
                    )
                    and (
                        (is_feature_enabled("DASHBOARD_RBAC") and dashboard_.roles)
                        or (
                            is_feature_enabled("EMBEDDED_SUPERSET")
                            and self.is_guest_user()
                        )
                    )
                    and (
                        (
                            # Native filter.
                            form_data.get("type") == "NATIVE_FILTER"
                            and (native_filter_id := form_data.get("native_filter_id"))
                            and dashboard_.json_metadata
                            and (json_metadata := json.loads(dashboard_.json_metadata))
                            and any(
                                target.get("datasetId") == datasource.id
                                for fltr in json_metadata.get(
                                    "native_filter_configuration",
                                    [],
                                )
                                for target in fltr.get("targets", [])
                                if native_filter_id == fltr.get("id")
                            )
                        )
                        or (
                            # Chart.
                            form_data.get("type") != "NATIVE_FILTER"
                            and (slice_id := form_data.get("slice_id"))
                            and (
                                slc := self.get_session.query(Slice)
                                .filter(Slice.id == slice_id)
                                .one_or_none()
                            )
                            and slc in dashboard_.slices
                            and slc.datasource == datasource
                        )
                    )
                    and self.can_access_dashboard(dashboard_)
                )
            ):
                raise SupersetSecurityException(
                    self.get_datasource_access_error_object(datasource)
                )

        if dashboard:
            if self.is_guest_user():
                # Guest user is currently used for embedded dashboards only. If the guest
                # user doesn't have access to the dashboard, ignore all other checks.
                if self.has_guest_access(dashboard):
                    return
                raise SupersetSecurityException(
                    self.get_dashboard_access_error_object(dashboard)
                )

            if self.is_admin() or self.is_owner(dashboard):
                return

            # TODO: Once a better sharing flow is in place, we should move the
            # dashboard.published check here so that it's applied to both
            # regular RBAC and DASHBOARD_RBAC

            # DASHBOARD_RBAC logic - Manage dashboard access through roles.
            # Only applicable in case the dashboard has roles set.
            if is_feature_enabled("DASHBOARD_RBAC") and dashboard.roles:
                if dashboard.published and {role.id for role in dashboard.roles} & {
                    role.id for role in self.get_user_roles()
                }:
                    return

            # REGULAR RBAC logic
            # User can only acess the dashboard in case:
            #    It doesn't have any datasets; OR
            #    They have access to at least one dataset used.
            # We currently don't check if the dashboard is published,
            # to allow creators to share a WIP dashboard with a viewer
            # to collect feedback.
            elif not dashboard.datasources or any(
                self.can_access_datasource(datasource)
                for datasource in dashboard.datasources
            ):
                return

            raise SupersetSecurityException(
                self.get_dashboard_access_error_object(dashboard)
            )

        if chart:
            if self.is_admin() or self.is_owner(chart):
                return

            if chart.datasource and self.can_access_datasource(chart.datasource):
                return

            raise SupersetSecurityException(self.get_chart_access_error_object(chart))

    def get_user_by_username(self, username: str) -> Optional[User]:
        """
        Retrieves a user by it's username case sensitive. Optional session parameter
        utility method normally useful for celery tasks where the session
        need to be scoped
        """
        return (
            self.get_session.query(self.user_model)
            .filter(self.user_model.username == username)
            .one_or_none()
        )

    def get_anonymous_user(self) -> User:
        return AnonymousUserMixin()

    def get_user_roles(self, user: Optional[User] = None) -> list[Role]:
        if not user:
            user = g.user
        if user.is_anonymous:
            public_role = current_app.config.get("AUTH_ROLE_PUBLIC")
            return [self.get_public_role()] if public_role else []
        return user.roles

    def get_guest_rls_filters(
        self, dataset: "BaseDatasource"
    ) -> list[GuestTokenRlsRule]:
        """
        Retrieves the row level security filters for the current user and the dataset,
        if the user is authenticated with a guest token.
        :param dataset: The dataset to check against
        :return: A list of filters
        """
        if guest_user := self.get_current_guest_user_if_guest():
            return [
                rule
                for rule in guest_user.rls
                if not rule.get("dataset")
                or str(rule.get("dataset")) == str(dataset.id)
            ]
        return []

    def get_rls_filters(self, table: "BaseDatasource") -> list[SqlaQuery]:
        """
        Retrieves the appropriate row level security filters for the current user and
        the passed table.

        :param table: The table to check against
        :returns: A list of filters
        """

        if not (hasattr(g, "user") and g.user is not None):
            return []

        # pylint: disable=import-outside-toplevel
        from superset.connectors.sqla.models import (
            RLSFilterRoles,
            RLSFilterTables,
            RowLevelSecurityFilter,
        )

        user_roles = [role.id for role in self.get_user_roles(g.user)]
        regular_filter_roles = (
            self.get_session()
            .query(RLSFilterRoles.c.rls_filter_id)
            .join(RowLevelSecurityFilter)
            .filter(
                RowLevelSecurityFilter.filter_type == RowLevelSecurityFilterType.REGULAR
            )
            .filter(RLSFilterRoles.c.role_id.in_(user_roles))
        )
        base_filter_roles = (
            self.get_session()
            .query(RLSFilterRoles.c.rls_filter_id)
            .join(RowLevelSecurityFilter)
            .filter(
                RowLevelSecurityFilter.filter_type == RowLevelSecurityFilterType.BASE
            )
            .filter(RLSFilterRoles.c.role_id.in_(user_roles))
        )
        filter_tables = (
            self.get_session()
            .query(RLSFilterTables.c.rls_filter_id)
            .filter(RLSFilterTables.c.table_id == table.id)
        )
        query = (
            self.get_session()
            .query(
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

    def get_rls_sorted(self, table: "BaseDatasource") -> list["RowLevelSecurityFilter"]:
        """
        Retrieves a list RLS filters sorted by ID for
        the current user and the passed table.

        :param table: The table to check against
        :returns: A list RLS filters
        """
        filters = self.get_rls_filters(table)
        filters.sort(key=lambda f: f.id)
        return filters

    def get_guest_rls_filters_str(self, table: "BaseDatasource") -> list[str]:
        return [f.get("clause", "") for f in self.get_guest_rls_filters(table)]

    def get_rls_cache_key(self, datasource: "BaseDatasource") -> list[str]:
        rls_clauses_with_group_key = []
        if datasource.is_rls_supported:
            rls_clauses_with_group_key = [
                f"{f.clause}-{f.group_key or ''}"
                for f in self.get_rls_sorted(datasource)
            ]
        guest_rls = self.get_guest_rls_filters_str(datasource)
        return guest_rls + rls_clauses_with_group_key

    @staticmethod
    def _get_current_epoch_time() -> float:
        """This is used so the tests can mock time"""
        return time.time()

    @staticmethod
    def _get_guest_token_jwt_audience() -> str:
        audience = current_app.config["GUEST_TOKEN_JWT_AUDIENCE"] or get_url_host()
        if callable(audience):
            audience = audience()
        return audience

    @staticmethod
    def validate_guest_token_resources(resources: GuestTokenResources) -> None:
        # pylint: disable=import-outside-toplevel
        from superset.commands.dashboard.embedded.exceptions import (
            EmbeddedDashboardNotFoundError,
        )
        from superset.daos.dashboard import EmbeddedDashboardDAO
        from superset.models.dashboard import Dashboard

        for resource in resources:
            if resource["type"] == GuestTokenResourceType.DASHBOARD.value:
                # TODO (embedded): remove this check once uuids are rolled out
                dashboard = Dashboard.get(str(resource["id"]))
                if not dashboard:
                    embedded = EmbeddedDashboardDAO.find_by_id(str(resource["id"]))
                    if not embedded:
                        raise EmbeddedDashboardNotFoundError()

    def create_guest_access_token(
        self,
        user: GuestTokenUser,
        resources: GuestTokenResources,
        rls: list[GuestTokenRlsRule],
    ) -> bytes:
        secret = current_app.config["GUEST_TOKEN_JWT_SECRET"]
        algo = current_app.config["GUEST_TOKEN_JWT_ALGO"]
        exp_seconds = current_app.config["GUEST_TOKEN_JWT_EXP_SECONDS"]
        audience = self._get_guest_token_jwt_audience()
        # calculate expiration time
        now = self._get_current_epoch_time()
        exp = now + exp_seconds
        claims = {
            "user": user,
            "resources": resources,
            "rls_rules": rls,
            # standard jwt claims:
            "iat": now,  # issued at
            "exp": exp,  # expiration time
            "aud": audience,
            "type": "guest",
        }
        return self.pyjwt_for_guest_token.encode(claims, secret, algorithm=algo)

    def get_guest_user_from_request(self, req: Request) -> Optional[GuestUser]:
        """
        If there is a guest token in the request (used for embedded),
        parses the token and returns the guest user.
        This is meant to be used as a request loader for the LoginManager.
        The LoginManager will only call this if an active session cannot be found.

        :return: A guest user object
        """
        raw_token = req.headers.get(
            current_app.config["GUEST_TOKEN_HEADER_NAME"]
        ) or req.form.get("guest_token")
        if raw_token is None:
            return None

        try:
            token = self.parse_jwt_guest_token(raw_token)
            if token.get("user") is None:
                raise ValueError("Guest token does not contain a user claim")
            if token.get("resources") is None:
                raise ValueError("Guest token does not contain a resources claim")
            if token.get("rls_rules") is None:
                raise ValueError("Guest token does not contain an rls_rules claim")
            if token.get("type") != "guest":
                raise ValueError("This is not a guest token.")
        except Exception:  # pylint: disable=broad-except
            # The login manager will handle sending 401s.
            # We don't need to send a special error message.
            logger.warning("Invalid guest token", exc_info=True)
            return None

        return self.get_guest_user_from_token(cast(GuestToken, token))

    def get_guest_user_from_token(self, token: GuestToken) -> GuestUser:
        return self.guest_user_cls(
            token=token,
            roles=[self.find_role(current_app.config["GUEST_ROLE_NAME"])],
        )

    def parse_jwt_guest_token(self, raw_token: str) -> dict[str, Any]:
        """
        Parses a guest token. Raises an error if the jwt fails standard claims checks.
        :param raw_token: the token gotten from the request
        :return: the same token that was passed in, tested but unchanged
        """
        secret = current_app.config["GUEST_TOKEN_JWT_SECRET"]
        algo = current_app.config["GUEST_TOKEN_JWT_ALGO"]
        audience = self._get_guest_token_jwt_audience()
        return self.pyjwt_for_guest_token.decode(
            raw_token, secret, algorithms=[algo], audience=audience
        )

    @staticmethod
    def is_guest_user(user: Optional[Any] = None) -> bool:
        # pylint: disable=import-outside-toplevel
        from superset import is_feature_enabled

        if not is_feature_enabled("EMBEDDED_SUPERSET"):
            return False
        if not user:
            user = g.user
        return hasattr(user, "is_guest_user") and user.is_guest_user

    def get_current_guest_user_if_guest(self) -> Optional[GuestUser]:
        return g.user if self.is_guest_user() else None

    def has_guest_access(self, dashboard: "Dashboard") -> bool:
        user = self.get_current_guest_user_if_guest()
        if not user:
            return False

        dashboards = [
            r
            for r in user.resources
            if r["type"] == GuestTokenResourceType.DASHBOARD.value
        ]

        # TODO (embedded): remove this check once uuids are rolled out
        for resource in dashboards:
            if str(resource["id"]) == str(dashboard.id):
                return True

        if not dashboard.embedded:
            return False

        for resource in dashboards:
            if str(resource["id"]) == str(dashboard.embedded[0].uuid):
                return True
        return False

    def raise_for_ownership(self, resource: Model) -> None:
        """
        Raise an exception if the user does not own the resource.

        Note admins are deemed owners of all resources.

        :param resource: The dashboard, dataset, chart, etc. resource
        :raises SupersetSecurityException: If the current user is not an owner
        """

        # pylint: disable=import-outside-toplevel
        from superset import db

        if self.is_admin():
            return

        orig_resource = db.session.query(resource.__class__).get(resource.id)
        owners = orig_resource.owners if hasattr(orig_resource, "owners") else []

        if g.user.is_anonymous or g.user not in owners:
            raise SupersetSecurityException(
                SupersetError(
                    error_type=SupersetErrorType.MISSING_OWNERSHIP_ERROR,
                    message=_(
                        "You don't have the rights to alter %(resource)s",
                        resource=resource,
                    ),
                    level=ErrorLevel.ERROR,
                )
            )

    def is_owner(self, resource: Model) -> bool:
        """
        Returns True if the current user is an owner of the resource, False otherwise.

        :param resource: The dashboard, dataset, chart, etc. resource
        :returns: Whether the current user is an owner of the resource
        """

        try:
            self.raise_for_ownership(resource)
        except SupersetSecurityException:
            return False

        return True

    def is_admin(self) -> bool:
        """
        Returns True if the current user is an admin user, False otherwise.

        :returns: Whether the current user is an admin user
        """

        return current_app.config["AUTH_ROLE_ADMIN"] in [
            role.name for role in self.get_user_roles()
        ]
