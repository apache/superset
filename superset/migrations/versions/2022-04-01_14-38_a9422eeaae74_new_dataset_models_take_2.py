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
"""new_dataset_models_take_2

Revision ID: a9422eeaae74
Revises: ad07e4fdbaba
Create Date: 2022-04-01 14:38:09.499483

"""

# revision identifiers, used by Alembic.
revision = "a9422eeaae74"
down_revision = "ad07e4fdbaba"

import os  # noqa: E402
from datetime import datetime  # noqa: E402
from typing import Optional, Union  # noqa: E402
from uuid import uuid4  # noqa: E402

import sqlalchemy as sa  # noqa: E402
from alembic import op  # noqa: E402
from sqlalchemy import select  # noqa: E402
from sqlalchemy.ext.declarative import declarative_base, declared_attr  # noqa: E402
from sqlalchemy.orm import backref, relationship, Session  # noqa: E402
from sqlalchemy.schema import UniqueConstraint  # noqa: E402
from sqlalchemy.sql import functions as func  # noqa: E402
from sqlalchemy.sql.expression import and_, or_  # noqa: E402
from sqlalchemy_utils import UUIDType  # noqa: E402

from superset.connectors.sqla.models import ADDITIVE_METRIC_TYPES_LOWER  # noqa: E402
from superset.connectors.sqla.utils import (  # noqa: E402
    get_dialect_name,
    get_identifier_quoter,
)
from superset.extensions import encrypted_field_factory  # noqa: E402
from superset.migrations.shared.utils import assign_uuids  # noqa: E402
from superset.sql_parse import extract_table_references, Table  # noqa: E402
from superset.utils import json  # noqa: E402
from superset.utils.core import MediumText  # noqa: E402

Base = declarative_base()
SHOW_PROGRESS = os.environ.get("SHOW_PROGRESS") == "1"
UNKNOWN_TYPE = "UNKNOWN"


user_table = sa.Table(
    "ab_user", Base.metadata, sa.Column("id", sa.Integer(), primary_key=True)
)


class UUIDMixin:
    uuid = sa.Column(
        UUIDType(binary=True), primary_key=False, unique=True, default=uuid4
    )


class AuxiliaryColumnsMixin(UUIDMixin):
    """
    Auxiliary columns, a combination of columns added by
       AuditMixinNullable + ImportExportMixin
    """

    created_on = sa.Column(sa.DateTime, default=datetime.now, nullable=True)
    changed_on = sa.Column(
        sa.DateTime, default=datetime.now, onupdate=datetime.now, nullable=True
    )

    @declared_attr
    def created_by_fk(cls):
        return sa.Column(sa.Integer, sa.ForeignKey("ab_user.id"), nullable=True)

    @declared_attr
    def changed_by_fk(cls):
        return sa.Column(sa.Integer, sa.ForeignKey("ab_user.id"), nullable=True)


def insert_from_select(
    target: Union[str, sa.Table, type[Base]], source: sa.sql.expression.Select
) -> None:
    """
    Execute INSERT FROM SELECT to copy data from a SELECT query to the target table.
    """
    if isinstance(target, sa.Table):
        target_table = target
    elif hasattr(target, "__tablename__"):
        target_table: sa.Table = Base.metadata.tables[target.__tablename__]
    else:
        target_table: sa.Table = Base.metadata.tables[target]
    cols = [col.name for col in source.columns if col.name in target_table.columns]
    query = target_table.insert().from_select(cols, source)
    return op.execute(query)


class Database(Base):
    __tablename__ = "dbs"
    __table_args__ = (UniqueConstraint("database_name"),)

    id = sa.Column(sa.Integer, primary_key=True)
    database_name = sa.Column(sa.String(250), unique=True, nullable=False)
    sqlalchemy_uri = sa.Column(sa.String(1024), nullable=False)
    password = sa.Column(encrypted_field_factory.create(sa.String(1024)))
    impersonate_user = sa.Column(sa.Boolean, default=False)
    encrypted_extra = sa.Column(encrypted_field_factory.create(sa.Text), nullable=True)
    extra = sa.Column(sa.Text)
    server_cert = sa.Column(encrypted_field_factory.create(sa.Text), nullable=True)


