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

"""MCP Service API v1 endpoints"""
import logging
from datetime import datetime, timezone

from flask import current_app, g, jsonify, request
from marshmallow import ValidationError

from superset.mcp_service.api import mcp_api
from superset.mcp_service.schemas import (
    MCPDashboardListRequestSchema, MCPDashboardListResponseSchema, MCPDashboardResponseSchema,
    MCPDashboardSimpleRequestSchema, MCPErrorResponseSchema, MCPHealthResponseSchema, serialize_mcp_response,
    validate_mcp_request, )

logger = logging.getLogger(__name__)

__all__ = [
    "health",
    "list_dashboards",
    "get_dashboard"
]


def requires_api_key(f):
    """Decorator to check API key authentication"""
    from functools import wraps

    @wraps(f)
    def decorated(*args, **kwargs):
        logger.debug(f"Authenticating request for endpoint: {f.__name__}")

        # Get API key from config
        expected_api_key = current_app.config.get("MCP_API_KEY", "your-secret-api-key-here")

        # Check for API key in Authorization header
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            provided_api_key = auth_header[7:]  # Remove "Bearer " prefix
        else:
            # Fallback: check for X-API-Key header
            provided_api_key = request.headers.get("X-API-Key")

        if not provided_api_key:
            logger.warning(f"Missing API key for endpoint: {f.__name__}")
            error_data = {
                "error": "Missing Authorization header. Use 'Authorization: Bearer <api-key>' or 'X-API-Key: <api-key>'",
                "error_type": "authentication_required",
                "timestamp": datetime.now(timezone.utc)
            }
            serialized_error = serialize_mcp_response(error_data, MCPErrorResponseSchema)
            return jsonify(serialized_error), 401

        if provided_api_key != expected_api_key:
            logger.warning(f"Invalid API key for endpoint: {f.__name__}")
            error_data = {
                "error": "Invalid API key",
                "error_type": "authentication_failed",
                "timestamp": datetime.now(timezone.utc)
            }
            serialized_error = serialize_mcp_response(error_data, MCPErrorResponseSchema)
            return jsonify(serialized_error), 401

        logger.debug(f"Authentication successful for endpoint: {f.__name__}")
        return f(*args, **kwargs)

    return decorated


def serialize_user_object(user):
    """Serialize user object to dictionary"""
    if not user:
        return None

    return {
        "id": user.id,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "username": user.username,
        "email": getattr(user, 'email', None),
        "active": getattr(user, 'active', True),
    }


def serialize_tag_object(tag):
    """Serialize tag object to dictionary"""
    if not tag:
        return None

    return {
        "id": tag.id,
        "name": tag.name,
        "type": getattr(tag, 'type', None),
    }


def serialize_role_object(role):
    """Serialize role object to dictionary"""
    if not role:
        return None

    return {
        "id": role.id,
        "name": role.name,
    }


def serialize_chart_object(chart):
    """Serialize chart object to dictionary"""
    if not chart:
        return None

    return {
        "id": chart.id,
        "slice_name": chart.slice_name,
        "viz_type": chart.viz_type,
        "datasource_name": chart.datasource_name,
        "datasource_type": chart.datasource_type,
        "url": chart.url,
    }


@mcp_api.route("/health", methods=["GET"])
@requires_api_key
def health():
    """Health check endpoint"""
    logger.info("Health check requested")
    try:
        response_data = {
            "status": "healthy",
            "service": "mcp",
            "version": "1.0.0",
            "timestamp": datetime.now(timezone.utc)
        }
        serialized_response = serialize_mcp_response(response_data, MCPHealthResponseSchema)
        logger.info("Health check completed successfully")
        return jsonify(serialized_response)
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        response_data = {
            "status": "unhealthy",
            "error": str(e),
            "service": "mcp",
            "timestamp": datetime.now(timezone.utc)
        }
        serialized_response = serialize_mcp_response(response_data, MCPHealthResponseSchema)
        return jsonify(serialized_response), 503


