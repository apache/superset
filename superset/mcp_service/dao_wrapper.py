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
Generic DAO Wrapper for MCP Service

This module provides a generic wrapper around Superset DAOs that provides
consistent access patterns for the MCP service, including proper user context
and security management.

Example usage:
    from superset.daos.dashboard import DashboardDAO
    from superset.daos.chart import ChartDAO
    from superset.daos.dataset import DatasetDAO
    from superset.mcp_service.dao_wrapper import MCPDAOWrapper

    # Create wrappers for different models
    dashboard_wrapper = MCPDAOWrapper(DashboardDAO, "dashboard")
    chart_wrapper = MCPDAOWrapper(ChartDAO, "chart")
    dataset_wrapper = MCPDAOWrapper(DatasetDAO, "dataset")

    # Get info about a specific item
    dashboard, error_type, error_message = dashboard_wrapper.info(1)
    chart, error_type, error_message = chart_wrapper.info(1)
    dataset, error_type, error_message = dataset_wrapper.info(1)

    # List items with filters
    dashboards, total_count = dashboard_wrapper.list(
        filters={"published": True},
        page=0,
        page_size=10
    )
    charts, total_count = chart_wrapper.list(
        filters={"slice_name": "Sales Chart"},
        order_column="changed_on",
        order_direction="desc"
    )
"""

import logging
from typing import Any, Dict, List, Optional, Tuple, Type, TypeVar

from flask import current_app, g
from flask_appbuilder.models.sqla import Model
from flask_login import AnonymousUserMixin

from superset.daos.base import BaseDAO, ColumnOperator
from superset.extensions import security_manager

logger = logging.getLogger(__name__)

T = TypeVar("T", bound=Model)


class MCPDAOWrapper:
    """
    Generic wrapper for Superset DAOs that provides consistent access patterns
    for the MCP service with proper user context and security management.
    """
    
    def __init__(self, dao_class: Type[BaseDAO[T]], model_name: str):
        """
        Initialize the DAO wrapper
        
        Args:
            dao_class: The DAO class to wrap (e.g., DashboardDAO, ChartDAO)
            model_name: Human-readable name for the model (e.g., "dashboard", "chart")
        """
        self.dao_class = dao_class
        self.model_name = model_name
        self.logger = logging.getLogger(f"{__name__}.{model_name}")
    
    def info(self, item_id: int) -> Tuple[Optional[T], Optional[str], Optional[str]]:
        """
        Get detailed information about a specific item
        
        Args:
            item_id: ID of the item to retrieve
        
        Returns:
            Tuple of (item, error_type, error_message)
            - item: The found item or None if not found/access denied
            - error_type: Type of error if any ("not_found", "access_denied", etc.)
            - error_message: Human-readable error message
        """
        self.logger.info(f"Getting {self.model_name} info for ID: {item_id}")
        
        try:
            # User context now handled by mcp_auth_hook
            
            # Use DAO to find the item
            item = self.dao_class.find_by_id(item_id)
            
            if not item:
                self.logger.warning(f"{self.model_name.capitalize()} with ID {item_id} not found")
                return None, "not_found", f"{self.model_name.capitalize()} with ID {item_id} not found"
            return item, None, None
                
        except Exception as e:
            error_msg = f"Unexpected error getting {self.model_name} info: {str(e)}"
            self.logger.error(error_msg, exc_info=True)
            return None, "unexpected_error", error_msg
    
    def list(
        self,
        column_operators: Optional[List[ColumnOperator]] = None,
        order_column: str = "changed_on",
        order_direction: str = "desc",
        page: int = 0,
        page_size: int = 100,
        search: Optional[str] = None,
        search_columns: Optional[list] = None,
        custom_filters: Optional[dict] = None,
        columns: Optional[list] = None,
    ) -> Tuple[list, int]:
        """
        Generic list method for filtered, sorted, and paginated results.
        """
        self.logger.info(f"Listing {self.model_name}s with column_operators: {column_operators}")
        try:
            items, total_count = self.dao_class.list(
                column_operators=column_operators,
                order_column=order_column,
                order_direction=order_direction,
                page=page,
                page_size=page_size,
                search=search,
                search_columns=search_columns,
                custom_filters=custom_filters,
                columns=columns,
            )
            self.logger.info(f"Retrieved {len(items)} {self.model_name}s (total: {total_count})")
            return items, total_count
        except Exception as e:
            error_msg = f"Unexpected error listing {self.model_name}s: {str(e)}"
            self.logger.error(error_msg, exc_info=True)
            return [], 0

    def count(
        self,
        column_operators: Optional[List[ColumnOperator]] = None,
        skip_base_filter: bool = False,
    ) -> int:
        """
        Count the number of records for the model, optionally filtered by column operators.
        """
        if column_operators is None:
            column_operators = []
        try:
            return self.dao_class.count(column_operators, skip_base_filter=skip_base_filter)
        except Exception as e:
            self.logger.error(f"Error counting records: {e}")
            return 0

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
            raise PermissionError(f"User {getattr(user, 'username', user)} not authorized for {tool_func.__name__}")
        log_access(user, tool_func.__name__, args, kwargs)
        return tool_func(*args, **kwargs)
    return wrapper 