class TableColumn(AuxiliaryColumnsMixin, Base):
    __tablename__ = "table_columns"
    __table_args__ = (UniqueConstraint("table_id", "column_name"),)

    id = sa.Column(sa.Integer, primary_key=True)
    table_id = sa.Column(sa.Integer, sa.ForeignKey("tables.id"))
    is_active = sa.Column(sa.Boolean, default=True)
    extra = sa.Column(sa.Text)
    column_name = sa.Column(sa.String(255), nullable=False)
    type = sa.Column(sa.String(32))
    expression = sa.Column(MediumText())
    description = sa.Column(MediumText())
    is_dttm = sa.Column(sa.Boolean, default=False)
    filterable = sa.Column(sa.Boolean, default=True)
    groupby = sa.Column(sa.Boolean, default=True)
    verbose_name = sa.Column(sa.String(1024))
    python_date_format = sa.Column(sa.String(255))


class SqlMetric(AuxiliaryColumnsMixin, Base):
    __tablename__ = "sql_metrics"
    __table_args__ = (UniqueConstraint("table_id", "metric_name"),)

    id = sa.Column(sa.Integer, primary_key=True)
    table_id = sa.Column(sa.Integer, sa.ForeignKey("tables.id"))
    extra = sa.Column(sa.Text)
    metric_type = sa.Column(sa.String(32))
    metric_name = sa.Column(sa.String(255), nullable=False)
    expression = sa.Column(MediumText(), nullable=False)
    warning_text = sa.Column(MediumText())
    description = sa.Column(MediumText())
    d3format = sa.Column(sa.String(128))
    verbose_name = sa.Column(sa.String(1024))


sqlatable_user_table = sa.Table(
    "sqlatable_user",
    Base.metadata,
    sa.Column("id", sa.Integer, primary_key=True),
    sa.Column("user_id", sa.Integer, sa.ForeignKey("ab_user.id")),
    sa.Column("table_id", sa.Integer, sa.ForeignKey("tables.id")),
)


class SqlaTable(AuxiliaryColumnsMixin, Base):
    __tablename__ = "tables"
    __table_args__ = (UniqueConstraint("database_id", "schema", "table_name"),)

    id = sa.Column(sa.Integer, primary_key=True)
    extra = sa.Column(sa.Text)
    database_id = sa.Column(sa.Integer, sa.ForeignKey("dbs.id"), nullable=False)
    database: Database = relationship(
        "Database",
        backref=backref("tables", cascade="all, delete-orphan"),
        foreign_keys=[database_id],
    )
    schema = sa.Column(sa.String(255))
    table_name = sa.Column(sa.String(250), nullable=False)
    sql = sa.Column(MediumText())
    is_managed_externally = sa.Column(sa.Boolean, nullable=False, default=False)
    external_url = sa.Column(sa.Text, nullable=True)


table_column_association_table = sa.Table(
    "sl_table_columns",
    Base.metadata,
    sa.Column("table_id", sa.ForeignKey("sl_tables.id"), primary_key=True),
    sa.Column("column_id", sa.ForeignKey("sl_columns.id"), primary_key=True),
)

dataset_column_association_table = sa.Table(
    "sl_dataset_columns",
    Base.metadata,
    sa.Column("dataset_id", sa.ForeignKey("sl_datasets.id"), primary_key=True),
    sa.Column("column_id", sa.ForeignKey("sl_columns.id"), primary_key=True),
)

dataset_table_association_table = sa.Table(
    "sl_dataset_tables",
    Base.metadata,
    sa.Column("dataset_id", sa.ForeignKey("sl_datasets.id"), primary_key=True),
    sa.Column("table_id", sa.ForeignKey("sl_tables.id"), primary_key=True),
)

dataset_user_association_table = sa.Table(
    "sl_dataset_users",
    Base.metadata,
    sa.Column("dataset_id", sa.ForeignKey("sl_datasets.id"), primary_key=True),
    sa.Column("user_id", sa.ForeignKey("ab_user.id"), primary_key=True),
)