@mcp_api.route("/list_dashboards", methods=["GET", "POST"])
@requires_api_key
def list_dashboards():
    """List available dashboards with advanced filtering support using existing Superset filters"""
    logger.info(f"list_dashboards called with method: {request.method}")
    try:
        from superset.daos.dashboard import DashboardDAO
        from superset.extensions import security_manager
        from superset.dashboards.filters import (
            DashboardTitleOrSlugFilter,
            DashboardCreatedByMeFilter,
            DashboardHasCreatedByFilter,
            DashboardTagIdFilter,
            DashboardTagNameFilter,
            DashboardFavoriteFilter,
            DashboardCertifiedFilter,
        )

        # Set up a user context for the MCP service
        admin_username = current_app.config.get("MCP_ADMIN_USERNAME", "admin")
        admin_user = security_manager.get_user_by_username(admin_username)

        if not admin_user:
            from flask_login import AnonymousUserMixin
            g.user = AnonymousUserMixin()
            logger.debug("Using anonymous user context")
        else:
            g.user = admin_user
            logger.debug(f"Using admin user context: {admin_user.username}")

        # Define search filters mapping (same as dashboard API)
        search_filters = {
            "dashboard_title": [DashboardTitleOrSlugFilter],
            "id": [DashboardFavoriteFilter, DashboardCertifiedFilter],
            "created_by": [DashboardCreatedByMeFilter, DashboardHasCreatedByFilter],
            "tags": [DashboardTagIdFilter, DashboardTagNameFilter],
        }

        # Input validation
        if request.method == "GET":
            logger.debug("Processing GET request with query parameters")
            try:
                validated = validate_mcp_request(request.args.to_dict(), MCPDashboardSimpleRequestSchema)
                logger.debug(f"GET request validation successful: {validated}")
            except ValidationError as err:
                logger.warning(f"GET request validation failed: {err.messages}")
                error_data = {
                    "error": "Validation error",
                    "error_type": "validation_error",
                    "details": err.messages,
                    "timestamp": datetime.now(timezone.utc)
                }
                serialized_error = serialize_mcp_response(error_data, MCPErrorResponseSchema)
                return jsonify(serialized_error), 400
            query_params = validated
            select_columns = query_params.get("select_columns", [])
        else:
            logger.debug("Processing POST request with JSON body")
            try:
                request_data = request.get_json() or {}
                validated = validate_mcp_request(request_data, MCPDashboardListRequestSchema)
                logger.debug(f"POST request validation successful: {validated}")
            except ValidationError as err:
                logger.warning(f"POST request validation failed: {err.messages}")
                error_data = {
                    "error": "Validation error",
                    "error_type": "validation_error",
                    "details": err.messages,
                    "timestamp": datetime.now(timezone.utc)
                }
                serialized_error = serialize_mcp_response(error_data, MCPErrorResponseSchema)
                return jsonify(serialized_error), 400
            select_columns = validated.get("select_columns", [])
            query_params = validated

        # Define default essential columns
        default_columns = [
            "id", "dashboard_title", "slug", "url", "published",
            "changed_by_name", "changed_on", "created_by_name", "created_on"
        ]

        # Determine which columns to load based on parameters
        if request.method == "GET":
            # For GET requests, use select_columns parameter
            select_columns = query_params.get("select_columns", [])
            if isinstance(select_columns, str):
                select_columns = [col.strip() for col in select_columns.split(",") if col.strip()]
            columns_to_load = select_columns if select_columns else default_columns
        else:
            # For POST requests, prioritize select_columns, then columns, then keys
            select_columns = validated.get("select_columns", [])
            columns = validated.get("columns", [])
            keys = validated.get("keys", [])

            # Convert string inputs to lists
            if isinstance(select_columns, str):
                select_columns = [col.strip() for col in select_columns.split(",") if col.strip()]
            if isinstance(columns, str):
                columns = [col.strip() for col in columns.split(",") if col.strip()]
            if isinstance(keys, str):
                keys = [key.strip() for key in keys.split(",") if key.strip()]

            # Use the first non-empty parameter, fallback to default
            if select_columns:
                columns_to_load = select_columns
            elif columns:
                columns_to_load = columns
            elif keys:
                columns_to_load = keys
            else:
                columns_to_load = default_columns

        logger.debug(f"Loading columns: {columns_to_load}")

        # Use DashboardDAO to get dashboards instead of direct SQLAlchemy
        logger.info("Fetching dashboards using DashboardDAO")
        dashboards = DashboardDAO.find_all()
        logger.info(f"Retrieved {len(dashboards)} dashboards from DAO")

        # Apply security context - filter dashboards based on user access
        accessible_dashboards = []
        for dashboard in dashboards:
            try:
                # Check if user has access to this dashboard
                security_manager.raise_for_access(dashboard=dashboard)
                accessible_dashboards.append(dashboard)
            except Exception as access_error:
                logger.debug(f"User does not have access to dashboard {dashboard.id}: {access_error}")
                # Skip this dashboard if user doesn't have access
                continue

        logger.info(f"After security filtering: {len(accessible_dashboards)} accessible dashboards")

        # Apply filters
        if request.method == "GET":
            logger.debug("Applying GET filters")
            filtered_dashboards = apply_query_filters(accessible_dashboards, query_params, search_filters)
        else:
            logger.debug("Applying POST filters")
            filtered_dashboards = apply_rest_filters(accessible_dashboards, validated, search_filters)

        logger.info(f"After filtering: {len(filtered_dashboards)} dashboards")

        # Build response based on requested columns
        result = []
        for dashboard in filtered_dashboards:
            dashboard_data = {}

            # Only include fields that were specifically requested
            if "id" in columns_to_load:
                dashboard_data["id"] = dashboard.id
            if "dashboard_title" in columns_to_load:
                dashboard_data["dashboard_title"] = dashboard.dashboard_title or "Untitled"
            if "slug" in columns_to_load:
                dashboard_data["slug"] = dashboard.slug or ""
            if "url" in columns_to_load:
                dashboard_data["url"] = dashboard.url
            if "published" in columns_to_load:
                dashboard_data["published"] = dashboard.published

            # Include additional fields based on columns_to_load
            if "changed_by" in columns_to_load or "changed_by_name" in columns_to_load:
                dashboard_data["changed_by"] = getattr(dashboard, "changed_by_name", None) or (
                    str(dashboard.changed_by) if dashboard.changed_by else None)
                dashboard_data["changed_by_name"] = getattr(dashboard, "changed_by_name", None) or (
                    str(dashboard.changed_by) if dashboard.changed_by else None)

            if "changed_on" in columns_to_load:
                dashboard_data["changed_on"] = dashboard.changed_on if getattr(dashboard, "changed_on", None) else None
                dashboard_data["changed_on_humanized"] = getattr(dashboard, "changed_on_humanized", None)

            if "created_by" in columns_to_load or "created_by_name" in columns_to_load:
                dashboard_data["created_by"] = getattr(dashboard, "created_by_name", None) or (
                    str(dashboard.created_by) if dashboard.created_by else None)

            if "created_on" in columns_to_load:
                dashboard_data["created_on"] = dashboard.created_on if getattr(dashboard, "created_on", None) else None
                dashboard_data["created_on_humanized"] = getattr(dashboard, "created_on_humanized", None)

            if "tags" in columns_to_load:
                dashboard_data["tags"] = [serialize_tag_object(tag) for tag in dashboard.tags] if dashboard.tags else []

            if "owners" in columns_to_load:
                dashboard_data["owners"] = [serialize_user_object(owner) for owner in
                                            dashboard.owners] if dashboard.owners else []

            if "roles" in columns_to_load:
                dashboard_data["roles"] = [serialize_role_object(role) for role in
                                           dashboard.roles] if dashboard.roles else []

            if "certified_by" in columns_to_load:
                dashboard_data["certified_by"] = dashboard.certified_by
                dashboard_data["certification_details"] = dashboard.certification_details

            if "css" in columns_to_load:
                dashboard_data["css"] = dashboard.css

            if "json_metadata" in columns_to_load:
                dashboard_data["json_metadata"] = dashboard.json_metadata

            if "position_json" in columns_to_load:
                dashboard_data["position_json"] = dashboard.position_json

            if "thumbnail_url" in columns_to_load:
                dashboard_data["thumbnail_url"] = dashboard.thumbnail_url

            if "is_managed_externally" in columns_to_load:
                dashboard_data["is_managed_externally"] = dashboard.is_managed_externally

            if "chart_count" in columns_to_load:
                dashboard_data["chart_count"] = len(dashboard.slices) if dashboard.slices else 0

            if "charts" in columns_to_load:
                dashboard_data["charts"] = [serialize_chart_object(chart) for chart in
                                            dashboard.slices] if dashboard.slices else []

            result.append(dashboard_data)

        # Calculate pagination info
        page = int(request.args.get("page", 0)) if request.method == "GET" else validated.get("page", 0)
        page_size = int(request.args.get("page_size", 100)) if request.method == "GET" else validated.get(
            "page_size", 100)
        total_count = len(filtered_dashboards)
        total_pages = (total_count + page_size - 1) // page_size
        start_idx = page * page_size
        end_idx = start_idx + page_size
        paginated_dashboards = result[start_idx:end_idx]

        logger.debug(
            f"Pagination: page={page}, page_size={page_size}, total={total_count}, showing={len(paginated_dashboards)}")

        response_data = {
            "dashboards": paginated_dashboards,
            "count": len(paginated_dashboards),
            "total_count": total_count,
            "page": page,
            "page_size": page_size,
            "total_pages": total_pages,
            "columns_requested": columns_to_load,
            "columns_loaded": list(set([col for dashboard in paginated_dashboards for col in dashboard.keys()])),
            "filters_applied": get_applied_filters_info(request),
            "pagination": {
                "page": page,
                "page_size": page_size,
                "total_count": total_count,
                "total_pages": total_pages,
                "has_next": page < total_pages - 1,
                "has_prev": page > 0
            }
        }

        # Try to serialize response using schema, fallback to direct response if it fails
        try:
            serialized_response = serialize_mcp_response(response_data, MCPDashboardListResponseSchema)
            logger.info(f"list_dashboards completed successfully: {len(paginated_dashboards)} dashboards returned")
            return jsonify(serialized_response)
        except Exception as serialization_error:
            logger.warning(
                f"Schema serialization failed for list_dashboards, using direct response: {serialization_error}")
            # Return response directly without schema serialization as fallback
            return jsonify(response_data)
    except Exception as e:
        logger.error(f"Error in list_dashboards: {e}", exc_info=True)
        error_data = {
            "error": str(e),
            "error_type": "internal_error",
            "timestamp": datetime.now(timezone.utc)
        }
        serialized_error = serialize_mcp_response(error_data, MCPErrorResponseSchema)
        return jsonify(serialized_error), 500


