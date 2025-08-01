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
from datetime import datetime, timezone
from typing import Any, Callable, Dict, List, Literal, Optional, Type, TypeVar

from pydantic import BaseModel

from superset.mcp_service.dao import DAO
from superset.mcp_service.retry_utils import retry_database_operation

# Type variables for generic model tools
T = TypeVar("T")  # For model objects
S = TypeVar("S", bound=BaseModel)  # For Pydantic schemas
F = TypeVar("F", bound=BaseModel)  # For filter types


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
        dao_class: DAO,
        output_schema: Type[S],
        item_serializer: Callable[[T, List[str]], S | None],
        filter_type: Type[F],
        default_columns: List[str],
        search_columns: List[str],
        list_field_name: str,
        output_list_schema: Type[BaseModel],
        logger: Optional[logging.Logger] = None,
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
        # Query the DAO with retry logic for database resilience
        items: List[Any]
        items, total_count = retry_database_operation(
            self.dao_class.list,
            column_operators=filters,
            order_column=order_column or "changed_on",
            order_direction=order_direction or "desc",
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
        from superset.mcp_service.schemas import PaginationInfo

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
        dao_class: DAO,
        output_schema: Type[BaseModel],
        error_schema: Type[BaseModel],
        serializer: Callable[[T], BaseModel],
        supports_slug: bool = False,
        logger: Optional[logging.Logger] = None,
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

    def _find_object(self, identifier: int | str) -> Any:
        """Find object by identifier using appropriate method with retry logic."""
        # If it's an integer or string that can be converted to int, use find_by_id
        if isinstance(identifier, int):
            return retry_database_operation(self.dao_class.find_by_id, identifier)

        try:
            # Try to convert string to int
            id_val = int(identifier)
            return retry_database_operation(self.dao_class.find_by_id, id_val)
        except ValueError:
            pass

        # Check if it's a UUID
        if self._is_uuid(identifier):
            # Use the new flexible find_by_id with uuid column
            import uuid

            uuid_obj = uuid.UUID(identifier)
            return retry_database_operation(
                self.dao_class.find_by_id, uuid_obj, id_column="uuid"
            )

        # For dashboards, also check slug
        if self.supports_slug:
            # Try to find by slug using the new flexible method
            result = retry_database_operation(
                self.dao_class.find_by_id, identifier, id_column="slug"
            )
            if result:
                return result

            # Fallback to the existing id_or_slug_filter for complex cases
            def _complex_slug_query() -> Any:
                from superset.extensions import db
                from superset.models.dashboard import id_or_slug_filter

                model_class = self.dao_class.model_cls
                return (
                    db.session.query(model_class)
                    .filter(id_or_slug_filter(identifier))
                    .one_or_none()
                )

            return retry_database_operation(_complex_slug_query)

        # If we get here, it's an invalid identifier
        return None

    def run(self, identifier: int | str) -> Any:
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


class InstanceInfoTool:
    """
    Configurable tool for generating comprehensive instance information.

    Provides a flexible way to gather and present statistics about a Superset
    instance with configurable metrics, time windows, and data aggregations.
    Supports custom metric calculators and result transformers for extensibility.
    """

    def __init__(
        self,
        dao_classes: Dict[str, DAO],
        output_schema: Type[BaseModel],
        metric_calculators: Dict[str, Callable[..., Any]],
        time_windows: Optional[Dict[str, int]] = None,
        logger: Optional[logging.Logger] = None,
    ) -> None:
        """
        Initialize the instance info tool.

        Args:
            dao_classes: Dict mapping entity names to their DAO classes
            output_schema: Pydantic schema for the response
            metric_calculators: Dict of custom metric calculation functions
            time_windows: Dict of time window configurations (days)
            logger: Optional logger instance
        """
        self.dao_classes = dao_classes
        self.output_schema = output_schema
        self.metric_calculators = metric_calculators
        self.time_windows = time_windows or {
            "recent": 7,
            "monthly": 30,
            "quarterly": 90,
        }
        self.logger = logger or logging.getLogger(__name__)

    def _calculate_basic_counts(self) -> Dict[str, int]:
        """Calculate basic entity counts using DAOs."""
        counts = {}
        for entity_name, dao_class in self.dao_classes.items():
            try:
                counts[f"total_{entity_name}"] = dao_class.count()
            except Exception as e:
                self.logger.warning(f"Failed to count {entity_name}: {e}")
                counts[f"total_{entity_name}"] = 0
        return counts

    def _calculate_time_based_metrics(
        self, base_counts: Dict[str, int]
    ) -> Dict[str, Dict[str, int]]:
        """Calculate time-based metrics for recent activity."""
        from datetime import datetime, timedelta, timezone

        from superset.daos.base import ColumnOperator, ColumnOperatorEnum

        now = datetime.now(timezone.utc)
        time_metrics = {}

        for window_name, days in self.time_windows.items():
            cutoff_date = now - timedelta(days=days)
            window_metrics = {}

            # Calculate created and modified counts for each entity
            for entity_name, dao_class in self.dao_classes.items():
                # Skip entities without time tracking
                if not hasattr(dao_class.model_cls, "created_on"):
                    continue

                try:
                    # Use list() with filters (count() has no params)
                    _, created_count = dao_class.list(
                        column_operators=[
                            ColumnOperator(
                                col="created_on",
                                opr=ColumnOperatorEnum.gte,
                                value=cutoff_date,
                            )
                        ],
                        page_size=1,  # We only need the count
                        columns=["id"],  # Minimal data transfer
                    )
                    window_metrics[f"{entity_name}_created"] = created_count

                    # Modified count (if changed_on exists)
                    if hasattr(dao_class.model_cls, "changed_on"):
                        _, modified_count = dao_class.list(
                            column_operators=[
                                ColumnOperator(
                                    col="changed_on",
                                    opr=ColumnOperatorEnum.gte,
                                    value=cutoff_date,
                                )
                            ],
                            page_size=1,  # We only need the count
                            columns=["id"],  # Minimal data transfer
                        )
                        window_metrics[f"{entity_name}_modified"] = modified_count

                except Exception as e:
                    self.logger.warning(
                        f"Failed to calculate {window_name} metrics for "
                        f"{entity_name}: {e}"
                    )
                    window_metrics[f"{entity_name}_created"] = 0
                    window_metrics[f"{entity_name}_modified"] = 0

            time_metrics[window_name] = window_metrics

        return time_metrics

    def _calculate_custom_metrics(
        self, base_counts: Dict[str, int], time_metrics: Dict[str, Dict[str, int]]
    ) -> Dict[str, Any]:
        """Calculate custom metrics using provided calculators."""
        custom_metrics = {}

        for metric_name, calculator in self.metric_calculators.items():
            try:
                # Pass context to calculator functions
                result = calculator(
                    base_counts=base_counts,
                    time_metrics=time_metrics,
                    dao_classes=self.dao_classes,
                )
                # Only include successful calculations
                if result is not None:
                    custom_metrics[metric_name] = result
            except Exception as e:
                self.logger.warning(f"Failed to calculate {metric_name}: {e}")
                # Don't add failed metrics to avoid validation errors

        return custom_metrics

    def run(self) -> BaseModel:
        """Generate comprehensive instance information."""
        try:
            # Calculate all metrics
            base_counts = self._calculate_basic_counts()
            time_metrics = self._calculate_time_based_metrics(base_counts)
            custom_metrics = self._calculate_custom_metrics(base_counts, time_metrics)

            # Combine all data with fallbacks for required fields
            from datetime import datetime, timezone

            response_data = {
                **base_counts,
                **time_metrics,
                **custom_metrics,
                "timestamp": datetime.now(timezone.utc),
            }

            # Create response using the configured schema
            response = self.output_schema(**response_data)

            self.logger.info("Successfully generated instance information")
            return response

        except Exception as e:
            self.logger.error(f"Error in InstanceInfoTool: {e}", exc_info=True)
            raise


class ModelGetAvailableFiltersTool:
    """
    Generic tool for retrieving available filterable columns and operators for a
    model. Used for get_dataset_available_filters, get_chart_available_filters,
    get_dashboard_available_filters, etc.
    """

    def __init__(
        self,
        dao_class: DAO,
        output_schema: Type[BaseModel],
        logger: Optional[logging.Logger] = None,
    ) -> None:
        self.dao_class = dao_class
        self.output_schema = output_schema
        self.logger = logger or logging.getLogger(__name__)

    def run(self) -> BaseModel:
        try:
            filterable = self.dao_class.get_filterable_columns_and_operators()
            # Ensure column_operators is a plain dict, not a custom type
            column_operators = dict(filterable)
            response = self.output_schema(column_operators=column_operators)
            self.logger.info(
                f"Successfully retrieved available filters for "
                f"{self.dao_class.__class__.__name__}"
            )
            return response
        except Exception as e:
            self.logger.error(
                f"Error in ModelGetAvailableFiltersTool: {e}", exc_info=True
            )
            raise