class NewColumn(AuxiliaryColumnsMixin, Base):
    __tablename__ = "sl_columns"

    id = sa.Column(sa.Integer, primary_key=True)
    # A temporary column to link physical columns with tables so we don't
    # have to insert a record in the relationship table while creating new columns.
    table_id = sa.Column(sa.Integer, nullable=True)

    is_aggregation = sa.Column(sa.Boolean, nullable=False, default=False)
    is_additive = sa.Column(sa.Boolean, nullable=False, default=False)
    is_dimensional = sa.Column(sa.Boolean, nullable=False, default=False)
    is_filterable = sa.Column(sa.Boolean, nullable=False, default=True)
    is_increase_desired = sa.Column(sa.Boolean, nullable=False, default=True)
    is_managed_externally = sa.Column(sa.Boolean, nullable=False, default=False)
    is_partition = sa.Column(sa.Boolean, nullable=False, default=False)
    is_physical = sa.Column(sa.Boolean, nullable=False, default=False)
    is_temporal = sa.Column(sa.Boolean, nullable=False, default=False)
    is_spatial = sa.Column(sa.Boolean, nullable=False, default=False)

    name = sa.Column(sa.Text)
    type = sa.Column(sa.Text)
    unit = sa.Column(sa.Text)
    expression = sa.Column(MediumText())
    description = sa.Column(MediumText())
    warning_text = sa.Column(MediumText())
    external_url = sa.Column(sa.Text, nullable=True)
    extra_json = sa.Column(MediumText(), default="{}")


class NewTable(AuxiliaryColumnsMixin, Base):
    __tablename__ = "sl_tables"

    id = sa.Column(sa.Integer, primary_key=True)
    # A temporary column to keep the link between NewTable to SqlaTable
    sqlatable_id = sa.Column(sa.Integer, primary_key=False, nullable=True, unique=True)
    database_id = sa.Column(sa.Integer, sa.ForeignKey("dbs.id"), nullable=False)
    is_managed_externally = sa.Column(sa.Boolean, nullable=False, default=False)
    catalog = sa.Column(sa.Text)
    schema = sa.Column(sa.Text)
    name = sa.Column(sa.Text)
    external_url = sa.Column(sa.Text, nullable=True)
    extra_json = sa.Column(MediumText(), default="{}")
    database: Database = relationship(
        "Database",
        backref=backref("new_tables", cascade="all, delete-orphan"),
        foreign_keys=[database_id],
    )


class NewDataset(AuxiliaryColumnsMixin, Base):
    __tablename__ = "sl_datasets"

    id = sa.Column(sa.Integer, primary_key=True)
    database_id = sa.Column(sa.Integer, sa.ForeignKey("dbs.id"), nullable=False)
    is_physical = sa.Column(sa.Boolean, default=False)
    is_managed_externally = sa.Column(sa.Boolean, nullable=False, default=False)
    name = sa.Column(sa.Text)
    expression = sa.Column(MediumText())
    external_url = sa.Column(sa.Text, nullable=True)
    extra_json = sa.Column(MediumText(), default="{}")


def find_tables(
    session: Session,
    database_id: int,
    default_schema: Optional[str],
    tables: set[Table],
) -> list[int]:
    """
    Look for NewTable's of from a specific database
    """
    if not tables:
        return []

    predicate = or_(
        *[
            and_(
                NewTable.database_id == database_id,
                NewTable.schema == (table.schema or default_schema),
                NewTable.name == table.table,
            )
            for table in tables
        ]
    )
    return session.query(NewTable.id).filter(predicate).all()


# helper SQLA elements for easier querying
is_physical_table = or_(SqlaTable.sql.is_(None), SqlaTable.sql == "")
is_physical_column = or_(TableColumn.expression.is_(None), TableColumn.expression == "")

# filtering out table columns with valid associated SqlTable
active_table_columns = sa.join(
    TableColumn,
    SqlaTable,
    TableColumn.table_id == SqlaTable.id,
)
active_metrics = sa.join(SqlMetric, SqlaTable, SqlMetric.table_id == SqlaTable.id)


