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

from abc import ABC, abstractmethod
from typing import Any, Type

from sqlalchemy.orm import scoped_session
from sqlalchemy.orm.query import Query

from superset_core.models.base import Database, Dataset


class CoreModelsApi(ABC):
    """
    Abstract interface for accessing Superset data models.

    This class defines the contract for retrieving SQLAlchemy sessions
    and model instances for datasets and databases within Superset.
    """

    @staticmethod
    @abstractmethod
    def get_session() -> scoped_session:
        """
        Retrieve the SQLAlchemy session to directly interface with the
        Superset models.

        :returns: The SQLAlchemy scoped session instance.
        """
        ...

    @staticmethod
    @abstractmethod
    def get_dataset_model() -> Type[Dataset]:
        """
        Retrieve the Dataset (SqlaTable) type implementation. At a minimum, this
        class implements the contract defined in the core Dataset model.

        :returns: The Dataset type implementation.
        """
        ...

    @staticmethod
    @abstractmethod
    def get_database_model() -> Type[Database]:
        """
        Retrieve the Database type implementation. At a minimum, this
        class implements the contract defined in the core Database model.

        :returns: The Database type implementation.
        """
        ...

    @staticmethod
    @abstractmethod
    def get_datasets(query: Query | None = None, **kwargs: Any) -> list[Dataset]:
        """
        Retrieve Dataset implementations.

        :param query: A query with the Dataset model as the primary entity for complex
            queries.
        :param kwargs: Optional keyword arguments to filter datasets using SQLAlchemy's
            `filter_by()`.
        :returns: Dataset implementations.
        """
        ...

    @staticmethod
    @abstractmethod
    def get_databases(query: Query | None = None, **kwargs: Any) -> list[Database]:
        """
        Retrieve Database implementations.

        :param query: A query with the Database model as the primary entity for complex
            queries.
        :param kwargs: Optional keyword arguments to filter databases using SQLAlchemy's
            `filter_by()`.
        :returns: Database implementations.
        """
        ...
