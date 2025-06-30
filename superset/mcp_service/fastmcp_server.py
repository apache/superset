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
FastMCP Server for Superset MCP Service

This module provides a FastMCP server that acts as a bridge between
Claude Desktop and the Superset MCP Service API.
"""

import json
import logging
import os
import sys
from typing import Any, Dict, List, Optional

import requests
from fastmcp import FastMCP

# Configure logging
logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

mcp = FastMCP("Superset MCP Server")

# Configuration
API_BASE_URL = "http://localhost:5008/api/mcp/v1"
API_KEY = os.getenv("MCP_API_KEY", "your-secret-api-key-here")

# Headers for API authentication
API_HEADERS = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
}

logger.info(f"MCP Server initialized with API_BASE_URL: {API_BASE_URL}")


def get_shared_app():
    """Get the shared Flask app from server.py"""
    try:
        from superset.mcp_service.server import get_shared_app
        return get_shared_app()
    except ImportError:
        logger.warning("Could not import get_shared_app from server.py")
        return None


@mcp.tool()
def list_dashboards(
    filters: Optional[List[Dict[str, Any]]] = None,
    columns: Optional[List[str]] = None,
    keys: Optional[List[str]] = None,
    order_column: Optional[str] = None,
    order_direction: Optional[str] = "asc",
    page: int = 0,
    page_size: int = 100,
    select_columns: Optional[List[str]] = None,
) -> Any:
    """
    ADVANCED FILTERING: List dashboards using complex filter objects and JSON payload
    
    This tool uses POST requests with structured filter objects for complex queries.
    Each filter is a dictionary with 'col', 'opr', 'value' keys allowing advanced
    operations like multiple conditions, complex operators, and nested filtering.
    
    Example filters:
    [
        {"col": "dashboard_title", "opr": "sw", "value": "Sales"},
        {"col": "published", "opr": "eq", "value": true},
        {"col": "chart_count", "opr": "gte", "value": 5}
    ]
    
    Args:
        filters: List of filter dictionaries with 'col', 'opr', 'value' keys (can be string or list)
        columns: List of columns to include in response (can be string or list)
        keys: List of keys to include in response (can be string or list)
        order_column: Column to order by
        order_direction: Order direction ('asc' or 'desc')
        page: Page number for pagination
        page_size: Number of items per page
        select_columns: List of specific columns to select (can be string or list)
    
    Returns:
        Dictionary containing dashboard list and metadata
    """
    logger.info("list_dashboards (advanced) called")
    logger.debug(
        f"Parameters: filters={filters}, columns={columns}, keys={keys}, order_column={order_column}, "
        f"order_direction={order_direction}, page={page}, page_size={page_size}, select_columns={select_columns}")
    
    try:
        # Handle filters conversion if it's a string
        if isinstance(filters, str):
            try:
                filters = json.loads(filters)
                logger.debug(f"Parsed filters from string: {filters}")
            except (json.JSONDecodeError, ValueError) as e:
                logger.warning(f"Failed to parse filters JSON: {e}")
                filters = []
        elif filters is None:
            filters = []

        # Handle columns conversion if it's a string
        if isinstance(columns, str):
            try:
                columns = json.loads(columns)
                logger.debug(f"Parsed columns from string: {columns}")
            except (json.JSONDecodeError, ValueError):
                columns = [col.strip() for col in columns.split(',') if col.strip()]
                logger.debug(f"Parsed columns from comma-separated string: {columns}")
        elif columns is None:
            columns = []

        # Handle keys conversion if it's a string
        if isinstance(keys, str):
            try:
                keys = json.loads(keys)
                logger.debug(f"Parsed keys from string: {keys}")
            except (json.JSONDecodeError, ValueError):
                keys = [key.strip() for key in keys.split(',') if key.strip()]
                logger.debug(f"Parsed keys from comma-separated string: {keys}")
        elif keys is None:
            keys = []

        # Handle select_columns conversion if it's a string
        if isinstance(select_columns, str):
            try:
                select_columns = json.loads(select_columns)
                logger.debug(f"Parsed select_columns from string: {select_columns}")
            except (json.JSONDecodeError, ValueError):
                select_columns = [col.strip() for col in select_columns.split(',') if col.strip()]
                logger.debug(f"Parsed select_columns from comma-separated string: {select_columns}")
        elif select_columns is None:
            select_columns = []

        # Ensure all list fields are properly initialized
        if not isinstance(columns, list):
            columns = []
        if not isinstance(keys, list):
            keys = []
        if not isinstance(select_columns, list):
            select_columns = []

        # Prepare request payload
        payload = {
            "filters": filters,
            "columns": columns,
            "keys": keys,
            "order_column": order_column,
            "order_direction": order_direction,
            "page": page,
            "page_size": page_size,
            "select_columns": select_columns
        }
        
        # Remove None values
        payload = {k: v for k, v in payload.items() if v is not None}
        
        logger.debug(f"Making POST request to {API_BASE_URL}/list_dashboards with payload: {payload}")
        
        # Call the Flask API endpoint with authentication
        response = requests.post(
            f"{API_BASE_URL}/list_dashboards",
            headers=API_HEADERS,
            json=payload,
            timeout=30  # Add timeout for better error handling
        )
        
        logger.debug(f"Response status code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            logger.info(f"Successfully retrieved {len(data.get('dashboards', []))} dashboards")
            return data
        else:
            error_msg = f"API request failed with status {response.status_code}: {response.text}"
            logger.error(error_msg)
            return {"error": error_msg, "status_code": response.status_code}
            
    except requests.exceptions.RequestException as e:
        error_msg = f"Request failed: {str(e)}"
        logger.error(error_msg, exc_info=True)
        return {"error": error_msg, "error_type": "request_exception"}
    except Exception as e:
        error_msg = f"Unexpected error: {str(e)}"
        logger.error(error_msg, exc_info=True)
        return {"error": error_msg, "error_type": "unexpected_error"}


@mcp.tool()
def list_dashboards_simple(
    dashboard_title: Optional[str] = None,
    published: Optional[bool] = None,
    changed_by: Optional[str] = None,
    created_by: Optional[str] = None,
    owner: Optional[str] = None,
    certified: Optional[bool] = None,
    favorite: Optional[bool] = None,
    chart_count: Optional[int] = None,
    chart_count_min: Optional[int] = None,
    chart_count_max: Optional[int] = None,
    tags: Optional[str] = None,
    order_column: Optional[str] = None,
    order_direction: Optional[str] = "asc",
    page: int = 0,
    page_size: int = 100,
) -> Any:
    """
    SIMPLE FILTERING: List dashboards using individual query parameters
    
    This tool uses GET requests with simple query parameters for basic filtering.
    Each parameter corresponds to a single filter condition, making it easier
    for simple use cases but less flexible for complex queries.
    
    Use this for:
    - Single condition filters
    - Quick dashboard searches
    - Simple parameter-based queries
    
    Use list_dashboards (advanced) for:
    - Multiple conditions
    - Complex filter combinations
    - Advanced operators
    
    Args:
        dashboard_title: Filter by dashboard title (partial match)
        published: Filter by published status
        changed_by: Filter by last modifier
        created_by: Filter by creator
        owner: Filter by owner
        certified: Filter by certification status
        favorite: Filter by favorite status
        chart_count: Filter by exact chart count
        chart_count_min: Filter by minimum chart count
        chart_count_max: Filter by maximum chart count
        tags: Filter by tags (comma-separated)
        order_column: Column to order by
        order_direction: Order direction ('asc' or 'desc')
        page: Page number for pagination (0-based)
        page_size: Number of items per page
    
    Returns:
        Dictionary containing dashboard list and metadata
    """
    logger.info("list_dashboards_simple called")
    logger.debug(
        f"Parameters: dashboard_title={dashboard_title}, published={published}, changed_by={changed_by}, "
        f"created_by={created_by}, owner={owner}, certified={certified}, favorite={favorite}, "
        f"chart_count={chart_count}, chart_count_min={chart_count_min}, chart_count_max={chart_count_max}, "
        f"tags={tags}, order_column={order_column}, order_direction={order_direction}, page={page}, "
        f"page_size={page_size}")
    
    try:
        # Build query parameters
        params = {
            "page": page,
            "page_size": page_size
        }
        
        if dashboard_title:
            params["dashboard_title"] = dashboard_title
        if published is not None:
            params["published"] = str(published).lower()
        if changed_by:
            params["changed_by"] = changed_by
        if created_by:
            params["created_by"] = created_by
        if owner:
            params["owner"] = owner
        if certified is not None:
            params["certified"] = str(certified).lower()
        if favorite is not None:
            params["favorite"] = str(favorite).lower()
        if chart_count is not None:
            params["chart_count"] = chart_count
        if chart_count_min is not None:
            params["chart_count_min"] = chart_count_min
        if chart_count_max is not None:
            params["chart_count_max"] = chart_count_max
        if tags:
            params["tags"] = tags
        if order_column:
            params["order_column"] = order_column
        if order_direction:
            params["order_direction"] = order_direction
        
        logger.debug(f"Making GET request to {API_BASE_URL}/list_dashboards with params: {params}")
        
        # Call the Flask API endpoint with authentication
        response = requests.get(
            f"{API_BASE_URL}/list_dashboards",
            headers=API_HEADERS,
            params=params,
            timeout=30  # Add timeout for better error handling
        )
        
        logger.debug(f"Response status code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            logger.info(f"Successfully retrieved {len(data.get('dashboards', []))} dashboards")
            return data
        else:
            error_msg = f"API request failed with status {response.status_code}: {response.text}"
            logger.error(error_msg)
            return {"error": error_msg, "status_code": response.status_code}
            
    except requests.exceptions.RequestException as e:
        error_msg = f"Request failed: {str(e)}"
        logger.error(error_msg, exc_info=True)
        return {"error": error_msg, "error_type": "request_exception"}
    except Exception as e:
        error_msg = f"Unexpected error: {str(e)}"
        logger.error(error_msg, exc_info=True)
        return {"error": error_msg, "error_type": "unexpected_error"}


@mcp.tool()
def get_dashboard_info(dashboard_id: int) -> Any:
    """Get detailed information about a specific dashboard"""
    logger.info(f"get_dashboard_info called for dashboard_id: {dashboard_id}")
    
    try:
        logger.debug(f"Making GET request to {API_BASE_URL}/dashboard/{dashboard_id}")
        
        # Call the Flask API endpoint with authentication
        response = requests.get(
            f"{API_BASE_URL}/dashboard/{dashboard_id}", 
            headers=API_HEADERS,
            timeout=30  # Add timeout for better error handling
        )
        
        logger.debug(f"Response status code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            logger.info(f"Successfully retrieved dashboard {dashboard_id}")
            return data
        elif response.status_code == 404:
            error_msg = f"Dashboard {dashboard_id} not found"
            logger.warning(error_msg)
            return {"error": error_msg, "status_code": 404}
        elif response.status_code == 403:
            error_msg = f"Access denied to dashboard {dashboard_id}"
            logger.warning(error_msg)
            return {"error": error_msg, "status_code": 403}
        else:
            error_msg = f"API request failed with status {response.status_code}: {response.text}"
            logger.error(error_msg)
            return {"error": error_msg, "status_code": response.status_code}
            
    except requests.exceptions.RequestException as e:
        error_msg = f"Request failed: {str(e)}"
        logger.error(error_msg, exc_info=True)
        return {"error": error_msg, "error_type": "request_exception"}
    except Exception as e:
        error_msg = f"Unexpected error: {str(e)}"
        logger.error(error_msg, exc_info=True)
        return {"error": error_msg, "error_type": "unexpected_error"}


@mcp.tool()
def health_check() -> Any:
    """Check the health of the MCP service"""
    logger.info("health_check called")

    try:
        logger.debug(f"Making GET request to {API_BASE_URL}/health")

        # Call the Flask API endpoint with authentication
        response = requests.get(
            f"{API_BASE_URL}/health",
            headers=API_HEADERS,
            timeout=10  # Shorter timeout for health checks
        )

        logger.debug(f"Response status code: {response.status_code}")

        if response.status_code == 200:
            data = response.json()
            logger.info("Health check successful")
            # The Flask API already validates the response, so we can return it directly
            return data
        elif response.status_code == 401:
            logger.error("Authentication failed. Check your API key.")
            return {"error": "Authentication failed. Check your API key."}
        else:
            logger.error(f"Health check failed with status {response.status_code}: {response.text}")
            return {
                "error": f"API call failed: {response.status_code}",
                "details": response.text}

    except requests.exceptions.Timeout:
        logger.error("Health check timeout")
        return {"error": "Health check timeout - API server may be unavailable"}
    except requests.exceptions.ConnectionError:
        logger.error("Health check connection error - API server may be down")
        return {"error": "Connection error - API server may be down"}
    except Exception as e:
        logger.error(f"Unexpected error in health_check: {e}", exc_info=True)
        return {"error": str(e)}


@mcp.tool()
def get_available_filters() -> Any:
    """Get information about available filters and their operators"""
    logger.info("get_available_filters called")

    try:
        # Define available filters based on our schema
        filters = {
            "dashboard_title": {
                "name": "dashboard_title",
                "description": "Filter by dashboard title (partial match)",
                "type": "string",
                "operators": ["sw", "in", "eq"],
                "values": None
            },
            "published": {
                "name": "published",
                "description": "Filter by published status",
                "type": "boolean",
                "operators": ["eq"],
                "values": [True, False]
            },
            "changed_by": {
                "name": "changed_by",
                "description": "Filter by last modifier",
                "type": "string",
                "operators": ["in", "eq"],
                "values": None
            },
            "created_by": {
                "name": "created_by",
                "description": "Filter by creator",
                "type": "string",
                "operators": ["in", "eq"],
                "values": None
            },
            "owner": {
                "name": "owner",
                "description": "Filter by owner",
                "type": "string",
                "operators": ["in", "eq"],
                "values": None
            },
            "certified": {
                "name": "certified",
                "description": "Filter by certification status",
                "type": "boolean",
                "operators": ["eq"],
                "values": [True, False]
            },
            "favorite": {
                "name": "favorite",
                "description": "Filter by favorite status",
                "type": "boolean",
                "operators": ["eq"],
                "values": [True, False]
            },
            "chart_count": {
                "name": "chart_count",
                "description": "Filter by chart count",
                "type": "integer",
                "operators": ["eq", "gte", "lte"],
                "values": None
            },
            "tags": {
                "name": "tags",
                "description": "Filter by tags",
                "type": "string",
                "operators": ["in"],
                "values": None
            }
        }

        operators = ["eq", "ne", "in", "nin", "sw", "ew", "gte", "lte", "gt", "lt"]
        columns = [
            "id", "dashboard_title", "slug", "url", "changed_by", "changed_on",
            "created_by", "created_on", "published", "certified_by",
            "certification_details",
            "chart_count", "owners", "tags", "is_managed_externally", "external_url",
            "uuid", "version"
        ]

        response_data = {
            "filters": filters,
            "operators": operators,
            "columns": columns
        }

        logger.info("Successfully retrieved available filters and operators")
        # Return the response data directly without validation
        return response_data

    except Exception as e:
        logger.error(f"Unexpected error in get_available_filters: {e}", exc_info=True)
        return {"error": str(e)}