def copy_tables(session: Session) -> None:
    """Copy Physical tables"""
    count = session.query(SqlaTable).filter(is_physical_table).count()
    if not count:
        return
    print(f">> Copy {count:,} physical tables to sl_tables...")
    insert_from_select(
        NewTable,
        select(
            [
                # Tables need different uuid than datasets, since they are different
                # entities. When INSERT FROM SELECT, we must provide a value for `uuid`,
                # otherwise it'd use the default generated on Python side, which
                # will cause duplicate values. They will be replaced by `assign_uuids` later.
                SqlaTable.uuid,
                SqlaTable.id.label("sqlatable_id"),
                SqlaTable.created_on,
                SqlaTable.changed_on,
                SqlaTable.created_by_fk,
                SqlaTable.changed_by_fk,
                SqlaTable.table_name.label("name"),
                SqlaTable.schema,
                SqlaTable.database_id,
                SqlaTable.is_managed_externally,
                SqlaTable.external_url,
            ]
        )
        # use an inner join to filter out only tables with valid database ids
        .select_from(sa.join(SqlaTable, Database, SqlaTable.database_id == Database.id))
        .where(is_physical_table),
    )


def copy_datasets(session: Session) -> None:
    """Copy all datasets"""
    count = session.query(SqlaTable).count()
    if not count:
        return
    print(f">> Copy {count:,} SqlaTable to sl_datasets...")
    insert_from_select(
        NewDataset,
        select(
            [
                SqlaTable.uuid,
                SqlaTable.created_on,
                SqlaTable.changed_on,
                SqlaTable.created_by_fk,
                SqlaTable.changed_by_fk,
                SqlaTable.database_id,
                SqlaTable.table_name.label("name"),
                func.coalesce(SqlaTable.sql, SqlaTable.table_name).label("expression"),
                is_physical_table.label("is_physical"),
                SqlaTable.is_managed_externally,
                SqlaTable.external_url,
                SqlaTable.extra.label("extra_json"),
            ]
        ),
    )

    print("   Copy dataset owners...")
    insert_from_select(
        dataset_user_association_table,
        select(
            [NewDataset.id.label("dataset_id"), sqlatable_user_table.c.user_id]
        ).select_from(
            sqlatable_user_table.join(
                SqlaTable, SqlaTable.id == sqlatable_user_table.c.table_id
            ).join(NewDataset, NewDataset.uuid == SqlaTable.uuid)
        ),
    )

    print("   Link physical datasets with tables...")
    insert_from_select(
        dataset_table_association_table,
        select(
            [
                NewDataset.id.label("dataset_id"),
                NewTable.id.label("table_id"),
            ]
        ).select_from(
            sa.join(SqlaTable, NewTable, NewTable.sqlatable_id == SqlaTable.id).join(
                NewDataset, NewDataset.uuid == SqlaTable.uuid
            )
        ),
    )


def copy_columns(session: Session) -> None:
    """Copy columns with active associated SqlTable"""
    count = session.query(TableColumn).select_from(active_table_columns).count()
    if not count:
        return
    print(f">> Copy {count:,} table columns to sl_columns...")
    insert_from_select(
        NewColumn,
        select(
            [
                TableColumn.uuid,
                TableColumn.created_on,
                TableColumn.changed_on,
                TableColumn.created_by_fk,
                TableColumn.changed_by_fk,
                TableColumn.groupby.label("is_dimensional"),
                TableColumn.filterable.label("is_filterable"),
                TableColumn.column_name.label("name"),
                TableColumn.description,
                func.coalesce(TableColumn.expression, TableColumn.column_name).label(
                    "expression"
                ),
                sa.literal(False).label("is_aggregation"),
                is_physical_column.label("is_physical"),
                func.coalesce(TableColumn.is_dttm, False).label("is_temporal"),
                func.coalesce(TableColumn.type, UNKNOWN_TYPE).label("type"),
                TableColumn.extra.label("extra_json"),
            ]
        ).select_from(active_table_columns),
    )

    joined_columns_table = active_table_columns.join(
        NewColumn, TableColumn.uuid == NewColumn.uuid
    )
    print("   Link all columns to sl_datasets...")
    insert_from_select(
        dataset_column_association_table,
        select(
            [
                NewDataset.id.label("dataset_id"),
                NewColumn.id.label("column_id"),
            ],
        ).select_from(
            joined_columns_table.join(NewDataset, NewDataset.uuid == SqlaTable.uuid)
        ),
    )


