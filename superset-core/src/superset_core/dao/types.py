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

"""Base classes for Data Access Objects."""

from abc import ABC, abstractmethod
from typing import Any, ClassVar, Generic, TypeVar, Union

from flask_appbuilder.models.filters import BaseFilter
from sqlalchemy.orm import Query

from superset_core.models.base import CoreModel

# Type variable bound to our CoreModel
T = TypeVar("T", bound=CoreModel)


class BaseDAO(Generic[T], ABC):
    """
    Abstract base class for DAOs.

    This ABC defines the base that all DAOs should implement,
    providing consistent CRUD operations across Superset and extensions.
    ```
    """

    # Due to mypy limitations, we can't have `type[T]` here
    model_cls: ClassVar[type[Any] | None]
    base_filter: ClassVar[BaseFilter | None]
    id_column_name: ClassVar[str]
    uuid_column_name: ClassVar[str]

    @classmethod
    @abstractmethod
    def find_by_id(
        cls,
        model_id: Union[str, int],
        skip_base_filter: bool = False,
        id_column: str | None = None,
    ) -> T | None:
        """Find a model by ID."""
        ...

    @classmethod
    @abstractmethod
    def find_by_id_or_uuid(
        cls,
        model_id_or_uuid: str,
        skip_base_filter: bool = False,
    ) -> T | None:
        """Find a model by ID or UUID."""
        ...

    @classmethod
    @abstractmethod
    def find_by_ids(
        cls,
        model_ids: Union[list[str], list[int]],
        skip_base_filter: bool = False,
    ) -> list[T]:
        """Find models by list of IDs."""
        ...

    @classmethod
    @abstractmethod
    def find_all(cls) -> list[T]:
        """Get all entities that fit the base_filter."""
        ...

    @classmethod
    @abstractmethod
    def find_one_or_none(cls, **filter_by: Any) -> T | None:
        """Get the first entity that fits the base_filter."""
        ...

    @classmethod
    @abstractmethod
    def create(
        cls,
        item: T | None = None,
        attributes: dict[str, Any] | None = None,
    ) -> T:
        """Create an object from the specified item and/or attributes."""
        ...

    @classmethod
    @abstractmethod
    def update(
        cls,
        item: T | None = None,
        attributes: dict[str, Any] | None = None,
    ) -> T:
        """Update an object from the specified item and/or attributes."""
        ...

    @classmethod
    @abstractmethod
    def delete(cls, items: list[T]) -> None:
        """Delete the specified items."""
        ...

    @classmethod
    @abstractmethod
    def query(cls, query: Query) -> list[T]:
        """Execute query with base_filter applied."""
        ...

    @classmethod
    @abstractmethod
    def filter_by(cls, **filter_by: Any) -> list[T]:
        """Get all entries that fit the base_filter."""
        ...
