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

from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import Any, Callable, Generic, List, Literal, Type, TypeVar

from pydantic import BaseModel

from superset.daos.base import BaseDAO
from superset.mcp_service.utils import _is_uuid

# Type variables for generic model tools
T = TypeVar("T")  # For model objects
S = TypeVar("S", bound=BaseModel)  # For Pydantic schemas
F = TypeVar("F", bound=BaseModel)  # For filter types
L = TypeVar("L", bound=BaseModel)  # For list response schemas


class BaseCore(ABC):
    """
    Abstract base class for all MCP Core classes.

    Provides common functionality:
    - Logger initialization
    - Abstract run_tool method that all subclasses must implement
    - Common error handling patterns
    """

    def __init__(self, logger: logging.Logger | None = None) -> None:
        """Initialize the core with an optional logger."""
        self.logger = logger or logging.getLogger(self.__class__.__name__)

    @abstractmethod
    def run_tool(self, *args: Any, **kwargs: Any) -> Any:
        """
        Execute the core tool logic.

        This method must be implemented by all subclasses.
        """
        pass

    def _log_error(self, error: Exception, context: str = "") -> None:
        """Log an error with context."""
        error_msg = f"Error in {self.__class__.__name__}"
        if context:
            error_msg += f" ({context})"
        error_msg += f": {str(error)}"
        self.logger.error(error_msg, exc_info=True)

    def _log_info(self, message: str) -> None:
        """Log an info message."""
        self.logger.info(message)

    def _log_warning(self, message: str) -> None:
        """Log a warning message."""
        self.logger.warning(message)


class ModelListCore(BaseCore, Generic[L]):
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

    output_list_schema: Type[L]

    def __init__(
        self,
        dao_class: Type[BaseDAO[Any]],
        output_schema: Type[S],
        item_serializer: Callable[[T, List[str]], S | None],
        filter_type: Type[F],
        default_columns: List[str],
        search_columns: List[str],
        list_field_name: str,
        output_list_schema: Type[L],
        logger: logging.Logger | None = None,
    ) -> None:
        super().__init__(logger)
        self.dao_class = dao_class
        self.output_schema = output_schema
        self.item_serializer = item_serializer
        self.filter_type = filter_type
        self.default_columns = default_columns
        self.search_columns = search_columns
        self.list_field_name = list_field_name
        self.output_list_schema = output_list_schema

    def run_tool(
        self,
        filters: Any | None = None,
        search: str | None = None,
        select_columns: Any | None = None,
        order_column: str | None = None,
        order_direction: Literal["asc", "desc"] | None = "asc",
        page: int = 0,
        page_size: int = 10,
    ) -> L:
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
        items: List[Any]
        items, total_count = self.dao_class.list(
            column_operators=filters,
            order_column=order_column or "changed_on",
            order_direction=str(order_direction or "desc"),
            page=page,
            page_size=page_size,
            search=search,
            search_columns=self.search_columns,
            columns=columns_to_load,
        )
        # Serialize items
        item_objs = []
        for item in items:
            obj = self.item_serializer(item, columns_to_load)
            if obj is not None:
                item_objs.append(obj)
        total_pages = (total_count + page_size - 1) // page_size if page_size > 0 else 0
        from superset.mcp_service.system.schemas import PaginationInfo

        pagination_info = PaginationInfo(
            page=page,
            page_size=page_size,
            total_count=total_count,
            total_pages=total_pages,
            has_next=page < total_pages - 1,
            has_previous=page > 0,
        )

        # Build response
        def get_keys(obj: BaseModel | dict[str, Any] | Any) -> List[str]:
            if hasattr(obj, "model_dump"):
                return list(obj.model_dump().keys())
            elif isinstance(obj, dict):
                return list(obj.keys())
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
        self._log_info(
            f"Successfully retrieved {len(item_objs)} {self.list_field_name}"
        )
        return response


class ModelGetInfoCore(BaseCore):
    """
    Enhanced tool for retrieving a single model object by ID, UUID, or slug.

    For datasets and charts: supports ID and UUID
    For dashboards: supports ID, UUID, and slug

    Uses the appropriate DAO method to find the object based on identifier type.
    """

    def __init__(
        self,
        dao_class: Type[BaseDAO[Any]],
        output_schema: Type[BaseModel],
        error_schema: Type[BaseModel],
        serializer: Callable[[T], BaseModel],
        supports_slug: bool = False,
        logger: logging.Logger | None = None,
    ) -> None:
        super().__init__(logger)
        self.dao_class = dao_class
        self.output_schema = output_schema
        self.error_schema = error_schema
        self.serializer = serializer
        self.supports_slug = supports_slug

    def _find_object(self, identifier: int | str) -> Any:
        """Find object by identifier using appropriate method."""
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
        if _is_uuid(identifier):
            # Use the new flexible find_by_id with uuid column
            return self.dao_class.find_by_id(identifier, id_column="uuid")

        # For dashboards, also check slug
        if self.supports_slug:
            # Try to find by slug using the new flexible method
            result = self.dao_class.find_by_id(identifier, id_column="slug")
            if result:
                return result

            # Fallback to the existing id_or_slug_filter for complex cases
            from superset.extensions import db
            from superset.models.dashboard import id_or_slug_filter

            model_class = self.dao_class.model_cls
            return (
                db.session.query(model_class)
                .filter(id_or_slug_filter(identifier))
                .one_or_none()
            )

        # If we get here, it's an invalid identifier
        return None

    def run_tool(self, identifier: int | str) -> BaseModel:
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
                self._log_warning(
                    f"{self.output_schema.__name__} {identifier} error: "
                    "not_found - not found"
                )
                return error_data
            response = self.serializer(obj)
            self._log_info(
                f"{self.output_schema.__name__} response created successfully for "
                f"identifier {identifier}"
            )
            return response
        except Exception as context_error:
            self._log_error(context_error)
            raise
