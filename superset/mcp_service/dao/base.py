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

"""Base DAO Protocol for MCP service."""

from typing import Any, Dict, List, Optional, Protocol, Type, TypeVar

T = TypeVar("T")


class DAO(Protocol):
    """Protocol for Data Access Objects used in model tools."""

    model_cls: Type[Any]

    @classmethod
    def list(
        cls,
        column_operators: Optional[List[Any]] = None,
        order_column: str = "changed_on",
        order_direction: str = "desc",
        page: int = 0,
        page_size: int = 100,
        search: Optional[str] = None,
        search_columns: Optional[List[str]] = None,
        custom_filters: Optional[Dict[str, Any]] = None,
        columns: Optional[List[str]] = None,
    ) -> tuple[List[Any], int]:
        """List method that all DAOs should implement."""
        ...

    @classmethod
    def find_by_id(cls, id: int) -> T | None:
        """Find by ID method that all DAOs should implement."""
        ...

    @classmethod
    def get_filterable_columns_and_operators(cls) -> Dict[str, Any]:
        """Get filterable columns and operators."""
        ...

    @classmethod
    def count(cls) -> int:
        """Count total number of records. Required for instance info."""
        ...
