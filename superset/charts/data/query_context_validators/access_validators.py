#  Licensed to the Apache Software Foundation (ASF) under one
#  or more contributor license agreements.  See the NOTICE file
#  distributed with this work for additional information
#  regarding copyright ownership.  The ASF licenses this file
#  to you under the Apache License, Version 2.0 (the
#  "License"); you may not use this file except in compliance
#  with the License.  You may obtain a copy of the License at
#
#  http://www.apache.org/licenses/LICENSE-2.0
#
#  Unless required by applicable law or agreed to in writing,
#  software distributed under the License is distributed on an
#  "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
#  KIND, either express or implied.  See the License for the
#  specific language governing permissions and limitations
#  under the License.
from __future__ import annotations

from abc import ABC
from typing import List, Optional, Set, TYPE_CHECKING

from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import SupersetSecurityException
from superset.sql_parse import ParsedQuery, Table

from . import QueryContextValidator

if TYPE_CHECKING:
    from superset import SupersetSecurityManager
    from superset.common.query_context import QueryContext
    from superset.common.query_object import QueryObject
    from superset.connectors.base.models import BaseDatasource
    from superset.connectors.sqla.models import SqlaTable
    from superset.datasets.dao import DatasetDAO
    from superset.models.core import Database
    from superset.superset_typing import Metric


# pylint: disable=too-few-public-methods
class QueryContextAccessValidator(QueryContextValidator, ABC):
    _security_manager: SupersetSecurityManager

    def __init__(self, security_manager: SupersetSecurityManager):
        self._security_manager = security_manager


# pylint: disable=too-few-public-methods
class SecurityManagerWrapper(QueryContextAccessValidator):
    def validate(self, query_context: QueryContext) -> None:
        self._security_manager.raise_for_access(query_context=query_context)


# pylint: disable=too-few-public-methods
class SqlDatabaseBasedAccessValidator(QueryContextAccessValidator):
    _dataset_dao: DatasetDAO

    def __init__(
        self, security_manager: SupersetSecurityManager, dataset_dao: DatasetDAO
    ):
        super().__init__(security_manager)
        self._dataset_dao = dataset_dao

    def validate(self, query_context: QueryContext) -> None:
        sql_database = query_context.get_database()
        if not self._actor_can_access_all_database_data(sql_database):  # type: ignore
            self._validate_actor_can_access_datasources_context(
                query_context, sql_database  # type: ignore
            )

    # pylint: disable=invalid-name
    def _actor_can_access_all_database_data(self, sql_database: Database) -> bool:
        return (
            self._security_manager.can_access_all_databases()
            or self._security_manager.can_access_all_datasources()
            or self._security_manager.can_access_database(sql_database)
        )

    # pylint: disable=invalid-name
    def _validate_actor_can_access_datasources_context(
        self, query_context: QueryContext, sql_database: Database
    ) -> None:
        datasources = self._get_all_related_datasources(query_context, sql_database)
        for datasource in datasources:
            self._security_manager.raise_for_datasource_access(datasource)

    def _get_all_related_datasources(
        self, query_context: QueryContext, sql_database: Database
    ) -> Set[BaseDatasource]:

        datasources: Set[BaseDatasource] = set()
        datasources.add(query_context.datasource)
        datasources.update(
            self._collect_datasources_from_queries(query_context.queries, sql_database)
        )
        return datasources

    # pylint: disable=invalid-name
    def _collect_datasources_from_queries(
        self, queries: List[QueryObject], sql_db: Database
    ) -> Set[BaseDatasource]:
        datasources: Set[BaseDatasource] = set()
        for query in queries:
            datasources.update(self._collect_datasources_from_query(query, sql_db))
        return datasources

    def _collect_datasources_from_query(
        self, query: QueryObject, database: Database
    ) -> Set[BaseDatasource]:

        datasources: Set[BaseDatasource] = set()
        datasource = query.get_datasource()
        if datasource is not None:
            datasources.add(query.datasource)  # type: ignore
        if query.metrics:
            datasources.update(
                self._collect_datasources_from_metrics(query.metrics, database)
            )
        return datasources

    # pylint: disable=invalid-name
    def _collect_datasources_from_metrics(
        self, metrics: List[Metric], database: Database
    ) -> Set[BaseDatasource]:
        datasources: Set[BaseDatasource] = set()
        for metric in metrics:
            datasources.update(self._find_datasources_in_metric(metric, database))
        return datasources

    def _find_datasources_in_metric(
        self, metric: Metric, database: Database
    ) -> Set[BaseDatasource]:
        sql_expression = self._get_sql_expression_from_metric(metric)
        if sql_expression:
            return self._determine_datasources(sql_expression, database)
        return set()

    # pylint: disable=invalid-name
    @staticmethod
    def _get_sql_expression_from_metric(metric: Metric) -> Optional[str]:
        if isinstance(metric, dict) and "sqlExpression" in metric:
            return metric["sqlExpression"]
        return None

    def _determine_datasources(
        self, sqlExpression: str, database: Database
    ) -> Set[BaseDatasource]:
        datasources = set()
        for table in ParsedQuery(sqlExpression).tables:
            datasources.update(self._get_datasources_from_table(database, table))
        return datasources

    def _get_datasources_from_table(
        self, database: Database, table: Table
    ) -> List[SqlaTable]:
        table_datasources = self._dataset_dao.get_by_sql_database_components(
            database, table.table, table.schema
        )
        if len(table_datasources) == 0:
            raise SupersetSecurityException(
                SupersetError(
                    "datasources not "
                    "found, thus the "
                    "table is internal db "
                    "table ",
                    SupersetErrorType.DATASOURCE_SECURITY_ACCESS_ERROR,
                    ErrorLevel.ERROR,
                )
            )
        return table_datasources
