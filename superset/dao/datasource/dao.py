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

from enum import Enum
from typing import Any, Dict, List, Optional, Set, Type, Union

from flask_babel import _
from sqlalchemy import or_
from sqlalchemy.orm import Session, subqueryload
from sqlalchemy.orm.exc import NoResultFound

from superset.connectors.sqla.models import SqlaTable
from superset.dao.base import BaseDAO
from superset.dao.exceptions import DatasourceNotFound, DatasourceTypeNotSupportedError
from superset.datasets.commands.exceptions import DatasetNotFoundError
from superset.datasets.models import Dataset
from superset.models.core import Database
from superset.models.sql_lab import Query, SavedQuery
from superset.tables.models import Table
from superset.utils.core import DatasourceType

Datasource = Union[Dataset, SqlaTable, Table, Query, SavedQuery]


class DatasourceDAO(BaseDAO):

    sources: Dict[DatasourceType, Type[Datasource]] = {
        DatasourceType.TABLE: SqlaTable,
        DatasourceType.QUERY: Query,
        DatasourceType.SAVEDQUERY: SavedQuery,
        DatasourceType.DATASET: Dataset,
        DatasourceType.SLTABLE: Table,
    }

    @classmethod
    def get_datasource(
        cls, session: Session, datasource_type: DatasourceType, datasource_id: int
    ) -> Datasource:
        if datasource_type not in cls.sources:
            raise DatasourceTypeNotSupportedError()

        datasource = (
            session.query(cls.sources[datasource_type])
            .filter_by(id=datasource_id)
            .one_or_none()
        )

        if not datasource:
            raise DatasourceNotFound()

        return datasource

    @classmethod
    def get_all_sqlatables_datasources(cls, session: Session) -> List[Datasource]:
        source_class = DatasourceDAO.sources[DatasourceType.TABLE]
        qry = session.query(source_class)
        qry = source_class.default_query(qry)
        return qry.all()

    @classmethod
    def get_datasource_by_name(  # pylint: disable=too-many-arguments
        cls,
        session: Session,
        datasource_type: DatasourceType,
        datasource_name: str,
        database_name: str,
        schema: str,
    ) -> Optional[Datasource]:
        datasource_class = DatasourceDAO.sources[datasource_type]
        if isinstance(datasource_class, SqlaTable):
            return datasource_class.get_datasource_by_name(
                session, datasource_name, schema, database_name
            )
        return None

    @classmethod
    def query_datasources_by_permissions(  # pylint: disable=invalid-name
        cls,
        session: Session,
        database: Database,
        permissions: Set[str],
        schema_perms: Set[str],
    ) -> List[Datasource]:
        # TODO(hughhhh): add unit test
        datasource_class = DatasourceDAO.sources[DatasourceType[database.type]]
        if not isinstance(datasource_class, SqlaTable):
            return []

        return (
            session.query(datasource_class)
            .filter_by(database_id=database.id)
            .filter(
                or_(
                    datasource_class.perm.in_(permissions),
                    datasource_class.schema_perm.in_(schema_perms),
                )
            )
            .all()
        )

    @classmethod
    def get_eager_datasource(
        cls, session: Session, datasource_type: str, datasource_id: int
    ) -> Optional[Datasource]:
        """Returns datasource with columns and metrics."""
        datasource_class = DatasourceDAO.sources[DatasourceType[datasource_type]]
        if not isinstance(datasource_class, SqlaTable):
            return None
        return (
            session.query(datasource_class)
            .options(
                subqueryload(datasource_class.columns),
                subqueryload(datasource_class.metrics),
            )
            .filter_by(id=datasource_id)
            .one()
        )

    @classmethod
    def query_datasources_by_name(
        cls,
        session: Session,
        database: Database,
        datasource_name: str,
        schema: Optional[str] = None,
    ) -> List[Datasource]:
        datasource_class = DatasourceDAO.sources[DatasourceType[database.type]]
        if not isinstance(datasource_class, SqlaTable):
            return []

        return datasource_class.query_datasources_by_name(
            session, database, datasource_name, schema=schema
        )