def apply_query_filters(dashboards, args, search_filters):
    """Apply filters from query parameters using existing Superset filters"""
    logger.debug(f"Applying query filters: {args}")
    filtered_dashboards = dashboards

    # Apply dashboard_title filter
    if args.get("dashboard_title"):
        # Apply the filter logic manually since we don't have a query object
        search_term = args.get("dashboard_title").lower()
        filtered_dashboards = [
            d for d in filtered_dashboards
            if search_term in d.dashboard_title.lower() or
               (d.slug and search_term in d.slug.lower())
        ]
        logger.debug(f"Applied dashboard_title filter: {len(filtered_dashboards)} dashboards remaining")

    # Apply published filter
    if args.get("published") is not None:
        published_value = args.get("published")
        # Convert string to boolean for proper comparison
        if isinstance(published_value, str):
            published_value = published_value.lower() == "true"
        filtered_dashboards = [
            d for d in filtered_dashboards
            if d.published == published_value
        ]
        logger.debug(f"Applied published filter: {len(filtered_dashboards)} dashboards remaining")

    # Apply certified filter
    if args.get("certified") is not None:
        certified_value = args.get("certified")
        # Convert string to boolean for proper comparison
        if isinstance(certified_value, str):
            certified_value = certified_value.lower() == "true"
        filtered_dashboards = [
            d for d in filtered_dashboards
            if (certified_value and d.certified_by and d.certified_by != "") or
               (not certified_value and (not d.certified_by or d.certified_by == ""))
        ]
        logger.debug(f"Applied certified filter: {len(filtered_dashboards)} dashboards remaining")

    # Apply favorite filter (simplified for MCP service)
    if args.get("favorite") is not None:
        favorite_value = args.get("favorite")
        # For MCP service, we'll skip favorite filtering since it requires user context
        # This could be enhanced later with proper user context
        logger.debug("Skipping favorite filter (requires user context)")

    # Apply changed_by filter
    if args.get("changed_by"):
        changed_by_name = args.get("changed_by").lower()
        filtered_dashboards = [
            d for d in filtered_dashboards
            if d.changed_by_name and changed_by_name in d.changed_by_name.lower()
        ]
        logger.debug(f"Applied changed_by filter: {len(filtered_dashboards)} dashboards remaining")

    # Apply created_by filter
    if args.get("created_by"):
        created_by_name = args.get("created_by").lower()
        filtered_dashboards = [
            d for d in filtered_dashboards
            if d.created_by_name and created_by_name in d.created_by_name.lower()
        ]
        logger.debug(f"Applied created_by filter: {len(filtered_dashboards)} dashboards remaining")

    # Apply owner filter
    if args.get("owner"):
        owner_name = args.get("owner").lower()
        filtered_dashboards = [
            d for d in filtered_dashboards
            if d.owners and any(owner.username.lower() == owner_name for owner in d.owners)
        ]
        logger.debug(f"Applied owner filter: {len(filtered_dashboards)} dashboards remaining")

    # Apply chart count filters
    if args.get("chart_count") is not None:
        chart_count = args.get("chart_count")
        filtered_dashboards = [
            d for d in filtered_dashboards
            if len(d.slices) == chart_count
        ]
        logger.debug(f"Applied chart_count filter: {len(filtered_dashboards)} dashboards remaining")

    if args.get("chart_count_min") is not None:
        chart_count_min = args.get("chart_count_min")
        filtered_dashboards = [
            d for d in filtered_dashboards
            if len(d.slices) >= chart_count_min
        ]
        logger.debug(f"Applied chart_count_min filter: {len(filtered_dashboards)} dashboards remaining")

    if args.get("chart_count_max") is not None:
        chart_count_max = args.get("chart_count_max")
        filtered_dashboards = [
            d for d in filtered_dashboards
            if len(d.slices) <= chart_count_max
        ]
        logger.debug(f"Applied chart_count_max filter: {len(filtered_dashboards)} dashboards remaining")

    # Apply tags filter
    if args.get("tags"):
        tag_names = [tag.strip().lower() for tag in args.get("tags").split(",")]
        filtered_dashboards = [
            d for d in filtered_dashboards
            if d.tags and any(tag.name.lower() in tag_names for tag in d.tags)
        ]
        logger.debug(f"Applied tags filter: {len(filtered_dashboards)} dashboards remaining")

    # Apply ordering
    order_column = args.get("order_column")
    order_direction = args.get("order_direction", "asc")

    if order_column:
        reverse = order_direction == "desc"
        if order_column == "dashboard_title":
            filtered_dashboards.sort(key=lambda d: d.dashboard_title.lower(), reverse=reverse)
        elif order_column == "changed_on":
            filtered_dashboards.sort(key=lambda d: d.changed_on or datetime.min, reverse=reverse)
        elif order_column == "created_on":
            filtered_dashboards.sort(key=lambda d: d.created_on or datetime.min, reverse=reverse)
        elif order_column == "chart_count":
            filtered_dashboards.sort(key=lambda d: len(d.slices), reverse=reverse)
        elif order_column == "published":
            filtered_dashboards.sort(key=lambda d: d.published, reverse=reverse)
        logger.debug(f"Applied ordering: {order_column} {order_direction}")

    logger.debug(f"Query filtering completed: {len(filtered_dashboards)} dashboards returned")
    return filtered_dashboards


