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
from sqlalchemy import or_, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import joinedload, Query

from superset.connectors.sqla.models import (
    RLSFilterTables,
    RowLevelSecurityFilter,
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
    "editor": ["eq", "in"],
}


class DatasetDAO(BaseDAO[SqlaTable]):
    """
    DAO for datasets. Supports filtering on model fields, hybrid properties, and custom
    fields:
    - tags: list of tags (eq, in_, like)
    - editor: user id (eq, in_)
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
            elif c.col == "editor":
                from superset.subjects.models import sqlatable_editors, Subject

                operator_enum = ColumnOperatorEnum(c.opr)
                subq = (
                    select(sqlatable_editors.c.table_id)
                    .join(
                        Subject.__table__,
                        Subject.__table__.c.id == sqlatable_editors.c.subject_id,
                    )
                    .where(
                        Subject.__table__.c.type == 1,
                        operator_enum.apply(Subject.__table__.c.user_id, c.value),
                    )
                )
                query = query.filter(
                    SqlaTable.id.in_(subq)  # type: ignore[attr-defined,unused-ignore]
                )
            elif c.col == "created_by_fk_or_editor":
                if c.opr != "eq":
                    raise ValueError(
                        f"created_by_fk_or_editor only supports 'eq'; got '{c.opr}'"
                    )
                from superset.subjects.models import sqlatable_editors, Subject

                editor_subq = (
                    select(sqlatable_editors.c.table_id)
                    .join(
                        Subject.__table__,
                        Subject.__table__.c.id == sqlatable_editors.c.subject_id,
                    )
                    .where(
                        Subject.__table__.c.type == 1,
                        Subject.__table__.c.user_id == c.value,
                    )
                )
                query = query.filter(
                    or_(
                        SqlaTable.created_by_fk == c.value,  # type: ignore[attr-defined,unused-ignore]
                        SqlaTable.id.in_(editor_subq),  # type: ignore[attr-defined,unused-ignore]
                    )
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
    def _catalog_identity_filter(
        catalog: str | None,
        default_catalog: str | None,
    ) -> Any:
        """Null-aware catalog predicate for physical-identity matching.

        A row stored with ``catalog = NULL`` is semantically the database's
        default catalog (older datasets were created before the catalog column
        existed, and multi-catalog-disabled databases never set it). So when the
        normalized probe catalog resolves to the default, ``catalog = NULL`` rows
        must also match — otherwise create/update/restore/import disagree on what
        counts as the same physical table and let a default-catalog twin slip
        through.

        - probe is the default catalog  → match ``= default`` OR ``IS NULL``
        - probe is ``None`` (no catalog support) → match ``IS NULL``
        - probe is a non-default catalog → match ``= probe`` exactly
        """
        if catalog is not None and catalog == default_catalog:
            return or_(SqlaTable.catalog == catalog, SqlaTable.catalog.is_(None))
        if catalog is None:
            return SqlaTable.catalog.is_(None)
        return SqlaTable.catalog == catalog

    @staticmethod
    def validate_uniqueness(
        database: Database,
        table: Table,
        dataset_id: int | None = None,
    ) -> bool:
        # The catalog might not be set even if the database supports catalogs, in case
        # multi-catalog is disabled.
        default_catalog = database.get_default_catalog()
        catalog = table.catalog or default_catalog

        # Bypass the soft-delete visibility filter so a soft-deleted row with
        # the same physical identity still blocks the create. Otherwise a
        # delete-then-create-then-restore sequence could produce two live
        # datasets pointing at the same physical table.
        #
        # The bypass MUST be session-scoped, not per-query. The
        # ``db.session.query(dataset_query.exists()).scalar()`` pattern below
        # builds an OUTER query whose ``execution_options`` are independent
        # of the inner ``dataset_query`` — the listener fires on the outer
        # execute and would attach ``deleted_at IS NULL`` to all SqlaTable
        # references in the statement (including inside the EXISTS
        # subquery) via ``with_loader_criteria(include_aliases=True)``.
        # A per-query option on the inner query never reaches that listener.
        #
        # avoid app-init regression: a module-top import from
        # ``superset.models.helpers`` eagerly loads ``core.py``, whose model
        # classes evaluate ``encrypted_field_factory.create(...)`` at
        # class-definition time and raise "App not initialized yet" when no
        # Flask app context exists (see PR #40573).
        from superset.models.helpers import (  # pylint: disable=import-outside-toplevel
            skip_visibility_filter,
        )

        with skip_visibility_filter(db.session, SqlaTable):
            dataset_query = db.session.query(SqlaTable).filter(
                SqlaTable.table_name == table.table,
                SqlaTable.schema == table.schema,
                DatasetDAO._catalog_identity_filter(catalog, default_catalog),
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
        """Update-time twin of ``validate_uniqueness``.

        Delegates outright — the identity rule, catalog normalization, and
        the session-scoped visibility bypass (and their rationale) live in
        ``validate_uniqueness`` so they cannot drift between the create and
        update paths.
        """
        return DatasetDAO.validate_uniqueness(database, table, dataset_id)

    @staticmethod
    def has_active_logical_duplicate(
        model: SqlaTable,
        table: Table | None = None,
    ) -> bool:
        """Return True iff another *active* dataset shares model's physical table.

        ``table`` overrides the identity to probe (used by restore-via-import,
        where the uploaded config may rename the dataset — the collision that
        matters is against the *post-update* identity, not the stored one).
        Physical identity is ``(database_id, catalog, schema, table_name)``.
        ``model``'s catalog is normalized to the database default when unset —
        the same rule ``validate_uniqueness``/``validate_update_uniqueness``
        apply — so create, update, restore, and re-import agree on what counts
        as the same physical table. Catalog matching is null-aware via
        ``_catalog_identity_filter``: when the normalized catalog is the database
        default, both ``catalog = default`` and ``catalog IS NULL`` rows match,
        so a default-catalog twin is caught whichever way either row stored its
        catalog.

        Unlike ``validate_uniqueness``, this does NOT use
        ``skip_visibility_filter``: it relies on the ``SoftDeleteMixin`` listener
        to auto-append ``deleted_at IS NULL`` so only *active* rows match. Do not
        add the bypass here — it would broaden the check to soft-deleted rows and
        silently refuse legitimate restores. ``id != model.id`` excludes the row
        itself.

        Assumes an active app context and a session-attached ``model`` so
        ``db.session`` and the lazy ``model.database`` relationship resolve.
        """
        # The catalog might not be set even if the database supports catalogs,
        # in case multi-catalog is disabled.
        default_catalog = model.database.get_default_catalog()
        probe_table_name = table.table if table else model.table_name
        probe_schema = table.schema if table else model.schema
        probe_catalog = (table.catalog if table else model.catalog) or default_catalog
        # This is a best-effort read for a friendly early error; it does not
        # lock, so two concurrent creates could both pass it. That race is
        # benign: the DB-level UniqueConstraint on
        # (database_id, catalog, schema, table_name) (see SqlaTable.__table_args__)
        # is the real guard — the losing commit fails with IntegrityError rather
        # than landing a second active dataset over the same physical table.
        return (
            db.session.query(SqlaTable.id)
            .filter(
                SqlaTable.database_id == model.database_id,
                DatasetDAO._catalog_identity_filter(probe_catalog, default_catalog),
                SqlaTable.schema == probe_schema,
                SqlaTable.table_name == probe_table_name,
                SqlaTable.id != model.id,
            )
            .first()
            is not None
        )

    @staticmethod
    def find_soft_deleted_logical_duplicate(
        database: Database,
        table: Table,
    ) -> SqlaTable | None:
        """Return a *soft-deleted* dataset sharing table's physical identity.

        Used by the YAML importer's create path: ``import_from_dict`` can't see
        soft-deleted rows (the visibility filter hides them), so importing a
        dataset with a fresh UUID but the same physical table as a soft-deleted
        dataset would create an active twin of a hidden row. This bypasses the
        visibility filter (``skip_visibility_filter``) and restricts to
        ``deleted_at IS NOT NULL`` so the caller can block the import and direct
        the user to restore the existing dataset instead. Catalog matching is
        null-aware via ``_catalog_identity_filter`` so a default-catalog twin is
        caught however either row stored its catalog.
        """
        # avoid app-init regression: see ``validate_uniqueness`` — a module-top
        # import of ``skip_visibility_filter`` eagerly loads model classes that
        # raise "App not initialized yet" outside an app context (PR #40573).
        from superset.models.helpers import (  # pylint: disable=import-outside-toplevel
            skip_visibility_filter,
        )

        default_catalog = database.get_default_catalog()
        catalog = table.catalog or default_catalog
        with skip_visibility_filter(db.session, SqlaTable):
            return (
                db.session.query(SqlaTable)
                .filter(
                    SqlaTable.database_id == database.id,
                    DatasetDAO._catalog_identity_filter(catalog, default_catalog),
                    SqlaTable.schema == table.schema,
                    SqlaTable.table_name == table.table,
                    SqlaTable.deleted_at.is_not(None),
                )
                .first()
            )

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
    def _validate_column_date_formats(
        cls, property_columns: list[dict[str, Any]]
    ) -> None:
        for column in property_columns:
            if column.get("python_date_format") is None:
                continue
            if not DatasetDAO.validate_python_date_format(column["python_date_format"]):
                raise ValueError(
                    "python_date_format is an invalid date/timestamp format."
                )

    @classmethod
    def _override_columns(
        cls, model: SqlaTable, property_columns: list[dict[str, Any]]
    ) -> None:
        """Replace columns by natural key (``column_name``) — update in place
        rather than delete-and-reinsert.

        SPIKE (full-Continuum): the previous
        delete-and-reinsert pattern produced overlapping shadow rows in
        ``table_columns_version`` (the same ``column_name`` had a DELETE
        shadow at tx N alongside an INSERT shadow at tx N for a fresh PK).
        Continuum's ``Reverter`` couldn't unwind this on restore: its flush
        ordering inserts the historical row before deleting the live one,
        hitting the ``UNIQUE (table_id, column_name)`` constraint mid-flush
        (ADR-004 Failure 1).

        The natural-key upsert keeps PKs stable across metadata refresh.
        Continuum captures only real field changes; new columns get plain
        INSERT shadows; removed columns get plain DELETE shadows. No
        natural-key collisions, so Reverter can restore cleanly.

        Behaviour change vs. the previous implementation: PKs of unchanged
        columns are preserved. Charts that reference columns by their
        ``id`` continue to work across a metadata refresh — previously
        such references would be invalidated.
        """
        existing_by_name = {c.column_name: c for c in model.columns}
        incoming_by_name = {p["column_name"]: p for p in property_columns}

        # Identity is the natural key here, never the payload's ``id``:
        # setattr-ing an incoming ``id`` onto a name-matched row would
        # rewrite a live primary key, and a renamed column whose payload
        # still carries its old ``id`` would INSERT with a live PK while
        # the old-named row is deleted in the same flush — INSERTs flush
        # before DELETEs, so that collides on the PK / UNIQUE(table_id,
        # column_name) constraints. ``table_id`` is pinned to *model*.
        protected_keys = ("id", "table_id")

        # Update columns present in both: in-place setattr.
        for name, col in existing_by_name.items():
            if name in incoming_by_name:
                for key, value in incoming_by_name[name].items():
                    if key not in protected_keys:
                        setattr(col, key, value)

        # Insert columns present only in incoming.
        # Delete columns present only in existing, and flush the deletes BEFORE
        # inserting new ones. SQLAlchemy's unit of work orders INSERTs before
        # DELETEs within a single flush, so without this intermediate flush an
        # incoming column whose name case-insensitively matches a removed column
        # (a case-only rename under a case-insensitive collation, e.g. MySQL)
        # would collide on ``UNIQUE(table_id, column_name)`` mid-flush.
        deleted_any = False
        for name, col in existing_by_name.items():
            if name not in incoming_by_name:
                db.session.delete(col)
                deleted_any = True
        if deleted_any:
            db.session.flush()

        # Insert columns present only in incoming.
        for name, properties in incoming_by_name.items():
            if name not in existing_by_name:
                cleaned = {
                    key: value
                    for key, value in properties.items()
                    if key not in protected_keys
                }
                db.session.add(TableColumn(**{**cleaned, "table_id": model.id}))

    @classmethod
    def _upsert_columns(
        cls, model: SqlaTable, property_columns: list[dict[str, Any]]
    ) -> None:
        columns_by_id = {column.id: column for column in model.columns}
        property_columns_by_id = {
            properties["id"]: properties
            for properties in property_columns
            if "id" in properties
        }

        for properties in property_columns:
            if "id" not in properties:
                db.session.add(TableColumn(**{**properties, "table_id": model.id}))

        for properties in property_columns_by_id.values():
            col = columns_by_id[properties["id"]]
            for key, value in properties.items():
                setattr(col, key, value)

        ids_to_keep = property_columns_by_id.keys()
        for col in model.columns:
            if col.id not in ids_to_keep:
                db.session.delete(col)

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

        Uses individual ORM operations (not bulk) so that SQLAlchemy-Continuum
        can capture each row change in the version history.
        """
        cls._validate_column_date_formats(property_columns)
        if override_columns:
            cls._override_columns(model, property_columns)
        else:
            cls._upsert_columns(model, property_columns)

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

        Uses individual ORM operations (not bulk) so that SQLAlchemy-Continuum
        can capture each row change in the version history.
        """

        metrics_by_id = {metric.id: metric for metric in model.metrics}

        property_metrics_by_id = {
            properties["id"]: properties
            for properties in property_metrics
            if "id" in properties
        }

        # Insert new metrics
        for properties in property_metrics:
            if "id" not in properties:
                db.session.add(SqlMetric(**{**properties, "table_id": model.id}))

        # Update existing metrics
        for properties in property_metrics_by_id.values():
            metric = metrics_by_id[properties["id"]]
            for key, value in properties.items():
                setattr(metric, key, value)

        # Delete removed metrics
        ids_to_keep = property_metrics_by_id.keys()
        for metric in model.metrics:
            if metric.id not in ids_to_keep:
                db.session.delete(metric)

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

    @staticmethod
    def get_table_by_catalog_schema_and_name(
        database_id: int,
        schema: str | None,
        table_name: str,
        catalog: str | None = None,
    ) -> SqlaTable | None:
        # Filter by the full ``(database_id, catalog, schema, table_name)``
        # uniqueness key so callers can disambiguate datasets that share a
        # ``table_name`` across schemas or catalogs (#30377).
        return (
            db.session.query(SqlaTable)
            .filter_by(
                database_id=database_id,
                catalog=catalog,
                schema=schema,
                table_name=table_name,
            )
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
    ) -> tuple[dict[int, set[Table]], dict[int, int]]:
        """
        Parse SQL from virtual datasets and return:
        - ds_to_tables: mapping of dataset_id -> set of referenced Table objects
          (with schema/catalog preserved from the SQL, unqualified refs resolved
          to the virtual dataset's own schema)
        - ds_db_map: mapping of dataset_id -> database_id
        """
        if db_engines is None:
            db_engines = {}
        ds_to_tables: dict[int, set[Table]] = {}
        ds_db_map: dict[int, int] = {}
        for ds_id, sql, default_schema, database_id in virtual_datasets:
            ds_db_map[ds_id] = database_id
            engine = db_engines.get(database_id, "")
            try:
                parsed = SQLScript(sql, engine=engine)
                table_refs: set[Table] = set()
                for statement in parsed.statements:
                    for table_ref in statement.tables:
                        # Qualify unqualified references with the virtual dataset's
                        # own schema so we match the correct physical dataset.
                        table_refs.add(table_ref.qualify(schema=default_schema))
                if table_refs:
                    ds_to_tables[ds_id] = table_refs
            except Exception:  # noqa: BLE001
                logger.warning(
                    "Failed to parse SQL for virtual dataset %d", ds_id, exc_info=True
                )
        return ds_to_tables, ds_db_map

    @staticmethod
    def _fetch_physical_rls_map(
        all_tables: set[Table],
        db_ids: set[int],
    ) -> tuple[dict[tuple[str, str | None, int], int], dict[int, list[dict[str, Any]]]]:
        """
        Look up physical datasets matching the given Table objects and database IDs,
        then fetch their RLS filters.

        Returns:
        - physical_map: (table_name, schema, database_id) -> physical dataset id
        - phys_rls: physical dataset id -> list of RLS filter summaries
        """

        all_table_names = {t.table for t in all_tables}
        physical_tables = (
            db.session.query(
                SqlaTable.id,
                SqlaTable.table_name,
                SqlaTable.schema,
                SqlaTable.database_id,
            )
            .filter(
                SqlaTable.table_name.in_(all_table_names),
                SqlaTable.database_id.in_(db_ids),
                SqlaTable.sql.is_(None),
            )
            .all()
        )

        physical_map: dict[tuple[str, str | None, int], int] = {}
        physical_ids: set[int] = set()
        for phys_id, table_name, schema, db_id in physical_tables:
            physical_map[(table_name, schema, db_id)] = phys_id
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
    def _fetch_db_engines(
        db_ids: set[int],
    ) -> dict[int, str]:
        """Return a mapping of database_id -> backend engine string."""
        if not db_ids:
            return {}
        db_objs = (
            db.session.query(Database)
            .filter(Database.id.in_(db_ids))  # type: ignore[attr-defined,unused-ignore]
            .all()
        )
        engines: dict[int, str] = {}
        for database_obj in db_objs:
            try:
                engines[database_obj.id] = database_obj.backend
            except Exception:  # noqa: BLE001
                engines[database_obj.id] = ""
        return engines

    @staticmethod
    def _get_inherited_rls_for_virtual_datasets(
        virtual_datasets: list[tuple[int, str, str | None, int]],
    ) -> dict[int, list[dict[str, Any]]]:
        """
        For virtual datasets, parse their SQL to find referenced physical
        tables and return any RLS filters attached to those tables.

        Each tuple is (dataset_id, sql, schema, database_id).
        """
        unique_db_ids = {row[3] for row in virtual_datasets}
        db_engines = DatasetDAO._fetch_db_engines(unique_db_ids)

        ds_to_tables, ds_db_map = DatasetDAO._parse_tables_from_virtual_datasets(
            virtual_datasets, db_engines=db_engines
        )

        if not ds_to_tables:
            return {}

        all_table_refs: set[Table] = set()
        db_ids: set[int] = set()
        for ds_id, table_refs in ds_to_tables.items():
            all_table_refs.update(table_refs)
            db_ids.add(ds_db_map[ds_id])

        physical_map, phys_rls = DatasetDAO._fetch_physical_rls_map(
            all_table_refs, db_ids
        )

        result: dict[int, list[dict[str, Any]]] = {}
        for ds_id, table_refs in ds_to_tables.items():
            database_id = ds_db_map[ds_id]
            seen_filter_ids: set[int] = set()
            for table_ref in table_refs:
                phys_id = physical_map.get(
                    (table_ref.table, table_ref.schema, database_id)
                )
                if phys_id and phys_id in phys_rls:
                    for f in phys_rls[phys_id]:
                        if f["id"] not in seen_filter_ids:
                            seen_filter_ids.add(f["id"])
                            result.setdefault(ds_id, []).append(f)

        return result

    @staticmethod
    def get_rls_filters_for_dataset(dataset_id: int) -> list[dict[str, Any]]:
        """
        Return full RLS filter details (including roles) for a single dataset.
        For virtual datasets, also includes RLS filters from physical tables
        referenced in the dataset's SQL.
        """

        # Direct RLS filters on this dataset — eager-load subjects to avoid N+1
        filters = (
            db.session.query(RowLevelSecurityFilter)
            .options(joinedload(RowLevelSecurityFilter.subjects))
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
                "roles": [{"id": s.id, "name": s.label} for s in f.subjects],
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
                table_refs: set[Table] = set()
                for statement in parsed.statements:
                    for table_ref in statement.tables:
                        table_refs.add(table_ref.qualify(schema=dataset.schema))

                if table_refs:
                    # Build filter conditions that respect schema
                    all_table_names = {t.table for t in table_refs}
                    physical_tables = (
                        db.session.query(
                            SqlaTable.id,
                            SqlaTable.table_name,
                            SqlaTable.schema,
                        )
                        .filter(
                            SqlaTable.table_name.in_(all_table_names),
                            SqlaTable.database_id == dataset.database_id,
                            SqlaTable.sql.is_(None),
                        )
                        .all()
                    )
                    # Only select physical tables whose schema matches
                    physical_ids = [
                        row.id
                        for row in physical_tables
                        if any(
                            t.table == row.table_name and t.schema == row.schema
                            for t in table_refs
                        )
                    ]

                    if physical_ids:
                        inherited_filters = (
                            db.session.query(RowLevelSecurityFilter)
                            .options(joinedload(RowLevelSecurityFilter.subjects))
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
                                            {"id": s.id, "name": s.label}
                                            for s in f.subjects
                                        ],
                                        "inherited": True,
                                    }
                                )
            except Exception:  # noqa: BLE001
                logger.warning(
                    "Failed to resolve inherited RLS for virtual dataset %d",
                    dataset_id,
                    exc_info=True,
                )

        return result


class DatasetColumnDAO(BaseDAO[TableColumn]):
    pass


class DatasetMetricDAO(BaseDAO[SqlMetric]):
    pass
