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

"""Protocol interfaces for Data Access Objects."""

from abc import ABC, abstractmethod
from typing import Any, Generic, TypeVar, Union

from flask_appbuilder.models.filters import BaseFilter
from sqlalchemy.orm import Query

from superset_core.models.base import CoreModel

# Type variable bound to our CoreModel
T_Model = TypeVar("T_Model", bound=CoreModel)


class BaseDAO(Generic[T_Model], ABC):
    """
    Interface for Data Access Objects.

    This interface defines the base that all DAOs should implement,
    providing consistent CRUD operations across Superset and extensions.

    Extension developers should implement this base class:

    ```python
    from superset_core.dao import BaseDAO
    from superset_core.models import CoreModel

    class MyDAO(BaseDAO[MyCustomModel]):
        model_cls = MyCustomModel

        @classmethod
        def find_by_id(
            cls,
            model_id: str | int,
            skip_base_filter: bool = False,
            id_column: str | None = None,
        ) -> MyCustomModel | None:
            # Implementation here
            pass
    ```
    """

    # Class attributes that implementations should define
    model_cls: type[T_Model] | None
    base_filter: BaseFilter | None
    id_column_name: str
    uuid_column_name: str

    @classmethod
    @abstractmethod
    def find_by_id(
        cls,
        model_id: Union[str, int],
        skip_base_filter: bool = False,
        id_column: str | None = None,
    ) -> T_Model | None:
        """Find a model by ID."""
        ...

    @classmethod
    @abstractmethod
    def find_by_id_or_uuid(
        cls,
        model_id_or_uuid: str,
        skip_base_filter: bool = False,
    ) -> T_Model | None:
        """Find a model by ID or UUID."""
        ...

    @classmethod
    @abstractmethod
    def find_by_ids(
        cls,
        model_ids: Union[list[str], list[int]],
        skip_base_filter: bool = False,
    ) -> list[T_Model]:
        """Find models by list of IDs."""
        ...

    @classmethod
    @abstractmethod
    def find_all(cls) -> list[T_Model]:
        """Get all entities that fit the base_filter."""
        ...

    @classmethod
    @abstractmethod
    def find_one_or_none(cls, **filter_by: Any) -> T_Model | None:
        """Get the first entity that fits the base_filter."""
        ...

    @classmethod
    @abstractmethod
    def create(
        cls,
        item: T_Model | None = None,
        attributes: dict[str, Any] | None = None,
    ) -> T_Model:
        """Create an object from the specified item and/or attributes."""
        ...

    @classmethod
    @abstractmethod
    def update(
        cls,
        item: T_Model | None = None,
        attributes: dict[str, Any] | None = None,
    ) -> T_Model:
        """Update an object from the specified item and/or attributes."""
        ...

    @classmethod
    @abstractmethod
    def delete(cls, items: list[T_Model]) -> None:
        """Delete the specified items."""
        ...

    @classmethod
    @abstractmethod
    def query(cls, query: Query) -> list[T_Model]:
        """Execute query with base_filter applied."""
        ...

    @classmethod
    @abstractmethod
    def filter_by(cls, **filter_by: Any) -> list[T_Model]:
        """Get all entries that fit the base_filter."""
        ...