def copy_metrics(session: Session) -> None:
    """Copy metrics as virtual columns"""
    metrics_count = session.query(SqlMetric).select_from(active_metrics).count()
    if not metrics_count:
        return

    print(f">> Copy {metrics_count:,} metrics to sl_columns...")
    insert_from_select(
        NewColumn,
        select(
            [
                SqlMetric.uuid,
                SqlMetric.created_on,
                SqlMetric.changed_on,
                SqlMetric.created_by_fk,
                SqlMetric.changed_by_fk,
                SqlMetric.metric_name.label("name"),
                SqlMetric.expression,
                SqlMetric.description,
                sa.literal(UNKNOWN_TYPE).label("type"),
                (
                    func.coalesce(
                        sa.func.lower(SqlMetric.metric_type).in_(
                            ADDITIVE_METRIC_TYPES_LOWER
                        ),
                        sa.literal(False),
                    ).label("is_additive")
                ),
                sa.literal(True).label("is_aggregation"),
                # metrics are by default not filterable
                sa.literal(False).label("is_filterable"),
                sa.literal(False).label("is_dimensional"),
                sa.literal(False).label("is_physical"),
                sa.literal(False).label("is_temporal"),
                SqlMetric.extra.label("extra_json"),
                SqlMetric.warning_text,
            ]
        ).select_from(active_metrics),
    )

    print("   Link metric columns to datasets...")
    insert_from_select(
        dataset_column_association_table,
        select(
            [
                NewDataset.id.label("dataset_id"),
                NewColumn.id.label("column_id"),
            ],
        ).select_from(
            active_metrics.join(NewDataset, NewDataset.uuid == SqlaTable.uuid).join(
                NewColumn, NewColumn.uuid == SqlMetric.uuid
            )
        ),
    )


def postprocess_datasets(session: Session) -> None:
    """
    Postprocess datasets after insertion to
      - Quote table names for physical datasets (if needed)
      - Link referenced tables to virtual datasets
    """
    total = session.query(SqlaTable).count()
    if not total:
        return

    offset = 0
    limit = 10000

    joined_tables = sa.join(
        NewDataset,
        SqlaTable,
        NewDataset.uuid == SqlaTable.uuid,
    ).join(
        Database,
        Database.id == SqlaTable.database_id,
        isouter=True,
    )
    assert session.query(func.count()).select_from(joined_tables).scalar() == total

    print(f">> Run postprocessing on {total} datasets")

    update_count = 0

    def print_update_count():
        if SHOW_PROGRESS:
            print(
                f"   Will update {update_count} datasets" + " " * 20,
                end="\r",
            )

    while offset < total:
        print(
            f"   Process dataset {offset + 1}~{min(total, offset + limit)}..."
            + " " * 30
        )
        for (
            database_id,
            dataset_id,
            expression,
            extra,
            is_physical,
            schema,
            sqlalchemy_uri,
        ) in session.execute(
            select(
                [
                    NewDataset.database_id,
                    NewDataset.id.label("dataset_id"),
                    NewDataset.expression,
                    SqlaTable.extra,
                    NewDataset.is_physical,
                    SqlaTable.schema,
                    Database.sqlalchemy_uri,
                ]
            )
            .select_from(joined_tables)
            .offset(offset)
            .limit(limit)
        ):
            drivername = (sqlalchemy_uri or "").split("://")[0]
            updates = {}
            updated = False
            if is_physical and drivername and expression:
                quoted_expression = get_identifier_quoter(drivername)(expression)
                if quoted_expression != expression:
                    updates["expression"] = quoted_expression

            # add schema name to `dataset.extra_json` so we don't have to join
            # tables in order to use datasets
            if schema:
                try:
                    extra_json = json.loads(extra) if extra else {}
                except json.JSONDecodeError:
                    extra_json = {}
                extra_json["schema"] = schema
                updates["extra_json"] = json.dumps(extra_json)

            if updates:
                session.execute(
                    sa.update(NewDataset)
                    .where(NewDataset.id == dataset_id)
                    .values(**updates)
                )
                updated = True

            if not is_physical and drivername and expression:
                table_refrences = extract_table_references(
                    expression, get_dialect_name(drivername), show_warning=False
                )
                found_tables = find_tables(
                    session, database_id, schema, table_refrences
                )
                if found_tables:
                    op.bulk_insert(
                        dataset_table_association_table,
                        [
                            {"dataset_id": dataset_id, "table_id": table.id}
                            for table in found_tables
                        ],
                    )
                    updated = True

            if updated:
                update_count += 1
                print_update_count()

        session.flush()
        offset += limit

    if SHOW_PROGRESS:
        print("")


