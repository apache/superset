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


import logging

from flask import current_app, g
from flask_login import AnonymousUserMixin
from superset.extensions import security_manager

logger = logging.getLogger(__name__)


def get_user_from_request():
    """
    Extract user info from the request context (e.g., from Bearer token, headers, etc.).
    By default, returns admin user. Override for OIDC/OAuth/Okta integration.
    """
    from flask import current_app
    from superset.extensions import security_manager
    admin_username = current_app.config.get("MCP_ADMIN_USERNAME", "admin")
    return security_manager.get_user_by_username(admin_username)


def impersonate_user(user, run_as=None):
    """
    Optionally impersonate another user if allowed. By default, returns the same user.
    Override to enforce impersonation rules.
    """
    return user


def has_permission(user, tool_func):
    """
    Check if the user has permission to run the tool. By default, always True.
    Override for RBAC.
    """
    return True


def log_access(user, tool_name, args, kwargs):
    """
    Log access/action for observability/audit. By default, does nothing.
    Override to log to your system.
    """
    pass


def mcp_auth_hook(tool_func):
    """
    Decorator for MCP tool functions to enforce auth, impersonation, RBAC, and logging.
    Also sets up Flask user context (g.user) for downstream DAO/model code.
    All logic is overridable for enterprise integration.
    """
    import functools
    @functools.wraps(tool_func)
    def wrapper(*args, **kwargs):
        # --- Setup user context (was _setup_user_context) ---
        admin_username = current_app.config.get("MCP_ADMIN_USERNAME", "admin")
        admin_user = security_manager.get_user_by_username(admin_username)
        if not admin_user:
            g.user = AnonymousUserMixin()
        else:
            g.user = admin_user
        # --- End user context setup ---

        user = get_user_from_request()
        run_as = kwargs.get("run_as")
        if run_as:
            user = impersonate_user(user, run_as)
        if not has_permission(user, tool_func):
            raise PermissionError(
                f"User {getattr(user, 'username', user)} not authorized for "
                f"{tool_func.__name__}")
        log_access(user, tool_func.__name__, args, kwargs)
        return tool_func(*args, **kwargs)

    return wrapper


class ModelListTool:
    """
    Generic tool for listing model objects with filtering, search, pagination, and column selection.

    """
    def __init__(
        self,
        dao_class,
        output_schema,
        item_serializer,
        filter_type,
        default_columns,
        search_columns,
        list_field_name,
        output_list_schema,
        logger=None,
    ):
        self.dao_class = dao_class
        self.output_schema = output_schema
        self.item_serializer = item_serializer
        self.filter_type = filter_type
        self.default_columns = default_columns
        self.search_columns = search_columns
        self.list_field_name = list_field_name
        self.output_list_schema = output_list_schema
        self.logger = logger or logging.getLogger(__name__)

    def run(
        self,
        filters=None,
        search=None,
        select_columns=None,
        order_column=None,
        order_direction="asc",
        page=0,
        page_size=100
    ):
        import json
        from datetime import datetime, timezone
        # If filters is a string (e.g., from a test), parse it as JSON
        if isinstance(filters, str):
            filters = json.loads(filters)
        # Ensure select_columns is a list
        if select_columns:
            if isinstance(select_columns, str):
                select_columns = [col.strip() for col in select_columns.split(",") if col.strip()]
            columns_to_load = select_columns
        else:
            columns_to_load = self.default_columns
        # Query the DAO
        items, total_count = self.dao_class.list(
            column_operators=filters,
            order_column=order_column or "changed_on",
            order_direction=order_direction or "desc",
            page=page,
            page_size=page_size,
            search=search,
            search_columns=self.search_columns,
            custom_filters=None,
            columns=columns_to_load,
        )
        # Serialize items
        item_objs = []
        for item in items:
            obj = self.item_serializer(item, columns_to_load)
            if obj is not None:
                item_objs.append(obj)
        total_pages = (total_count + page_size - 1) // page_size if page_size > 0 else 0
        from superset.mcp_service.pydantic_schemas import PaginationInfo
        pagination_info = PaginationInfo(
            page=page,
            page_size=page_size,
            total_count=total_count,
            total_pages=total_pages,
            has_next=page < total_pages - 1,
            has_previous=page > 0
        )
        # Build response
        def get_keys(obj):
            if hasattr(obj, 'model_dump'):
                return obj.model_dump().keys()
            elif isinstance(obj, dict):
                return obj.keys()
            return []
        response_kwargs = {
            self.list_field_name: item_objs,
            "count": len(item_objs),
            "total_count": total_count,
            "page": page,
            "page_size": page_size,
            "total_pages": total_pages,
            "has_previous": page > 0,
            "has_next": page < total_pages - 1,
            "columns_requested": select_columns if select_columns else self.default_columns,
            "columns_loaded": list(set([col for obj in item_objs for col in get_keys(obj)])),
            "filters_applied": filters if isinstance(filters, list) else [],
            "pagination": pagination_info,
            "timestamp": datetime.now(timezone.utc),
        }
        response = self.output_list_schema(**response_kwargs)
        self.logger.info(f"Successfully retrieved {len(item_objs)} {self.list_field_name}")
        return response


class ModelGetInfoTool:
    """
    Generic tool for retrieving a single model object by ID, with error handling and serialization.

    """
    def __init__(
        self,
        dao_class,
        output_schema,
        error_schema,
        serializer,
        logger=None,
    ):
        self.dao_class = dao_class
        self.output_schema = output_schema
        self.error_schema = error_schema
        self.serializer = serializer
        self.logger = logger or logging.getLogger(__name__)

    def run(self, id: int):
        from datetime import datetime, timezone
        try:
            obj = self.dao_class.find_by_id(id)
            if obj is None:
                error_data = self.error_schema(
                    error=f"{self.output_schema.__name__} with ID {id} not found",
                    error_type="not_found",
                    timestamp=datetime.now(timezone.utc)
                )
                self.logger.warning(f"{self.output_schema.__name__} {id} error: not_found - not found")
                return error_data
            response = self.serializer(obj)
            self.logger.info(f"{self.output_schema.__name__} response created successfully for id {id}")
            return response
        except Exception as context_error:
            error_msg = f"Error in ModelGetInfoTool: {str(context_error)}"
            self.logger.error(error_msg, exc_info=True)
            raise