def apply_rest_filters(dashboards, rest_filters, search_filters):
    """Apply filters from REST API JSON body using existing Superset filters"""
    logger.debug(f"Applying REST filters: {rest_filters}")
    filtered_dashboards = dashboards

    # Apply filters from the filters array
    for filter_obj in rest_filters.get("filters", []):
        col = filter_obj.get("col")
        opr = filter_obj.get("opr")
        value = filter_obj.get("value")

        if col == "dashboard_title" and opr == "sw":
            # Starts with filter
            search_term = value.lower()
            filtered_dashboards = [
                d for d in filtered_dashboards
                if d.dashboard_title.lower().startswith(search_term)
            ]
        elif col == "dashboard_title" and opr == "in":
            # Contains filter
            search_term = value.lower()
            filtered_dashboards = [
                d for d in filtered_dashboards
                if search_term in d.dashboard_title.lower()
            ]
        elif col == "published" and opr == "eq":
            # Published filter
            published_value = value
            # Convert string to boolean for proper comparison
            if isinstance(published_value, str):
                published_value = published_value.lower() == "true"
            filtered_dashboards = [
                d for d in filtered_dashboards
                if d.published == published_value
            ]
        elif col == "certified" and opr == "eq":
            # Certified filter
            certified_value = value
            # Convert string to boolean for proper comparison
            if isinstance(certified_value, str):
                certified_value = certified_value.lower() == "true"
            filtered_dashboards = [
                d for d in filtered_dashboards
                if (certified_value and d.certified_by and d.certified_by != "") or
                   (not certified_value and (not d.certified_by or d.certified_by == ""))
            ]
        elif col == "changed_by" and opr == "in":
            # Changed by filter
            changed_by_name = value.lower()
            filtered_dashboards = [
                d for d in filtered_dashboards
                if d.changed_by_name and changed_by_name in d.changed_by_name.lower()
            ]
        elif col == "created_by" and opr == "in":
            # Created by filter
            created_by_name = value.lower()
            filtered_dashboards = [
                d for d in filtered_dashboards
                if d.created_by_name and created_by_name in d.created_by_name.lower()
            ]
        elif col == "chart_count" and opr == "eq":
            # Chart count filter
            chart_count = value
            filtered_dashboards = [
                d for d in filtered_dashboards
                if len(d.slices) == chart_count
            ]
        elif col == "chart_count" and opr == "gte":
            # Chart count min filter
            chart_count_min = value
            filtered_dashboards = [
                d for d in filtered_dashboards
                if len(d.slices) >= chart_count_min
            ]
        elif col == "chart_count" and opr == "lte":
            # Chart count max filter
            chart_count_max = value
            filtered_dashboards = [
                d for d in filtered_dashboards
                if len(d.slices) <= chart_count_max
            ]

    # Apply ordering
    order_column = rest_filters.get("order_column")
    order_direction = rest_filters.get("order_direction", "asc")

    if order_column:
        reverse = order_direction == "desc"
        if order_column == "dashboard_title":
            filtered_dashboards.sort(key=lambda d: d.dashboard_title.lower(), reverse=reverse)
        elif order_column == "changed_on":
            filtered_dashboards.sort(key=lambda d: d.changed_on or datetime.min, reverse=reverse)
        elif order_column == "created_on":
            filtered_dashboards.sort(key=lambda d: d.created_on or datetime.min, reverse=reverse)
        elif order_column == "chart_count":
            filtered_dashboards.sort(key=lambda d: len(d.slices), reverse=reverse)
        elif order_column == "published":
            filtered_dashboards.sort(key=lambda d: d.published, reverse=reverse)

    logger.debug(f"REST filtering completed: {len(filtered_dashboards)} dashboards returned")
    return filtered_dashboards


