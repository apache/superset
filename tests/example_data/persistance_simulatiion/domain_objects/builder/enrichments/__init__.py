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

from abc import ABC, abstractmethod
from typing import Any, Dict, List, TYPE_CHECKING

from ......common.logger_utils import log
from .....definions.data_definitions.types import TableMetaData
from ....domain_objects import DomainObjectTypeNames

if TYPE_CHECKING:
    from superset.connectors.sqla.models import SqlaTable, SqlMetric, TableColumn
    from superset.models.core import Database

    from .....definions.object_definitions import ExampleDataDefinitionsHolder
    from ....domain_objects import SupersetDomain
    from ...objects_wrapper import DomainObjectsWrapper


class ObjectEnrichment(ABC):
    @abstractmethod
    def enrich(self, objects: List[SupersetDomain]) -> None:
        ...

    @abstractmethod
    def join(
        self, parents: List[SupersetDomain], children: DomainObjectsWrapper
    ) -> None:
        ...


@log
class ExampleDataObjectsEnrichment(ObjectEnrichment, ABC):
    _definitions_holder: ExampleDataDefinitionsHolder

    def __init__(self, definitions_holder: ExampleDataDefinitionsHolder):
        self._definitions_holder = definitions_holder


default_metric = {
    "metric_name": "count",
    "verbose_name": "COUNT(*)",
    "metric_type": "count",
    "expression": "COUNT(*)",
}

NO_NEED_ENRICHMENT: None = None


@log
class ExampleDataSqlTableEnrichment(ExampleDataObjectsEnrichment):
    _example_table_meta_data: TableMetaData
    _related_db: Database

    def __init__(
        self,
        definitions_holder: ExampleDataDefinitionsHolder,
        example_table_meta_data: TableMetaData,
        related_db: Database,
    ):
        super().__init__(definitions_holder)
        self._example_table_meta_data = example_table_meta_data
        self._related_db = related_db

    def enrich(self, tables: List[SupersetDomain]) -> None:
        table: SqlaTable
        for table in tables:
            self._fill_table_fields(table)

    def _fill_table_fields(self, table: SqlaTable) -> None:
        table.table_name = self._example_table_meta_data.table_name
        table.schema = self._example_table_meta_data.schema_name
        table.description = self._example_table_meta_data.description
        table.database = self._related_db

        # config["SQLA_TABLE_MUTATOR"](self)
        pass

    def join(
        self, tables: List[SupersetDomain], children_wrapper: DomainObjectsWrapper
    ) -> None:
        children = children_wrapper.get_parent_objects()
        if children_wrapper.get_wrapped_type() == DomainObjectTypeNames.TABLE_COLUMN:
            self._join_columns(tables, children)
        else:
            self._join_metrics(tables, children)

    def _join_columns(
        self, tables: List[SupersetDomain], columns: List[SupersetDomain]
    ) -> None:
        for table in tables:
            for col in columns:
                table.columns.append(col)
                col.table = table

    def _join_metrics(
        self, tables: List[SupersetDomain], metrics: List[SupersetDomain]
    ) -> None:
        for table in tables:
            for metric in metrics:
                metric.table = table
                table.metrics.append(metric)


@log
class ExampleDataTableColumnsEnrichment(ExampleDataObjectsEnrichment):
    def enrich(self, columns: List[SupersetDomain]) -> None:
        columns_definitions = self._get_columns_definitions()
        assert len(columns) == len(columns_definitions)
        empty_columns = columns.copy()
        for col_def in columns_definitions:
            empty_col = empty_columns.pop()
            self._enrich(empty_col, col_def)

    def _get_columns_definitions(self) -> List[Dict[str, Any]]:
        return (
            self._definitions_holder.get_example_table_columns()
            + self._definitions_holder.get_aggregated_example_columns()
        )

    def _enrich(self, empty_col: TableColumn, col_def: Dict[str, Any]):
        empty_col.column_name = col_def.get("name")
        empty_col.type = col_def.get("type")
        empty_col.is_dttm = col_def.get("is_dttm")
        empty_col.expression = col_def.get("expression")

    def join(
        self, parents: List[SupersetDomain], children: DomainObjectsWrapper
    ) -> None:
        pass


@log
class ExampleDataMetricEnrichment(ExampleDataObjectsEnrichment):
    def enrich(self, metrics: List[SupersetDomain]) -> None:
        metrics_definitions = self._definitions_holder.get_table_metrics()
        assert len(metrics) == len(metrics_definitions)
        empty_metrics = metrics.copy()
        for metric_def in metrics_definitions:
            empty_metric = empty_metrics.pop()
            self._enrich(empty_metric, metric_def)

    def _enrich(self, empty_metric: SupersetDomain, metric_def: Dict[str, Any]):
        _empty_metric: SqlMetric = empty_metric
        _empty_metric.metric_name = metric_def.get("metric_name")
        _empty_metric.verbose_name = metric_def.get("verbose_name")
        _empty_metric.metric_type = metric_def.get("metric_type")
        _empty_metric.expression = metric_def.get("expression")

    def join(
        self, parents: List[SupersetDomain], children: DomainObjectsWrapper
    ) -> None:
        pass
