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
from typing import Any, Literal, Optional, Union


class ModelListTool:
    """
    Generic tool for listing model objects with filtering, search, pagination, and
    column selection.

    - Paging is 0-based: page=0 is the first page (to match backend and API
      conventions).
    - total_pages is 0 if there are no results; otherwise, it's ceil(total_count /
      page_size).
    - has_previous is True if page > 0 or (page == 0 and total_count == 0) (so UI
      can disable prev button on empty results).
    - has_next is True if there are more results after the current page.
    - columns_requested/columns_loaded track what columns were requested/returned
      for LLM/OpenAPI friendliness.
    - Returns a strongly-typed Pydantic list schema (output_list_schema) with all
      metadata.
    - Handles both object-based and JSON string filters.
    - Designed for use by LLM agents and API clients.
    """

    def __init__(
        self,
        dao_class: Any,
        output_schema: Any,
        item_serializer: Any,
        filter_type: Any,
        default_columns: Any,
        search_columns: Any,
        list_field_name: str,
        output_list_schema: Any,
        logger: Optional[Any] = None,
    ) -> None:
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
        filters: Optional[Any] = None,
        search: Optional[str] = None,
        select_columns: Optional[Any] = None,
        order_column: Optional[str] = None,
        order_direction: Optional[Literal["asc", "desc"]] = "asc",
        page: int = 0,
        page_size: int = 100,
    ) -> Any:
        from datetime import datetime, timezone

        # If filters is a string (e.g., from a test), parse it as JSON
        if isinstance(filters, str):
            from superset.utils import json

            filters = json.loads(filters)
        # Ensure select_columns is a list and track what was requested
        if select_columns:
            if isinstance(select_columns, str):
                select_columns = [
                    col.strip() for col in select_columns.split(",") if col.strip()
                ]
            columns_to_load = select_columns
            columns_requested = select_columns
        else:
            columns_to_load = self.default_columns
            columns_requested = self.default_columns
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
            has_previous=page > 0,
        )

        # Build response
        def get_keys(obj: Any) -> Any:
            if hasattr(obj, "model_dump"):
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
            "columns_requested": columns_requested,
            "columns_loaded": columns_to_load,
            "filters_applied": filters if isinstance(filters, list) else [],
            "pagination": pagination_info,
            "timestamp": datetime.now(timezone.utc),
        }
        response = self.output_list_schema(**response_kwargs)
        self.logger.info(
            f"Successfully retrieved {len(item_objs)} {self.list_field_name}"
        )
        return response


class ModelGetInfoTool:
    """
    Enhanced tool for retrieving a single model object by ID, UUID, or slug.

    For datasets and charts: supports ID and UUID
    For dashboards: supports ID, UUID, and slug

    Uses the appropriate DAO method to find the object based on identifier type.
    """

    def __init__(
        self,
        dao_class: Any,
        output_schema: Any,
        error_schema: Any,
        serializer: Any,
        supports_slug: bool = False,
        logger: Optional[Any] = None,
    ) -> None:
        self.dao_class = dao_class
        self.output_schema = output_schema
        self.error_schema = error_schema
        self.serializer = serializer
        self.supports_slug = supports_slug
        self.logger = logger or logging.getLogger(__name__)

    def _is_uuid(self, value: str) -> bool:
        """Check if a string is a valid UUID."""
        import uuid

        try:
            uuid.UUID(value)
            return True
        except ValueError:
            return False

    def _find_object(self, identifier: Union[int, str]) -> Any:
        """Find object by identifier using appropriate method."""
        from superset.extensions import db

        # If it's an integer or string that can be converted to int, use find_by_id
        if isinstance(identifier, int):
            return self.dao_class.find_by_id(identifier)

        try:
            # Try to convert string to int
            id_val = int(identifier)
            return self.dao_class.find_by_id(id_val)
        except ValueError:
            pass

        # Check if it's a UUID
        if self._is_uuid(identifier):
            # For UUID lookup, we need to query directly
            import uuid

            model_class = self.dao_class.model_cls
            uuid_obj = uuid.UUID(identifier)
            return (
                db.session.query(model_class)
                .filter(model_class.uuid == uuid_obj)
                .one_or_none()
            )

        # For dashboards, also check slug
        if self.supports_slug:
            # Use the id_or_slug_filter function for dashboards
            from superset.models.dashboard import id_or_slug_filter

            model_class = self.dao_class.model_cls
            return (
                db.session.query(model_class)
                .filter(id_or_slug_filter(identifier))
                .one_or_none()
            )

        # If we get here, it's an invalid identifier
        return None

    def run(self, identifier: Union[int, str]) -> Any:
        from datetime import datetime, timezone

        try:
            obj = self._find_object(identifier)
            if obj is None:
                error_data = self.error_schema(
                    error=(
                        f"{self.output_schema.__name__} with identifier "
                        f"'{identifier}' not found"
                    ),
                    error_type="not_found",
                    timestamp=datetime.now(timezone.utc),
                )
                self.logger.warning(
                    f"{self.output_schema.__name__} {identifier} error: "
                    "not_found - not found"
                )
                return error_data
            response = self.serializer(obj)
            self.logger.info(
                f"{self.output_schema.__name__} response created successfully for "
                f"identifier {identifier}"
            )
            return response
        except Exception as context_error:
            error_msg = f"Error in ModelGetInfoTool: {str(context_error)}"
            self.logger.error(error_msg, exc_info=True)
            raise


class ModelGetAvailableFiltersTool:
    """
    Generic tool for retrieving available filterable columns and operators for a
    model. Used for get_dataset_available_filters, get_chart_available_filters,
    get_dashboard_available_filters, etc.
    """

    def __init__(
        self,
        dao_class: Any,
        output_schema: Any,
        logger: Optional[Any] = None,
    ) -> None:
        self.dao_class = dao_class
        self.output_schema = output_schema
        self.logger = logger or logging.getLogger(__name__)

    def run(self) -> Any:
        try:
            filterable = self.dao_class.get_filterable_columns_and_operators()
            # Ensure column_operators is a plain dict, not a custom type
            column_operators = dict(filterable)
            response = self.output_schema(column_operators=column_operators)
            self.logger.info(
                f"Successfully retrieved available filters for "
                f"{self.dao_class.__name__}"
            )
            return response
        except Exception as e:
            self.logger.error(
                f"Error in ModelGetAvailableFiltersTool: {e}", exc_info=True
            )
            raise