def get_applied_filters_info(request):
    """Get information about applied filters"""
    filters_info = {}

    if request.method == "GET":
        # Query parameters
        for key, value in request.args.items():
            if key not in ["page", "page_size", "order_column", "order_direction"]:
                filters_info[key] = value
    else:
        # JSON body
        try:
            body_data = request.get_json() or {}
            if "filters" in body_data:
                filters_info["filters"] = body_data["filters"]
        except Exception:
            pass

    return filters_info


def get_pagination_info(request):
    """Get pagination information"""
    page = int(request.args.get("page", 0))
    page_size = int(request.args.get("page_size", 100))

    return {
        "page": page,
        "page_size": page_size
    }


@mcp_api.route("/dashboard/<int:dashboard_id>", methods=["GET"])
@requires_api_key
def get_dashboard(dashboard_id: int):
    """Get detailed information about a specific dashboard"""
    logger.info(f"get_dashboard called for dashboard_id: {dashboard_id}")
    try:
        from superset.daos.dashboard import DashboardDAO
        from superset.extensions import security_manager

        # Set up a user context for the MCP service
        admin_username = current_app.config.get("MCP_ADMIN_USERNAME", "admin")
        admin_user = security_manager.get_user_by_username(admin_username)

        if not admin_user:
            from flask_login import AnonymousUserMixin
            g.user = AnonymousUserMixin()
            logger.debug("Using anonymous user context for get_dashboard")
        else:
            g.user = admin_user
            logger.debug(f"Using admin user context for get_dashboard: {admin_user.username}")

        # Use DashboardDAO to get dashboard by ID
        logger.debug(f"Fetching dashboard {dashboard_id} using DashboardDAO")
        dashboard = DashboardDAO.find_by_id(dashboard_id)

        if not dashboard:
            logger.warning(f"Dashboard with ID {dashboard_id} not found")
            error_data = {
                "error": f"Dashboard with ID {dashboard_id} not found",
                "error_type": "not_found",
                "timestamp": datetime.now(timezone.utc)
            }
            serialized_error = serialize_mcp_response(error_data, MCPErrorResponseSchema)
            return jsonify(serialized_error), 404

        # Apply security context - check if user has access to this dashboard
        try:
            security_manager.raise_for_access(dashboard=dashboard)
            logger.debug(f"User has access to dashboard {dashboard_id}")
        except Exception as access_error:
            logger.warning(f"User does not have access to dashboard {dashboard_id}: {access_error}")
            error_data = {
                "error": f"Access denied to dashboard {dashboard_id}",
                "error_type": "access_denied",
                "timestamp": datetime.now(timezone.utc)
            }
            serialized_error = serialize_mcp_response(error_data, MCPErrorResponseSchema)
            return jsonify(serialized_error), 403

        logger.debug(f"Dashboard {dashboard_id} found, building response")

        # Format the response with enhanced attributes
        dashboard_data = {
            "id": dashboard.id,
            "dashboard_title": dashboard.dashboard_title or "Untitled",
            "slug": dashboard.slug or "",
            "url": dashboard.url,
            "changed_by": getattr(dashboard, "changed_by_name", None) or (
                str(dashboard.changed_by) if dashboard.changed_by else None),
            "changed_by_name": getattr(dashboard, "changed_by_name", None) or (
                str(dashboard.changed_by) if dashboard.changed_by else None),
            "changed_on": dashboard.changed_on if getattr(dashboard, "changed_on", None) else None,
            "published": dashboard.published,
            # Enhanced attributes
            "tags": [serialize_tag_object(tag) for tag in dashboard.tags] if dashboard.tags else [],
            "owners": [serialize_user_object(owner) for owner in dashboard.owners] if dashboard.owners else [],
            "roles": [serialize_role_object(role) for role in dashboard.roles] if dashboard.roles else [],
            "certified_by": dashboard.certified_by,
            "certification_details": dashboard.certification_details,
            "css": dashboard.css,
            "json_metadata": dashboard.json_metadata,
            "position_json": dashboard.position_json,
            "thumbnail_url": dashboard.thumbnail_url,
            "is_managed_externally": dashboard.is_managed_externally,
            "chart_count": len(dashboard.slices) if dashboard.slices else 0,
            "created_by": getattr(dashboard, "created_by_name", None) or (
                str(dashboard.created_by) if dashboard.created_by else None),
            "created_on": dashboard.created_on if getattr(dashboard, "created_on", None) else None,
            "changed_on_humanized": getattr(dashboard, "changed_on_humanized", None),
            "created_on_humanized": getattr(dashboard, "created_on_humanized", None),
            # Charts information
            "charts": [serialize_chart_object(chart) for chart in dashboard.slices] if dashboard.slices else [],
        }

        # Serialize response using schema
        serialized_response = serialize_mcp_response(dashboard_data, MCPDashboardResponseSchema)
        logger.info(f"get_dashboard completed successfully for dashboard {dashboard_id}")
        return jsonify(serialized_response)

    except Exception as e:
        logger.error(f"Error in get_dashboard for dashboard {dashboard_id}: {e}", exc_info=True)
        error_data = {
            "error": str(e),
            "error_type": "internal_error",
            "timestamp": datetime.now(timezone.utc)
        }
        serialized_error = serialize_mcp_response(error_data, MCPErrorResponseSchema)
        return jsonify(serialized_error), 500


