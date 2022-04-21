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

from typing import Dict, List, Optional, Set, Type, TYPE_CHECKING
from sqlalchemy import or_

from sqlalchemy.orm.exc import NoResultFound

from superset import db
from superset.dao.base import BaseDAO
from sqlalchemy.orm import Session, subqueryload
from superset.connectors.base.models import BaseDatasource
from superset.connectors.sqla.models import SqlaTable, Table, Query
from superset.datasets.commands.exceptions import DatasetNotFoundError
from superset.models.sql_lab import SavedQuery
from superset.datasets.models import Dataset

if TYPE_CHECKING:
    from superset.models.core import Database


class DatasourceDAO(BaseDAO):
    sources = {
        "SqlaTable": SqlaTable,
        "dataset": Dataset,
	    "table": Table,
		"query": Query, # query history log
	    "saved_query": SavedQuery
    } 

	# ds_map = { # reference DEFAULT_MODULE_DS_MAP
	#  dataset: <Dataset>
	#  table: <Table>
	#	query: <Query> # query history log
	#  saved_query: <SavedQuery>
	# }
	
	def get_datasource( cls, datasource_type: str, datasource_id: int
    ) -> "BaseDatasource":
        if datasource_type not in cls.sources:
            raise DatasetNotFoundError()

        datasource = (
           db.session.query(cls.sources[datasource_type])
            .filter_by(id=datasource_id)
            .one_or_none()
        )

        if not datasource:
            raise DatasetNotFoundError()

        return datasource

    def get_all_datasources(cls, session: Session) -> List["BaseDatasource"]:
        datasources: List["BaseDatasource"] = []
        for source_class in DatasourceDAO.sources.values():
            qry = session.query(source_class)
            qry = source_class.default_query(qry)
            datasources.extend(qry.all())
        return datasources

    def get_datasource_by_id(
            cls, session: Session, datasource_id: int
        ) -> "BaseDatasource":
            """
            Find a datasource instance based on the unique id.

            :param session: Session to use
            :param datasource_id: unique id of datasource
            :return: Datasource corresponding to the id
            :raises NoResultFound: if no datasource is found corresponding to the id
            """
            for datasource_class in DatasourceDAO.sources.values():
                try:
                    return (
                        session.query(datasource_class)
                        .filter(datasource_class.id == datasource_id)
                        .one()
                    )
                except NoResultFound:
                    # proceed to next datasource type
                    pass
            raise NoResultFound(_("Datasource id not found: %(id)s", id=datasource_id))

    def get_datasource_by_name(  # pylint: disable=too-many-arguments
        cls,
        session: Session,
        datasource_type: str,
        datasource_name: str,
        schema: str,
        database_name: str,
    ) -> Optional["BaseDatasource"]:
        datasource_class = DatasourceDAO.sources[datasource_type]
        return datasource_class.get_datasource_by_name(
            session, datasource_name, schema, database_name
        )

    def query_datasources_by_permissions(  # pylint: disable=invalid-name
        cls,
        session: Session,
        database: "Database",
        permissions: Set[str],
        schema_perms: Set[str],
    ) -> List["BaseDatasource"]:
        # TODO(bogdan): add unit test
        datasource_class = DatasourceDAO.sources[database.type]
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

    def get_eager_datasource(
        cls, session: Session, datasource_type: str, datasource_id: int
    ) -> "BaseDatasource":
        """Returns datasource with columns and metrics."""
        datasource_class = DatasourceDAO.sources[datasource_type]
        return (
            session.query(datasource_class)
            .options(
                subqueryload(datasource_class.columns),
                subqueryload(datasource_class.metrics),
            )
            .filter_by(id=datasource_id)
            .one()
        )

    def query_datasources_by_name(
        cls,
        session: Session,
        database: "Database",
        datasource_name: str,
        schema: Optional[str] = None,
    ) -> List["BaseDatasource"]:
        datasource_class = DatasourceDAO.sources[database.type]
        return datasource_class.query_datasources_by_name(
            session, database, datasource_name, schema=schema
        )