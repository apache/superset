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
from __future__ import annotations

import logging
from datetime import datetime
from typing import Any, Dict, List

import dateutil.parser
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Query

from superset.connectors.sqla.models import (
    RLSFilterTables,
    SqlaTable,
    SqlMetric,
    TableColumn,
)
from superset.daos.base import BaseDAO, ColumnOperator, ColumnOperatorEnum
from superset.extensions import db
from superset.models.core import Database
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice
from superset.sql.parse import SQLScript, Table
from superset.utils.core import DatasourceType
from superset.views.base import DatasourceFilter

logger = logging.getLogger(__name__)

# Custom filterable fields for datasets (not direct model columns)
DATASET_CUSTOM_FIELDS: dict[str, list[str]] = {
    "database_name": ["eq", "like", "ilike"],
    "owner": ["eq", "in"],
}


class DatasetDAO(BaseDAO[SqlaTable]):
    """
    DAO for datasets. Supports filtering on model fields, hybrid properties, and custom
    fields:
    - tags: list of tags (eq, in_, like)
    - owner: user id (eq, in_)
    """

    base_filter = DatasourceFilter

    @classmethod
    def apply_column_operators(
        cls,
        query: Query,
        column_operators: list[ColumnOperator] | None = None,
    ) -> Query:
        """Override to handle database_name filter via subquery on Database.

        database_name lives on Database, not SqlaTable, so we intercept it
        here and use a subquery to avoid duplicate joins with DatasourceFilter.
        """
        if not column_operators:
            return query

        remaining_operators: list[ColumnOperator] = []
        for c in column_operators:
            if not isinstance(c, ColumnOperator):
                c = ColumnOperator.model_validate(c)
            if c.col == "database_name":
                operator_enum = ColumnOperatorEnum(c.opr)
                subq = select(Database.id).where(
                    operator_enum.apply(Database.database_name, c.value)
                )
                query = query.filter(SqlaTable.database_id.in_(subq))
            elif c.col == "owner":
                from superset.connectors.sqla.models import sqlatable_user

                operator_enum = ColumnOperatorEnum(c.opr)
                subq = select(sqlatable_user.c.table_id).where(
                    operator_enum.apply(sqlatable_user.c.user_id, c.value)
                )
                query = query.filter(
                    SqlaTable.id.in_(subq)  # type: ignore[attr-defined,unused-ignore]
                )
            else:
                remaining_operators.append(c)

        if remaining_operators:
            query = super().apply_column_operators(query, remaining_operators)
        return query

    @staticmethod
    def get_database_by_id(database_id: int) -> Database | None:
        try:
            return db.session.query(Database).filter_by(id=database_id).one_or_none()
        except SQLAlchemyError as ex:  # pragma: no cover
            logger.error("Could not get database by id: %s", str(ex), exc_info=True)
            return None

    @staticmethod
    def get_related_objects(database_id: int) -> dict[str, Any]:
        charts = (
            db.session.query(Slice)
            .filter(
                Slice.datasource_id == database_id,
                Slice.datasource_type == DatasourceType.TABLE,
            )
            .all()
        )
        chart_ids = [chart.id for chart in charts]

        dashboards = (
            (
                db.session.query(Dashboard)
                .join(Dashboard.slices)
                .filter(Slice.id.in_(chart_ids))
            )
            .distinct()
            .all()
        )
        return {"charts": charts, "dashboards": dashboards}

    @staticmethod
    def validate_table_exists(
        database: Database,
        table: Table,
    ) -> bool:
        try:
            database.get_table(table)
            return True
        except SQLAlchemyError as ex:  # pragma: no cover
            logger.warning("Got an error %s validating table: %s", str(ex), table)
            return False

    @staticmethod
    def validate_uniqueness(
        database: Database,
        table: Table,
        dataset_id: int | None = None,
    ) -> bool:
        # The catalog might not be set even if the database supports catalogs, in case
        # multi-catalog is disabled.
        catalog = table.catalog or database.get_default_catalog()

        dataset_query = db.session.query(SqlaTable).filter(
            SqlaTable.table_name == table.table,
            SqlaTable.schema == table.schema,
            SqlaTable.catalog == catalog,
            SqlaTable.database_id == database.id,
        )

        if dataset_id:
            # make sure the dataset found is different from the target (if any)
            dataset_query = dataset_query.filter(SqlaTable.id != dataset_id)

        return not db.session.query(dataset_query.exists()).scalar()

    @staticmethod
    def validate_update_uniqueness(
        database: Database,
        table: Table,
        dataset_id: int,
    ) -> bool:
        # The catalog might not be set even if the database supports catalogs, in case
        # multi-catalog is disabled.
        catalog = table.catalog or database.get_default_catalog()

        dataset_query = db.session.query(SqlaTable).filter(
            SqlaTable.table_name == table.table,
            SqlaTable.database_id == database.id,
            SqlaTable.schema == table.schema,
            SqlaTable.catalog == catalog,
            SqlaTable.id != dataset_id,
        )
        return not db.session.query(dataset_query.exists()).scalar()

    @staticmethod
    def validate_columns_exist(dataset_id: int, columns_ids: list[int]) -> bool:
        dataset_query = (
            db.session.query(TableColumn.id).filter(
                TableColumn.table_id == dataset_id, TableColumn.id.in_(columns_ids)
            )
        ).all()
        return len(columns_ids) == len(dataset_query)

    @staticmethod
    def validate_columns_uniqueness(dataset_id: int, columns_names: list[str]) -> bool:
        dataset_query = (
            db.session.query(TableColumn.id).filter(
                TableColumn.table_id == dataset_id,
                TableColumn.column_name.in_(columns_names),
            )
        ).all()
        return len(dataset_query) == 0

    @staticmethod
    def validate_metrics_exist(dataset_id: int, metrics_ids: list[int]) -> bool:
        dataset_query = (
            db.session.query(SqlMetric.id).filter(
                SqlMetric.table_id == dataset_id, SqlMetric.id.in_(metrics_ids)
            )
        ).all()
        return len(metrics_ids) == len(dataset_query)

    @staticmethod
    def validate_metrics_uniqueness(dataset_id: int, metrics_names: list[str]) -> bool:
        dataset_query = (
            db.session.query(SqlMetric.id).filter(
                SqlMetric.table_id == dataset_id,
                SqlMetric.metric_name.in_(metrics_names),
            )
        ).all()
        return len(dataset_query) == 0

    @staticmethod
    def validate_python_date_format(dt_format: str) -> bool:
        if dt_format in ("epoch_s", "epoch_ms"):
            return True
        try:
            dt_str = datetime.now().strftime(dt_format)
            dateutil.parser.isoparse(dt_str)
            return True
        except ValueError:
            return False

    @classmethod
    def update(
        cls,
        item: SqlaTable | None = None,
        attributes: dict[str, Any] | None = None,
    ) -> SqlaTable:
        """
        Updates a Dataset model on the metadata DB
        """

        if item and attributes:
            force_update: bool = False
            if "columns" in attributes:
                cls.update_columns(
                    item,
                    attributes.pop("columns"),
                    override_columns=bool(attributes.get("override_columns")),
                )
                force_update = True

            if "metrics" in attributes:
                cls.update_metrics(item, attributes.pop("metrics"))
                force_update = True

            if force_update:
                attributes["changed_on"] = datetime.now()

        return super().update(item, attributes)

    @classmethod
    def update_columns(
        cls,
        model: SqlaTable,
        property_columns: list[dict[str, Any]],
        override_columns: bool = False,
    ) -> None:
        """
        Creates/updates and/or deletes a list of columns, based on a
        list of Dict.

        - If a column Dict has an `id` property then we update.
        - If a column Dict does not have an `id` then we create a new metric.
        - If there are extra columns on the metadata db that are not defined on the List
        then we delete.
        """

        for column in property_columns:
            if (
                "python_date_format" in column
                and column["python_date_format"] is not None
            ):
                if not DatasetDAO.validate_python_date_format(
                    column["python_date_format"]
                ):
                    raise ValueError(
                        "python_date_format is an invalid date/timestamp format."
                    )

        if override_columns:
            db.session.query(TableColumn).filter(
                TableColumn.table_id == model.id
            ).delete(synchronize_session="fetch")

            db.session.bulk_insert_mappings(
                TableColumn,
                [
                    {**properties, "table_id": model.id}
                    for properties in property_columns
                ],
            )
        else:
            columns_by_id = {column.id: column for column in model.columns}

            property_columns_by_id = {
                properties["id"]: properties
                for properties in property_columns
                if "id" in properties
            }

            db.session.bulk_insert_mappings(
                TableColumn,
                [
                    {**properties, "table_id": model.id}
                    for properties in property_columns
                    if "id" not in properties
                ],
            )

            db.session.bulk_update_mappings(
                TableColumn,
                [
                    {**columns_by_id[properties["id"]].__dict__, **properties}
                    for properties in property_columns_by_id.values()
                ],
            )

            db.session.query(TableColumn).filter(
                TableColumn.id.in_(
                    {column.id for column in model.columns}
                    - property_columns_by_id.keys()
                )
            ).delete(synchronize_session="fetch")

    @classmethod
    def update_metrics(
        cls,
        model: SqlaTable,
        property_metrics: list[dict[str, Any]],
    ) -> None:
        """
        Creates/updates and/or deletes a list of metrics, based on a
        list of Dict.

        - If a metric Dict has an `id` property then we update.
        - If a metric Dict does not have an `id` then we create a new metric.
        - If there are extra metrics on the metadata db that are not defined on the List
        then we delete.
        """

        metrics_by_id = {metric.id: metric for metric in model.metrics}

        property_metrics_by_id = {
            properties["id"]: properties
            for properties in property_metrics
            if "id" in properties
        }

        db.session.bulk_insert_mappings(
            SqlMetric,
            [
                {**properties, "table_id": model.id}
                for properties in property_metrics
                if "id" not in properties
            ],
        )

        db.session.bulk_update_mappings(
            SqlMetric,
            [
                {**metrics_by_id[properties["id"]].__dict__, **properties}
                for properties in property_metrics_by_id.values()
            ],
        )

        db.session.query(SqlMetric).filter(
            SqlMetric.id.in_(
                {metric.id for metric in model.metrics} - property_metrics_by_id.keys()
            )
        ).delete(synchronize_session="fetch")

    @classmethod
    def find_dataset_column(cls, dataset_id: int, column_id: int) -> TableColumn | None:
        # We want to apply base dataset filters
        dataset = DatasetDAO.find_by_id(dataset_id)
        if not dataset:
            return None
        return (
            db.session.query(TableColumn)
            .filter(TableColumn.table_id == dataset_id, TableColumn.id == column_id)
            .one_or_none()
        )

    @classmethod
    def find_dataset_metric(cls, dataset_id: int, metric_id: int) -> SqlMetric | None:
        # We want to apply base dataset filters
        dataset = DatasetDAO.find_by_id(dataset_id)
        if not dataset:
            return None
        return db.session.query(SqlMetric).get(metric_id)

    @staticmethod
    def get_table_by_name(database_id: int, table_name: str) -> SqlaTable | None:
        return (
            db.session.query(SqlaTable)
            .filter_by(database_id=database_id, table_name=table_name)
            .one_or_none()
        )

    @classmethod
    def get_filterable_columns_and_operators(cls) -> Dict[str, List[str]]:
        filterable = super().get_filterable_columns_and_operators()
        # Add custom fields
        filterable.update(DATASET_CUSTOM_FIELDS)
        return filterable

    @staticmethod
    def get_rls_filters_for_datasets(
        dataset_ids: list[int],
    ) -> dict[int, list[dict[str, Any]]]:
        """
        Return a mapping of dataset_id -> list of RLS filter summaries
        for the given dataset IDs. Only returns datasets that have at least
        one RLS filter attached. For virtual datasets, also includes RLS
        filters from physical tables referenced in the dataset's SQL.
        """
        from superset.connectors.sqla.models import RowLevelSecurityFilter

        if not dataset_ids:
            return {}

        # Get direct RLS filters for all requested datasets
        rows = (
            db.session.query(
                RLSFilterTables.c.table_id,
                RowLevelSecurityFilter.id,
                RowLevelSecurityFilter.name,
                RowLevelSecurityFilter.filter_type,
                RowLevelSecurityFilter.group_key,
            )
            .join(
                RowLevelSecurityFilter,
                RLSFilterTables.c.rls_filter_id == RowLevelSecurityFilter.id,
            )
            .filter(RLSFilterTables.c.table_id.in_(dataset_ids))
            .all()
        )

        result: dict[int, list[dict[str, Any]]] = {}
        for table_id, rls_id, name, filter_type, group_key in rows:
            result.setdefault(table_id, []).append(
                {
                    "id": rls_id,
                    "name": name,
                    "filter_type": filter_type,
                    "group_key": group_key,
                }
            )

        # For virtual datasets, also check underlying physical tables
        virtual_datasets = (
            db.session.query(
                SqlaTable.id, SqlaTable.sql, SqlaTable.schema, SqlaTable.database_id
            )
            .filter(SqlaTable.id.in_(dataset_ids), SqlaTable.sql.isnot(None))  # type: ignore[attr-defined,unused-ignore]
            .all()
        )

        if virtual_datasets:
            inherited = DatasetDAO._get_inherited_rls_for_virtual_datasets(
                virtual_datasets
            )
            for ds_id, filters in inherited.items():
                existing_ids = {f["id"] for f in result.get(ds_id, [])}
                for f in filters:
                    if f["id"] not in existing_ids:
                        existing_ids.add(f["id"])
                        result.setdefault(ds_id, []).append(f)

        return result

    @staticmethod
    def _parse_tables_from_virtual_datasets(
        virtual_datasets: list[tuple[int, str, str | None, int]],
        db_engines: dict[int, str] | None = None,
    ) -> tuple[dict[int, set[str]], dict[int, int]]:
        """
        Parse SQL from virtual datasets and return:
        - ds_to_tables: mapping of dataset_id -> set of referenced table names
        - ds_db_map: mapping of dataset_id -> database_id
        """
        if db_engines is None:
            db_engines = {}
        ds_to_tables: dict[int, set[str]] = {}
        ds_db_map: dict[int, int] = {}
        for ds_id, sql, _schema, database_id in virtual_datasets:
            ds_db_map[ds_id] = database_id
            engine = db_engines.get(database_id, "")
            try:
                parsed = SQLScript(sql, engine=engine)
                table_names: set[str] = set()
                for statement in parsed.statements:
                    for table_ref in statement.tables:
                        table_names.add(table_ref.table)
                if table_names:
                    ds_to_tables[ds_id] = table_names
            except Exception:  # noqa: BLE001
                logger.debug("Failed to parse SQL for virtual dataset %d", ds_id)
        return ds_to_tables, ds_db_map

    @staticmethod
    def _fetch_physical_rls_map(
        all_table_names: set[str],
        db_ids: set[int],
    ) -> tuple[dict[tuple[str, int], int], dict[int, list[dict[str, Any]]]]:
        """
        Look up physical datasets matching the given table names and database IDs,
        then fetch their RLS filters.

        Returns:
        - physical_map: (table_name, database_id) -> physical dataset id
        - phys_rls: physical dataset id -> list of RLS filter summaries
        """
        from superset.connectors.sqla.models import RowLevelSecurityFilter

        physical_tables = (
            db.session.query(SqlaTable.id, SqlaTable.table_name, SqlaTable.database_id)
            .filter(
                SqlaTable.table_name.in_(all_table_names),
                SqlaTable.database_id.in_(db_ids),
                SqlaTable.sql.is_(None),
            )
            .all()
        )

        physical_map: dict[tuple[str, int], int] = {}
        physical_ids: set[int] = set()
        for phys_id, table_name, db_id in physical_tables:
            physical_map[(table_name, db_id)] = phys_id
            physical_ids.add(phys_id)

        if not physical_ids:
            return physical_map, {}

        rls_rows = (
            db.session.query(
                RLSFilterTables.c.table_id,
                RowLevelSecurityFilter.id,
                RowLevelSecurityFilter.name,
                RowLevelSecurityFilter.filter_type,
                RowLevelSecurityFilter.group_key,
            )
            .join(
                RowLevelSecurityFilter,
                RLSFilterTables.c.rls_filter_id == RowLevelSecurityFilter.id,
            )
            .filter(RLSFilterTables.c.table_id.in_(physical_ids))
            .all()
        )

        phys_rls: dict[int, list[dict[str, Any]]] = {}
        for table_id, rls_id, name, filter_type, group_key in rls_rows:
            phys_rls.setdefault(table_id, []).append(
                {
                    "id": rls_id,
                    "name": name,
                    "filter_type": filter_type,
                    "group_key": group_key,
                }
            )
        return physical_map, phys_rls

    @staticmethod
    def _get_inherited_rls_for_virtual_datasets(
        virtual_datasets: list[tuple[int, str, str | None, int]],
    ) -> dict[int, list[dict[str, Any]]]:
        """
        For virtual datasets, parse their SQL to find referenced physical
        tables and return any RLS filters attached to those tables.

        Each tuple is (dataset_id, sql, schema, database_id).
        """
        # Batch-fetch database engines for accurate SQL parsing
        unique_db_ids = {row[3] for row in virtual_datasets}
        db_engines: dict[int, str] = {}
        if unique_db_ids:
            db_objs = (
                db.session.query(Database)
                .filter(Database.id.in_(unique_db_ids))  # type: ignore[attr-defined,unused-ignore]
                .all()
            )
            for database_obj in db_objs:
                try:
                    db_engines[database_obj.id] = database_obj.backend
                except Exception:  # noqa: BLE001
                    db_engines[database_obj.id] = ""

        ds_to_tables, ds_db_map = DatasetDAO._parse_tables_from_virtual_datasets(
            virtual_datasets, db_engines=db_engines
        )

        if not ds_to_tables:
            return {}

        all_table_names: set[str] = set()
        db_ids: set[int] = set()
        for ds_id, table_names in ds_to_tables.items():
            all_table_names.update(table_names)
            db_ids.add(ds_db_map[ds_id])

        physical_map, phys_rls = DatasetDAO._fetch_physical_rls_map(
            all_table_names, db_ids
        )

        result: dict[int, list[dict[str, Any]]] = {}
        for ds_id, table_names in ds_to_tables.items():
            database_id = ds_db_map[ds_id]
            for table_name in table_names:
                phys_id = physical_map.get((table_name, database_id))
                if phys_id and phys_id in phys_rls:
                    result.setdefault(ds_id, []).extend(phys_rls[phys_id])

        return result

    @staticmethod
    def get_rls_filters_for_dataset(dataset_id: int) -> list[dict[str, Any]]:
        """
        Return full RLS filter details (including roles) for a single dataset.
        For virtual datasets, also includes RLS filters from physical tables
        referenced in the dataset's SQL.
        """
        from superset.connectors.sqla.models import RowLevelSecurityFilter

        # Direct RLS filters on this dataset
        filters = (
            db.session.query(RowLevelSecurityFilter)
            .join(
                RLSFilterTables,
                RLSFilterTables.c.rls_filter_id == RowLevelSecurityFilter.id,
            )
            .filter(RLSFilterTables.c.table_id == dataset_id)
            .all()
        )

        result = [
            {
                "id": f.id,
                "name": f.name,
                "filter_type": f.filter_type,
                "group_key": f.group_key,
                "clause": f.clause,
                "roles": [{"id": r.id, "name": r.name} for r in f.roles],
            }
            for f in filters
        ]

        # For virtual datasets, also check underlying physical tables
        dataset = (
            db.session.query(SqlaTable.sql, SqlaTable.schema, SqlaTable.database_id)
            .filter(SqlaTable.id == dataset_id)
            .one_or_none()
        )
        if dataset and dataset.sql:
            try:
                engine = ""
                database_obj = (
                    db.session.query(Database)
                    .filter(Database.id == dataset.database_id)
                    .one_or_none()
                )
                if database_obj:
                    engine = database_obj.backend
                parsed = SQLScript(dataset.sql, engine=engine)
                table_names: set[str] = set()
                for statement in parsed.statements:
                    for table_ref in statement.tables:
                        table_names.add(table_ref.table)

                if table_names:
                    physical_tables = (
                        db.session.query(SqlaTable.id)
                        .filter(
                            SqlaTable.table_name.in_(table_names),
                            SqlaTable.database_id == dataset.database_id,
                            SqlaTable.sql.is_(None),
                        )
                        .all()
                    )
                    physical_ids = [row[0] for row in physical_tables]

                    if physical_ids:
                        inherited_filters = (
                            db.session.query(RowLevelSecurityFilter)
                            .join(
                                RLSFilterTables,
                                RLSFilterTables.c.rls_filter_id
                                == RowLevelSecurityFilter.id,
                            )
                            .filter(RLSFilterTables.c.table_id.in_(physical_ids))
                            .all()
                        )

                        existing_ids = {f["id"] for f in result}
                        for f in inherited_filters:
                            if f.id not in existing_ids:
                                existing_ids.add(f.id)
                                result.append(
                                    {
                                        "id": f.id,
                                        "name": f.name,
                                        "filter_type": f.filter_type,
                                        "group_key": f.group_key,
                                        "clause": f.clause,
                                        "roles": [
                                            {"id": r.id, "name": r.name}
                                            for r in f.roles
                                        ],
                                        "inherited": True,
                                    }
                                )
            except Exception:  # noqa: BLE001
                logger.debug("Failed to parse SQL for virtual dataset %d", dataset_id)

        return result


class DatasetColumnDAO(BaseDAO[TableColumn]):
    pass


class DatasetMetricDAO(BaseDAO[SqlMetric]):
    pass