@mcp_api.errorhandler(500)
def handle_500(error):
    """Handle 500 Internal Server Error"""
    logger.error(f"500 error occurred: {error}", exc_info=True)
    error_data = {
        "error": "Internal server error",
        "error_type": "internal_error",
        "timestamp": datetime.now(timezone.utc)
    }
    serialized_error = serialize_mcp_response(error_data, MCPErrorResponseSchema)
    return jsonify(serialized_error), 500


@mcp_api.errorhandler(404)
def handle_404(error):
    """Handle 404 Not Found Error"""
    logger.warning(f"404 error occurred: {error}")
    error_data = {
        "error": "Resource not found",
        "error_type": "not_found",
        "timestamp": datetime.now(timezone.utc)
    }
    serialized_error = serialize_mcp_response(error_data, MCPErrorResponseSchema)
    return jsonify(serialized_error), 404


@mcp_api.errorhandler(401)
def handle_401(error):
    """Handle 401 Unauthorized Error"""
    logger.warning(f"401 error occurred: {error}")
    error_data = {
        "error": "Unauthorized",
        "error_type": "unauthorized",
        "timestamp": datetime.now(timezone.utc)
    }
    serialized_error = serialize_mcp_response(error_data, MCPErrorResponseSchema)
    return jsonify(serialized_error), 401


@mcp_api.errorhandler(403)
def handle_403(error):
    """Handle 403 Forbidden Error"""
    logger.warning(f"403 error occurred: {error}")
    error_data = {
        "error": "Forbidden",
        "error_type": "forbidden",
        "timestamp": datetime.now(timezone.utc)
    }
    serialized_error = serialize_mcp_response(error_data, MCPErrorResponseSchema)
    return jsonify(serialized_error), 403


@mcp_api.errorhandler(ValidationError)
def handle_validation_error(error):
    """Handle Marshmallow Validation Errors"""
    logger.warning(f"Validation error occurred: {error.messages}")
    error_data = {
        "error": "Validation error",
        "error_type": "validation_error",
        "details": error.messages,
        "timestamp": datetime.now(timezone.utc)
    }
    serialized_error = serialize_mcp_response(error_data, MCPErrorResponseSchema)
    return jsonify(serialized_error), 400