def postprocess_columns(session: Session) -> None:
    """
    At this step, we will
      - Add engine specific quotes to `expression` of physical columns
      - Tuck some extra metadata to `extra_json`
    """
    total = session.query(NewColumn).count()
    if not total:
        return

    def get_joined_tables(offset, limit):
        # Import aliased from sqlalchemy
        from sqlalchemy.orm import aliased

        # Create alias of NewColumn
        new_column_alias = aliased(NewColumn)
        # Get subquery and give it the alias "sl_colums_2"
        subquery = (
            session.query(new_column_alias)
            .offset(offset)
            .limit(limit)
            .subquery("sl_columns_2")
        )

        return (
            sa.join(
                subquery,
                NewColumn,
                # Use column id from subquery
                subquery.c.id == NewColumn.id,
            )
            .join(
                dataset_column_association_table,
                # Use column id from subquery
                dataset_column_association_table.c.column_id == subquery.c.id,
            )
            .join(
                NewDataset,
                NewDataset.id == dataset_column_association_table.c.dataset_id,
            )
            .join(
                dataset_table_association_table,
                # Join tables with physical datasets
                and_(
                    NewDataset.is_physical,
                    dataset_table_association_table.c.dataset_id == NewDataset.id,
                ),
                isouter=True,
            )
            .join(Database, Database.id == NewDataset.database_id)
            .join(
                TableColumn,
                # Use column uuid from subquery
                TableColumn.uuid == subquery.c.uuid,
                isouter=True,
            )
            .join(
                SqlMetric,
                # Use column uuid from subquery
                SqlMetric.uuid == subquery.c.uuid,
                isouter=True,
            )
        )

    offset = 0
    limit = 100000

    print(f">> Run postprocessing on {total:,} columns")

    update_count = 0

    def print_update_count():
        if SHOW_PROGRESS:
            print(
                f"   Will update {update_count} columns" + " " * 20,
                end="\r",
            )

    while offset < total:
        query = (
            select(
                # sorted alphabetically
                [
                    NewColumn.id.label("column_id"),
                    TableColumn.column_name,
                    NewColumn.changed_by_fk,
                    NewColumn.changed_on,
                    NewColumn.created_on,
                    NewColumn.description,
                    SqlMetric.d3format,
                    NewDataset.external_url,
                    NewColumn.extra_json,
                    NewColumn.is_dimensional,
                    NewColumn.is_filterable,
                    NewDataset.is_managed_externally,
                    NewColumn.is_physical,
                    SqlMetric.metric_type,
                    TableColumn.python_date_format,
                    Database.sqlalchemy_uri,
                    dataset_table_association_table.c.table_id,
                    func.coalesce(
                        TableColumn.verbose_name, SqlMetric.verbose_name
                    ).label("verbose_name"),
                    NewColumn.warning_text,
                ]
            )
            .select_from(get_joined_tables(offset, limit))
            .where(
                # pre-filter to columns with potential updates
                or_(
                    NewColumn.is_physical,
                    TableColumn.verbose_name.isnot(None),
                    TableColumn.verbose_name.isnot(None),
                    SqlMetric.verbose_name.isnot(None),
                    SqlMetric.d3format.isnot(None),
                    SqlMetric.metric_type.isnot(None),
                )
            )
        )

        start = offset + 1
        end = min(total, offset + limit)
        count = session.query(func.count()).select_from(query).scalar()
        print(f"   [Column {start:,} to {end:,}] {count:,} may be updated")

        physical_columns = []

        for (
            # sorted alphabetically
            column_id,
            column_name,
            changed_by_fk,
            changed_on,
            created_on,
            description,
            d3format,
            external_url,
            extra_json,
            is_dimensional,
            is_filterable,
            is_managed_externally,
            is_physical,
            metric_type,
            python_date_format,
            sqlalchemy_uri,
            table_id,
            verbose_name,
            warning_text,
        ) in session.execute(query):
            try:
                extra = json.loads(extra_json) if extra_json else {}
            except json.JSONDecodeError:
                extra = {}
            updated_extra = {**extra}
            updates = {}

            if is_managed_externally:
                updates["is_managed_externally"] = True
            if external_url:
                updates["external_url"] = external_url

            # update extra json
            for key, val in (
                {
                    "verbose_name": verbose_name,
                    "python_date_format": python_date_format,
                    "d3format": d3format,
                    "metric_type": metric_type,
                }
            ).items():
                # save the original val, including if it's `false`
                if val is not None:
                    updated_extra[key] = val

            if updated_extra != extra:
                updates["extra_json"] = json.dumps(updated_extra)

            # update expression for physical table columns
            if is_physical:
                if column_name and sqlalchemy_uri:
                    drivername = sqlalchemy_uri.split("://")[0]
                    if is_physical and drivername:
                        quoted_expression = get_identifier_quoter(drivername)(
                            column_name
                        )
                        if quoted_expression != column_name:
                            updates["expression"] = quoted_expression
                # duplicate physical columns for tables
                physical_columns.append(
                    dict(
                        created_on=created_on,
                        changed_on=changed_on,
                        changed_by_fk=changed_by_fk,
                        description=description,
                        expression=updates.get("expression", column_name),
                        external_url=external_url,
                        extra_json=updates.get("extra_json", extra_json),
                        is_aggregation=False,
                        is_dimensional=is_dimensional,
                        is_filterable=is_filterable,
                        is_managed_externally=is_managed_externally,
                        is_physical=True,
                        name=column_name,
                        table_id=table_id,
                        warning_text=warning_text,
                    )
                )

            if updates:
                session.execute(
                    sa.update(NewColumn)
                    .where(NewColumn.id == column_id)
                    .values(**updates)
                )
                update_count += 1
                print_update_count()

        if physical_columns:
            op.bulk_insert(NewColumn.__table__, physical_columns)

        session.flush()
        offset += limit

    if SHOW_PROGRESS:
        print("")

    print("   Assign table column relations...")
    insert_from_select(
        table_column_association_table,
        select([NewColumn.table_id, NewColumn.id.label("column_id")])
        .select_from(NewColumn)
        .where(and_(NewColumn.is_physical, NewColumn.table_id.isnot(None))),
    )


