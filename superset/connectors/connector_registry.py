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
from collections import OrderedDict
from typing import Dict, List, Optional, Set, Type, TYPE_CHECKING

from sqlalchemy import or_
from sqlalchemy.orm import Session, subqueryload

if TYPE_CHECKING:
    # pylint: disable=unused-import
    from superset.models.core import Database
    from superset.connectors.base.models import BaseDatasource


class ConnectorRegistry:
    """ Central Registry for all available datasource engines"""

    sources: Dict[str, Type["BaseDatasource"]] = {}

    @classmethod
    def register_sources(cls, datasource_config: OrderedDict) -> None:
        for module_name, class_names in datasource_config.items():
            class_names = [str(s) for s in class_names]
            module_obj = __import__(module_name, fromlist=class_names)
            for class_name in class_names:
                source_class = getattr(module_obj, class_name)
                cls.sources[source_class.type] = source_class

    @classmethod
    def get_datasource(
        cls, datasource_type: str, datasource_id: int, session: Session
    ) -> "BaseDatasource":
        return (
            session.query(cls.sources[datasource_type])
            .filter_by(id=datasource_id)
            .one()
        )

    @classmethod
    def get_all_datasources(cls, session: Session) -> List["BaseDatasource"]:
        datasources: List["BaseDatasource"] = []
        for source_type in ConnectorRegistry.sources:
            source_class = ConnectorRegistry.sources[source_type]
            qry = session.query(source_class)
            qry = source_class.default_query(qry)
            datasources.extend(qry.all())
        return datasources

    @classmethod
    def get_datasource_by_name(  # pylint: disable=too-many-arguments
        cls,
        session: Session,
        datasource_type: str,
        datasource_name: str,
        schema: str,
        database_name: str,
    ) -> Optional["BaseDatasource"]:
        datasource_class = ConnectorRegistry.sources[datasource_type]
        return datasource_class.get_datasource_by_name(
            session, datasource_name, schema, database_name
        )

    @classmethod
    def query_datasources_by_permissions(  # pylint: disable=invalid-name
        cls,
        session: Session,
        database: "Database",
        permissions: Set[str],
        schema_perms: Set[str],
    ) -> List["BaseDatasource"]:
        # TODO(bogdan): add unit test
        datasource_class = ConnectorRegistry.sources[database.type]
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
    ) -> "BaseDatasource":
        """Returns datasource with columns and metrics."""
        datasource_class = ConnectorRegistry.sources[datasource_type]
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
        database: "Database",
        datasource_name: str,
        schema: Optional[str] = None,
    ) -> List["BaseDatasource"]:
        datasource_class = ConnectorRegistry.sources[database.type]
        return datasource_class.query_datasources_by_name(
            session, database, datasource_name, schema=schema
        )
