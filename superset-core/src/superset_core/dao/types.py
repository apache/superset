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
from typing import Any, Generic, Optional, TypeVar, Union

from flask_appbuilder.models.filters import BaseFilter
from flask_sqlalchemy import BaseQuery

from superset_core.models.base import CoreModel

# Type variable bound to our CoreModel
T_Model = TypeVar("T_Model", bound=CoreModel)


class BaseDAO(Generic[T_Model], ABC):
    """
    Interface for Data Access Objects.

    This interface defines the base that all DAOs should implement,
    providing consistent CRUD operations across Superset and extensions.

    Extension developers should implement this protocol:

    ```python
    from superset_core.dao import BaseDAO
    from superset_core.models import CoreModel

    class MyDAO(BaseDAO[MyCustomModel]):
        model_cls = MyCustomModel

        @classmethod
        def find_by_id(cls, model_id: str | int) -> MyCustomModel | None:
            # Implementation here
            pass
    ```
    """

    # Class attributes that implementations should define
    model_cls: Optional[type[T_Model]]
    base_filter: Optional[BaseFilter]
    id_column_name: str
    uuid_column_name: str

    @abstractmethod
    def find_by_id(
        self, model_id: Union[str, int], skip_base_filter: bool = False
    ) -> Optional[T_Model]:
        """Find a model by ID."""
        ...

    @abstractmethod
    def find_by_id_or_uuid(
        self,
        model_id_or_uuid: str,
        skip_base_filter: bool = False,
    ) -> Optional[T_Model]:
        """Find a model by ID or UUID."""
        ...

    @abstractmethod
    def find_by_ids(
        self,
        model_ids: Union[list[str], list[int]],
        skip_base_filter: bool = False,
    ) -> list[T_Model]:
        """Find models by list of IDs."""
        ...

    @abstractmethod
    def find_all(self) -> list[T_Model]:
        """Get all entities that fit the base_filter."""
        ...

    @abstractmethod
    def find_one_or_none(self, **filter_by: Any) -> Optional[T_Model]:
        """Get the first entity that fits the base_filter."""
        ...

    @abstractmethod
    def create(
        self,
        item: Optional[T_Model] = None,
        attributes: Optional[dict[str, Any]] = None,
    ) -> T_Model:
        """Create an object from the specified item and/or attributes."""
        ...

    @abstractmethod
    def update(
        self,
        item: Optional[T_Model] = None,
        attributes: Optional[dict[str, Any]] = None,
    ) -> T_Model:
        """Update an object from the specified item and/or attributes."""
        ...

    @abstractmethod
    def delete(self, items: list[T_Model]) -> None:
        """Delete the specified items."""
        ...

    @abstractmethod
    def query(self, query: BaseQuery) -> list[T_Model]:
        """Execute query with base_filter applied."""
        ...

    @abstractmethod
    def filter_by(self, **filter_by: Any) -> list[T_Model]:
        """Get all entries that fit the base_filter."""
        ...