new_tables: sa.Table = [
    NewTable.__table__,
    NewDataset.__table__,
    NewColumn.__table__,
    table_column_association_table,
    dataset_column_association_table,
    dataset_table_association_table,
    dataset_user_association_table,
]


def reset_postgres_id_sequence(table: str) -> None:
    op.execute(
        f"""
        SELECT setval(
            pg_get_serial_sequence('{table}', 'id'),
            COALESCE(max(id) + 1, 1),
            false
        )
        FROM {table};
    """
    )


def upgrade() -> None:
    bind = op.get_bind()
    session: Session = Session(bind=bind)
    Base.metadata.drop_all(bind=bind, tables=new_tables)
    Base.metadata.create_all(bind=bind, tables=new_tables)

    copy_tables(session)
    copy_datasets(session)
    copy_columns(session)
    copy_metrics(session)
    session.commit()

    postprocess_columns(session)
    session.commit()

    postprocess_datasets(session)
    session.commit()

    # Table were created with the same uuids are datasets. They should
    # have different uuids as they are different entities.
    print(">> Assign new UUIDs to tables...")
    assign_uuids(NewTable, session)

    print(">> Drop intermediate columns...")
    # These columns are are used during migration, as datasets are independent of tables once created,
    # dataset columns also the same to table columns.
    with op.batch_alter_table(NewTable.__tablename__) as batch_op:
        batch_op.drop_column("sqlatable_id")
    with op.batch_alter_table(NewColumn.__tablename__) as batch_op:
        batch_op.drop_column("table_id")


def downgrade():
    Base.metadata.drop_all(bind=op.get_bind(), tables=new_tables)
