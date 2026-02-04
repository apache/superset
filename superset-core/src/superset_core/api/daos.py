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
Data Access Object API for superset-core.

Provides dependency-injected DAO classes that will be replaced by
host implementations during initialization.

Usage:
    from superset_core.api.daos import DatasetDAO, DatabaseDAO

    # Use standard BaseDAO methods
    datasets = DatasetDAO.find_all()
    dataset = DatasetDAO.find_one_or_none(id=123)
    DatasetDAO.create(attributes={"name": "New Dataset"})
"""

from abc import ABC, abstractmethod
from typing import Any, ClassVar, Generic, TypeVar

from flask_appbuilder.models.filters import BaseFilter
from sqlalchemy.orm import Query as SQLAQuery

from superset_core.api.models import (
    Chart,
    CoreModel,
    Dashboard,
    Database,
    Dataset,
    KeyValue,
    Query,
    SavedQuery,
    Tag,
    Task,
    User,
)

# Type variable bound to our CoreModel
T = TypeVar("T", bound=CoreModel)


class BaseDAO(Generic[T], ABC):
    """
    Abstract base class for DAOs.

    This ABC defines the base that all DAOs should implement,
    providing consistent CRUD operations across Superset and extensions.
    """

    # Due to mypy limitations, we can't have `type[T]` here
    model_cls: ClassVar[type[Any] | None]
    base_filter: ClassVar[BaseFilter | None]
    id_column_name: ClassVar[str]
    uuid_column_name: ClassVar[str]

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
    def query(cls, query: SQLAQuery) -> list[T]:
        """Execute query with base_filter applied."""
        ...

    @classmethod
    @abstractmethod
    def filter_by(cls, **filter_by: Any) -> list[T]:
        """Get all entries that fit the base_filter."""
        ...


class DatasetDAO(BaseDAO[Dataset]):
    """
    Abstract Dataset DAO interface.

    Host implementations will replace this class during initialization
    with a concrete implementation providing actual functionality.
    """

    # Class variables that will be set by host implementation
    model_cls = None
    base_filter = None
    id_column_name = "id"
    uuid_column_name = "uuid"


class DatabaseDAO(BaseDAO[Database]):
    """
    Abstract Database DAO interface.

    Host implementations will replace this class during initialization
    with a concrete implementation providing actual functionality.
    """

    # Class variables that will be set by host implementation
    model_cls = None
    base_filter = None
    id_column_name = "id"
    uuid_column_name = "uuid"


class ChartDAO(BaseDAO[Chart]):
    """
    Abstract Chart DAO interface.

    Host implementations will replace this class during initialization
    with a concrete implementation providing actual functionality.
    """

    # Class variables that will be set by host implementation
    model_cls = None
    base_filter = None
    id_column_name = "id"
    uuid_column_name = "uuid"


class DashboardDAO(BaseDAO[Dashboard]):
    """
    Abstract Dashboard DAO interface.

    Host implementations will replace this class during initialization
    with a concrete implementation providing actual functionality.
    """

    # Class variables that will be set by host implementation
    model_cls = None
    base_filter = None
    id_column_name = "id"
    uuid_column_name = "uuid"


class UserDAO(BaseDAO[User]):
    """
    Abstract User DAO interface.

    Host implementations will replace this class during initialization
    with a concrete implementation providing actual functionality.
    """

    # Class variables that will be set by host implementation
    model_cls = None
    base_filter = None
    id_column_name = "id"


class QueryDAO(BaseDAO[Query]):
    """
    Abstract Query DAO interface.

    Host implementations will replace this class during initialization
    with a concrete implementation providing actual functionality.
    """

    # Class variables that will be set by host implementation
    model_cls = None
    base_filter = None
    id_column_name = "id"


class SavedQueryDAO(BaseDAO[SavedQuery]):
    """
    Abstract SavedQuery DAO interface.

    Host implementations will replace this class during initialization
    with a concrete implementation providing actual functionality.
    """

    # Class variables that will be set by host implementation
    model_cls = None
    base_filter = None
    id_column_name = "id"


class TagDAO(BaseDAO[Tag]):
    """
    Abstract Tag DAO interface.

    Host implementations will replace this class during initialization
    with a concrete implementation providing actual functionality.
    """

    # Class variables that will be set by host implementation
    model_cls = None
    base_filter = None
    id_column_name = "id"


class KeyValueDAO(BaseDAO[KeyValue]):
    """
    Abstract KeyValue DAO interface.

    Host implementations will replace this class during initialization
    with a concrete implementation providing actual functionality.
    """

    # Class variables that will be set by host implementation
    model_cls = None
    base_filter = None
    id_column_name = "id"


class TaskDAO(BaseDAO[Task]):
    """
    Abstract Task DAO interface.

    Host implementations will replace this class during initialization
    with a concrete implementation providing actual functionality.
    """

    # Class variables that will be set by host implementation
    model_cls = None
    base_filter = None
    id_column_name = "id"
    uuid_column_name = "uuid"

    @classmethod
    @abstractmethod
    def find_by_task_key(
        cls,
        task_type: str,
        task_key: str,
        scope: str = "private",
        user_id: int | None = None,
    ) -> Task | None:
        """
        Find active task by type, key, scope, and user.

        Uses dedup_key internally for efficient querying with a unique index.
        Only returns tasks that are active (pending or in progress).

        Uniqueness logic by scope:
        - private: scope + task_type + task_key + user_id
        - shared/system: scope + task_type + task_key (user-agnostic)

        :param task_type: Task type to filter by
        :param task_key: Task identifier for deduplication
        :param scope: Task scope (private/shared/system)
        :param user_id: User ID (required for private tasks)
        :returns: Task instance or None if not found or not active
        """
        ...


__all__ = [
    "BaseDAO",
    "DatasetDAO",
    "DatabaseDAO",
    "ChartDAO",
    "DashboardDAO",
    "UserDAO",
    "QueryDAO",
    "SavedQueryDAO",
    "TagDAO",
    "KeyValueDAO",
    "TaskDAO",
]
