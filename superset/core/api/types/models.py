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

from typing import Any, Type

from sqlalchemy.orm import scoped_session
from sqlalchemy.orm.query import Query
from superset_core.api.types.models import CoreModelsApi
from superset_core.models.base import Database, Dataset


class HostModelsApi(CoreModelsApi):
    @staticmethod
    def get_session() -> scoped_session:
        from superset import db

        return db.session

    @staticmethod
    def get_dataset_model() -> Type[Dataset]:
        """
        Retrieve the Dataset (SqlaTable) type implementation.
        """
        from superset.connectors.sqla.models import SqlaTable

        return SqlaTable

    @staticmethod
    def get_database_model() -> Type[Database]:
        """
        Retrieve the Database type implementation.
        """
        from superset.models.core import Database

        return Database

    @staticmethod
    def get_datasets(query: Query | None = None, **kwargs: Any) -> list[Dataset]:
        """
        Retrieve Dataset protocol implementations.

        :param query: A query with the Dataset model as the primary entity.
        :returns: Dataset protocol implementations.
        """
        from superset.daos.dataset import DatasetDAO

        if query:
            return DatasetDAO.query(query)

        return DatasetDAO.filter_by(**kwargs)

    @staticmethod
    def get_databases(query: Query | None = None, **kwargs: Any) -> list[Database]:
        """
        Retrieve Database protocol implementations.

        :param query: A query with the Database model as the primary entity.
        :returns: Database protocol implementations.
        """
        from superset.daos.database import DatabaseDAO

        if query:
            return DatabaseDAO.query(query)

        return DatabaseDAO.filter_by(**kwargs)
