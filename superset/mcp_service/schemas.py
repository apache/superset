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
MCP Service Schemas - Reusing and extending Superset schemas

This module reuses existing Superset schemas through composition and extension
to provide comprehensive validation and serialization for the MCP service.
"""

import json
import logging
from typing import Any, Dict, Optional

from marshmallow import fields, pre_load, Schema, validate, ValidationError

logger = logging.getLogger(__name__)

# =============================================================================
# MCP-specific Request Schemas (extending existing patterns)
# =============================================================================

class MCPFilterSchema(Schema):
    """Schema for individual filter objects - extends Superset filter patterns"""
    col = fields.String(required=True, description="Column to filter on")
    opr = fields.String(required=True, description="Filter operator")
    value = fields.Raw(required=True, description="Filter value")

class MCPDashboardListRequestSchema(Schema):
    """Extended dashboard list request schema with comprehensive filtering"""
    filters = fields.List(fields.Nested(MCPFilterSchema), allow_none=True, 
                         description="List of filter objects")
    columns = fields.List(fields.String(), allow_none=True, 
                         description="Columns to include in response")
    keys = fields.List(fields.String(), allow_none=True, 
                      description="Keys to include in response")
    order_column = fields.String(allow_none=True, 
                                description="Column to order by")
    order_direction = fields.String(allow_none=True, 
                                   validate=validate.OneOf(["asc", "desc"]), 
                                   default="asc", 
                                   description="Order direction")
    page = fields.Integer(allow_none=True, default=0, 
                         description="Page number for pagination")
    page_size = fields.Integer(allow_none=True, default=100, 
                              description="Number of items per page")
    select_columns = fields.List(fields.String(), allow_none=True, 
                                description="Specific columns to select")
    
    @pre_load
    def convert_select_columns(self, data, **kwargs):
        """Convert select_columns from string to list if needed"""
        if isinstance(data, dict) and 'select_columns' in data:
            select_columns = data['select_columns']
            if isinstance(select_columns, str):
                try:
                    # Try to parse as JSON
                    data['select_columns'] = json.loads(select_columns)
                except (json.JSONDecodeError, ValueError):
                    # If JSON parsing fails, split by comma
                    data['select_columns'] = [col.strip() for col in select_columns.split(',') if col.strip()]
        return data

class MCPDashboardSimpleRequestSchema(Schema):
    """Simple dashboard request schema for basic operations"""
    dashboard_title = fields.String(allow_none=True, description="Filter by dashboard title (partial match)")
    published = fields.Boolean(allow_none=True, description="Filter by published status")
    changed_by = fields.String(allow_none=True, description="Filter by last modifier")
    created_by = fields.String(allow_none=True, description="Filter by creator")
    owner = fields.String(allow_none=True, description="Filter by owner")
    certified = fields.Boolean(allow_none=True, description="Filter by certification status")
    favorite = fields.Boolean(allow_none=True, description="Filter by favorite status")
    chart_count = fields.Integer(allow_none=True, description="Filter by exact chart count")
    chart_count_min = fields.Integer(allow_none=True, description="Filter by minimum chart count")
    chart_count_max = fields.Integer(allow_none=True, description="Filter by maximum chart count")
    tags = fields.String(allow_none=True, description="Filter by tags (comma-separated)")
    order_column = fields.String(allow_none=True, description="Column to order by")
    order_direction = fields.String(allow_none=True, validate=validate.OneOf(["asc", "desc"]), default="asc", description="Order direction")
    page = fields.Integer(allow_none=True, default=0, description="Page number for pagination")
    page_size = fields.Integer(allow_none=True, default=100, description="Number of items per page")
    select_columns = fields.List(fields.String(), allow_none=True, 
                                description="List of columns to include in response (default: essential columns only)")
    
    @pre_load
    def convert_select_columns(self, data, **kwargs):
        """Convert select_columns from string to list if needed"""
        if isinstance(data, dict) and "select_columns" in data:
            if isinstance(data["select_columns"], str):
                data["select_columns"] = [col.strip() for col in data["select_columns"].split(",") if col.strip()]
        return data

class MCPDashboardInfoRequestSchema(Schema):
    """Dashboard info request schema"""
    dashboard_id = fields.Integer(required=True, description="Dashboard ID")
    include_charts = fields.Boolean(default=True, description="Include chart information")
    include_datasets = fields.Boolean(default=False, description="Include dataset information")

# =============================================================================
# Schema Composition and Mixins
# =============================================================================

class DashboardFieldsMixin:
    """Mixin providing common dashboard fields that match Superset schemas"""
    
    # Core dashboard fields (matching DashboardGetResponseSchema)
    id = fields.Int(description="Dashboard ID")
    slug = fields.String(description="Dashboard slug")
    url = fields.String(description="Dashboard URL")
    dashboard_title = fields.String(description="Dashboard title")
    thumbnail_url = fields.String(allow_none=True, description="Thumbnail URL")
    published = fields.Boolean(description="Whether dashboard is published")
    css = fields.String(description="Dashboard CSS")
    json_metadata = fields.String(description="Dashboard JSON metadata")
    position_json = fields.String(description="Dashboard position JSON")
    certified_by = fields.String(description="Certified by")
    certification_details = fields.String(description="Certification details")
    changed_by_name = fields.String(description="Changed by name")
    changed_on = fields.DateTime(description="Changed on timestamp")
    created_on = fields.DateTime(description="Created on timestamp")
    created_on_humanized = fields.String(description="Created on humanized")
    changed_on_humanized = fields.String(description="Changed on humanized")
    is_managed_externally = fields.Boolean(description="Managed externally")
    
    # User information (matching actual response structure)
    changed_by = fields.String(description="User who last changed the dashboard")
    created_by = fields.String(description="User who created the dashboard")
    owners = fields.List(fields.Dict(), description="Dashboard owners")
    
    # Additional fields (matching DashboardGetResponseSchema)
    charts = fields.List(fields.Dict(), description="Chart information")
    roles = fields.List(fields.Dict(), description="Dashboard roles")
    tags = fields.List(fields.Dict(), description="Dashboard tags")

# =============================================================================
# MCP Response Schemas (using composition and extension)
# =============================================================================

class MCPDashboardResponseSchema(Schema, DashboardFieldsMixin):
    """Extended dashboard response schema - extends existing DashboardGetResponseSchema"""
    # MCP-specific fields
    access_level = fields.String(description="Access level for MCP context", allow_none=True)
    last_accessed = fields.DateTime(description="Last accessed timestamp", allow_none=True)
    chart_count = fields.Integer(description="Number of charts in dashboard", allow_none=True)

class MCPDashboardListResponseSchema(Schema):
    """Dashboard list response schema using composition of existing schemas"""
    dashboards = fields.List(fields.Nested(MCPDashboardResponseSchema), 
                            description="List of dashboards")
    count = fields.Integer(description="Number of dashboards in current page")
    total_count = fields.Integer(description="Total number of dashboards")
    page = fields.Integer(description="Current page number")
    page_size = fields.Integer(description="Page size")
    total_pages = fields.Integer(description="Total number of pages")
    columns_requested = fields.List(fields.String(), description="Columns that were requested")
    columns_loaded = fields.List(fields.String(), description="Columns that were actually loaded")
    filters_applied = fields.Dict(description="Filters that were applied")
    pagination = fields.Dict(description="Pagination information")

class MCPDashboardDetailResponseSchema(Schema):
    """Dashboard detail response schema using composition of existing schemas"""
    # Use composition - reuse existing schemas directly
    dashboard = fields.Nested(MCPDashboardResponseSchema, description="Dashboard details")
    charts = fields.List(fields.Dict(), description="Dashboard charts")
    datasets = fields.List(fields.Dict(), description="Dashboard datasets")
    related_dashboards = fields.List(fields.Nested(MCPDashboardResponseSchema), 
                                    description="Related dashboards")
    access_permissions = fields.Dict(description="Access permissions")
    usage_statistics = fields.Dict(description="Usage statistics")

# =============================================================================
# MCP Service Schemas (for service operations)
# =============================================================================

class MCPHealthResponseSchema(Schema):
    """Health check response schema"""
    status = fields.String(description="Service status")
    service = fields.String(description="Service name")
    timestamp = fields.DateTime(description="Health check timestamp")
    version = fields.String(description="MCP service version")
    superset_version = fields.String(description="Superset version", allow_none=True)
    database_status = fields.String(description="Database connection status", allow_none=True)
    api_endpoints = fields.List(fields.String(), description="Available API endpoints", allow_none=True)
    error = fields.String(description="Error message if unhealthy", allow_none=True)

class MCPErrorResponseSchema(Schema):
    """Error response schema"""
    error = fields.String(description="Error message")
    error_type = fields.String(description="Error type")
    timestamp = fields.DateTime(description="Error timestamp")
    request_id = fields.String(description="Request ID for tracking", allow_none=True)
    details = fields.Dict(description="Additional error details", allow_none=True)

# =============================================================================
# MCP Filter and Discovery Schemas
# =============================================================================

class MCPFilterInfoSchema(Schema):
    """Schema for filter information"""
    column_name = fields.String(description="Column name")
    filter_type = fields.String(description="Type of filter")
    operators = fields.List(fields.String(), description="Available operators")
    values = fields.List(fields.Raw(), description="Available values")
    description = fields.String(description="Filter description")

class MCPAvailableFiltersResponseSchema(Schema):
    """Response schema for available filters"""
    filters = fields.List(fields.Nested(MCPFilterInfoSchema), 
                         description="Available filters")
    total_filters = fields.Integer(description="Total number of filters")
    categories = fields.List(fields.String(), description="Filter categories")

# =============================================================================
# MCP Instance Information Schemas
# =============================================================================

class MCPInstanceSummarySchema(Schema):
    """Schema for instance summary information"""
    total_dashboards = fields.Integer(description="Total number of dashboards")
    total_charts = fields.Integer(description="Total number of charts")
    total_datasets = fields.Integer(description="Total number of datasets")
    total_databases = fields.Integer(description="Total number of databases")
    total_users = fields.Integer(description="Total number of users")
    total_roles = fields.Integer(description="Total number of roles")
    total_tags = fields.Integer(description="Total number of tags")
    avg_charts_per_dashboard = fields.Float(description="Average charts per dashboard")

class MCPRecentActivitySchema(Schema):
    """Schema for recent activity information"""
    dashboards_created_last_30_days = fields.Integer(description="Dashboards created in last 30 days")
    charts_created_last_30_days = fields.Integer(description="Charts created in last 30 days")
    datasets_created_last_30_days = fields.Integer(description="Datasets created in last 30 days")
    dashboards_modified_last_7_days = fields.Integer(description="Dashboards modified in last 7 days")
    charts_modified_last_7_days = fields.Integer(description="Charts modified in last 7 days")
    datasets_modified_last_7_days = fields.Integer(description="Datasets modified in last 7 days")

class MCPDashboardBreakdownSchema(Schema):
    """Schema for dashboard breakdown information"""
    published = fields.Integer(description="Number of published dashboards")
    unpublished = fields.Integer(description="Number of unpublished dashboards")
    certified = fields.Integer(description="Number of certified dashboards")
    with_charts = fields.Integer(description="Number of dashboards with charts")
    without_charts = fields.Integer(description="Number of dashboards without charts")

class MCPPopularContentSchema(Schema):
    """Schema for popular content information"""
    top_tags = fields.List(fields.Dict(), description="Top tags by usage")
    top_creators = fields.List(fields.Dict(), description="Top creators by dashboard count")

class MCPInstanceInfoResponseSchema(Schema):
    """Response schema for instance information"""
    instance_summary = fields.Nested(MCPInstanceSummarySchema, description="Instance summary")
    recent_activity = fields.Nested(MCPRecentActivitySchema, description="Recent activity")
    dashboard_breakdown = fields.Nested(MCPDashboardBreakdownSchema, description="Dashboard breakdown")
    database_breakdown = fields.Dict(description="Database breakdown by type")
    popular_content = fields.Nested(MCPPopularContentSchema, description="Popular content")
    timestamp = fields.DateTime(description="Response timestamp")

# =============================================================================
# MCP Chart Schemas (extending only when needed)
# =============================================================================

class MCPChartResponseSchema(Schema):
    """Extended chart response schema - adds MCP-specific fields to existing schema"""
    # Core chart fields (matching ChartEntityResponseSchema)
    id = fields.Integer(description="Chart ID")
    slice_name = fields.String(description="Chart name")
    cache_timeout = fields.Integer(description="Cache timeout")
    changed_on = fields.DateTime(description="Changed on timestamp")
    description = fields.String(description="Chart description")
    description_markeddown = fields.String(description="Markdown description")
    form_data = fields.Dict(description="Form data")
    slice_url = fields.String(description="Chart URL")
    certified_by = fields.String(description="Certified by")
    certification_details = fields.String(description="Certification details")
    
    # Add MCP-specific fields to the existing chart schema
    dashboard_ids = fields.List(fields.Integer(), description="Dashboard IDs")

# =============================================================================
# MCP Dataset Schemas (extending only when needed)
# =============================================================================

class MCPDatasetResponseSchema(Schema):
    """Extended dataset response schema - adds MCP-specific fields to existing schema"""
    # Core dataset fields (matching DatasetPostSchema)
    id = fields.Integer(description="Dataset ID")
    table_name = fields.String(description="Table name")
    database_id = fields.Integer(description="Database ID")
    schema = fields.String(description="Schema name")
    catalog = fields.String(description="Catalog name")
    sql = fields.String(description="SQL query")
    description = fields.String(description="Dataset description")
    main_dttm_col = fields.String(description="Main datetime column")
    cache_timeout = fields.Integer(description="Cache timeout")
    is_sqllab_view = fields.Boolean(description="Is SQL Lab view")
    template_params = fields.String(description="Template parameters")
    
    # Add MCP-specific fields to the existing dataset schema
    column_count = fields.Integer(description="Number of columns")
    metric_count = fields.Integer(description="Number of metrics")
    chart_count = fields.Integer(description="Number of charts using this dataset")
    dashboard_count = fields.Integer(description="Number of dashboards using this dataset")

# =============================================================================
# Utility functions for schema serialization and composition
# =============================================================================

def create_mcp_schema_from_superset(base_schema_class, additional_fields=None):
    """
    Create an MCP schema that extends a Superset schema with additional fields.
    
    Args:
        base_schema_class: The base Superset schema class to extend
        additional_fields: Dict of additional fields to add
    
    Returns:
        A new schema class that extends the base schema
    """
    if additional_fields is None:
        additional_fields = {}
    
    class ExtendedSchema(base_schema_class):
        pass
    
    # Add additional fields
    for field_name, field_obj in additional_fields.items():
        setattr(ExtendedSchema, field_name, field_obj)
    
    return ExtendedSchema

def serialize_dashboard_for_mcp(dashboard_obj):
    """Serialize a dashboard object for MCP response"""
    schema = MCPDashboardResponseSchema()
    return schema.dump(dashboard_obj)

def serialize_chart_for_mcp(chart_obj):
    """Serialize a chart object for MCP response"""
    schema = MCPChartResponseSchema()
    return schema.dump(chart_obj)

def serialize_dataset_for_mcp(dataset_obj):
    """Serialize a dataset object for MCP response"""
    schema = MCPDatasetResponseSchema()
    return schema.dump(dataset_obj)

def validate_mcp_request(data, schema_class):
    """Validate MCP request data against a schema"""
    schema = schema_class()
    try:
        return schema.load(data)
    except ValidationError as e:
        logger.error(f"Validation error: {e.messages}")
        raise

def serialize_mcp_response(data, schema_class):
    """Serialize MCP response data using a schema"""
    schema = schema_class()
    try:
        return schema.dump(data)
    except ValidationError as e:
        logger.error(f"Serialization error: {e.messages}")
        # Return data as-is if serialization fails
        return data

# =============================================================================
# Schema Registry for MCP Service
# =============================================================================

def get_schema_for_endpoint(endpoint_name: str) -> Optional[Schema]:
    """Get the appropriate schema for a given endpoint"""
    schema_map = {
        "health": MCPHealthResponseSchema,
        "list_dashboards": MCPDashboardListResponseSchema,
        "get_dashboard": MCPDashboardDetailResponseSchema,
        "list_charts": MCPChartResponseSchema,
        "list_datasets": MCPDatasetResponseSchema,
    }
    return schema_map.get(endpoint_name)

def get_response_schema_for_endpoint(endpoint_name: str) -> Optional[Schema]:
    """Get the response schema for a given endpoint"""
    return get_schema_for_endpoint(endpoint_name)

# =============================================================================
# Schema Instances
# =============================================================================

# Request schemas
mcp_dashboard_list_request_schema = MCPDashboardListRequestSchema()
mcp_dashboard_simple_request_schema = MCPDashboardSimpleRequestSchema()
mcp_dashboard_info_request_schema = MCPDashboardInfoRequestSchema()

# Response schemas
mcp_dashboard_response_schema = MCPDashboardResponseSchema()
mcp_dashboard_list_response_schema = MCPDashboardListResponseSchema()
mcp_dashboard_detail_response_schema = MCPDashboardDetailResponseSchema()
mcp_health_response_schema = MCPHealthResponseSchema()
mcp_error_response_schema = MCPErrorResponseSchema()
mcp_available_filters_response_schema = MCPAvailableFiltersResponseSchema()

# =============================================================================
# Utility Functions
# =============================================================================

def get_schema_for_endpoint(endpoint_name: str) -> Optional[Schema]:
    """Get the appropriate schema for an endpoint"""
    schema_map = {
        "list_dashboards": mcp_dashboard_list_request_schema,
        "list_dashboards_simple": mcp_dashboard_simple_request_schema,
        "get_dashboard_info": mcp_dashboard_info_request_schema,
        "health": None,  # No request schema for health check
        "get_available_filters": None,  # No request schema for filters
    }
    return schema_map.get(endpoint_name)

def get_response_schema_for_endpoint(endpoint_name: str) -> Optional[Schema]:
    """Get the appropriate response schema for an endpoint"""
    schema_map = {
        "list_dashboards": mcp_dashboard_list_response_schema,
        "list_dashboards_simple": mcp_dashboard_response_schema,
        "get_dashboard_info": mcp_dashboard_detail_response_schema,
        "health": mcp_health_response_schema,
        "get_available_filters": mcp_available_filters_response_schema,
    }
    return schema_map.get(endpoint_name) 
