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
"""
Table model.

This model was introduced in SIP-68 (https://github.com/apache/superset/issues/14909),
and represents a "table" in a given database -- either a physical table or a view. In
addition to a table, new models for columns, metrics, and datasets were also introduced.

These models are not fully implemented, and shouldn't be used yet.
"""

from collections.abc import Iterable
from typing import Any, Optional, TYPE_CHECKING

import sqlalchemy as sa
from flask_appbuilder import Model
from sqlalchemy import inspect
from sqlalchemy.orm import backref, relationship, Session
from sqlalchemy.schema import UniqueConstraint
from sqlalchemy.sql import and_, or_

from superset.columns.models import Column
from superset.connectors.sqla.utils import get_physical_table_metadata
from superset.models.core import Database
from superset.models.helpers import (
    AuditMixinNullable,
    ExtraJSONMixin,
    ImportExportMixin,
)
from superset.sql_parse import Table as TableName
from superset.superset_typing import ResultSetColumnType

if TYPE_CHECKING:
    from superset.datasets.models import Dataset

table_column_association_table = sa.Table(
    "sl_table_columns",
    Model.metadata,  # pylint: disable=no-member
    sa.Column(
        "table_id",
        sa.ForeignKey("sl_tables.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    sa.Column(
        "column_id",
        sa.ForeignKey("sl_columns.id", ondelete="CASCADE"),
        primary_key=True,
    ),
)


class Table(AuditMixinNullable, ExtraJSONMixin, ImportExportMixin, Model):
    """
    A table/view in a database.
    """

    __tablename__ = "sl_tables"

    # Note this uniqueness constraint is not part of the physical schema, i.e., it does
    # not exist in the migrations. The reason it does not physically exist is MySQL,
    # PostgreSQL, etc. have a different interpretation of uniqueness when it comes to NULL
    # which is problematic given the catalog and schema are optional.
    __table_args__ = (UniqueConstraint("database_id", "catalog", "schema", "name"),)

    id = sa.Column(sa.Integer, primary_key=True)
    database_id = sa.Column(sa.Integer, sa.ForeignKey("dbs.id"), nullable=False)
    database: Database = relationship(
        "Database",
        # TODO (betodealmeida): rename the backref to ``tables`` once we get rid of the
        # old models.
        backref=backref("new_tables", cascade="all, delete-orphan"),
        foreign_keys=[database_id],
    )
    # The relationship between datasets and columns is 1:n, but we use a
    # many-to-many association table to avoid adding two mutually exclusive
    # columns(dataset_id and table_id) to Column
    columns: list[Column] = relationship(
        "Column",
        secondary=table_column_association_table,
        cascade="all, delete-orphan",
        single_parent=True,
        # backref is needed for session to skip detaching `dataset` if only `column`
        # is loaded.
        backref="tables",
    )
    datasets: list["Dataset"]  # will be populated by Dataset.tables backref

    # We use ``sa.Text`` for these attributes because (1) in modern databases the
    # performance is the same as ``VARCHAR``[1] and (2) because some table names can be
    # **really** long (eg, Google Sheets URLs).
    #
    # [1] https://www.postgresql.org/docs/9.1/datatype-character.html
    catalog = sa.Column(sa.Text)
    schema = sa.Column(sa.Text)
    name = sa.Column(sa.Text)

    # Column is managed externally and should be read-only inside Superset
    is_managed_externally = sa.Column(sa.Boolean, nullable=False, default=False)
    external_url = sa.Column(sa.Text, nullable=True)

    @property
    def fullname(self) -> str:
        return str(TableName(table=self.name, schema=self.schema, catalog=self.catalog))

    def __repr__(self) -> str:
        return f"<Table id={self.id} database_id={self.database_id} {self.fullname}>"

    def sync_columns(self) -> None:
        """Sync table columns with the database. Keep metadata for existing columns"""
        try:
            column_metadata = get_physical_table_metadata(
                self.database, self.name, self.schema
            )
        except Exception:  # pylint: disable=broad-except
            column_metadata = []

        existing_columns = {column.name: column for column in self.columns}
        quote_identifier = self.database.quote_identifier

        def update_or_create_column(column_meta: ResultSetColumnType) -> Column:
            column_name: str = column_meta["column_name"]
            if column_name in existing_columns:
                column = existing_columns[column_name]
            else:
                column = Column(name=column_name)
            column.type = column_meta["type"]
            column.is_temporal = column_meta["is_dttm"]
            column.expression = quote_identifier(column_name)
            column.is_aggregation = False
            column.is_physical = True
            column.is_spatial = False
            column.is_partition = False  # TODO: update with accurate is_partition
            return column

        self.columns = [update_or_create_column(col) for col in column_metadata]

    @staticmethod
    def bulk_load_or_create(
        database: Database,
        table_names: Iterable[TableName],
        default_schema: Optional[str] = None,
        sync_columns: Optional[bool] = False,
        default_props: Optional[dict[str, Any]] = None,
    ) -> list["Table"]:
        """
        Load or create multiple Table instances.
        """
        if not table_names:
            return []

        if not database.id:
            raise Exception(  # pylint: disable=broad-exception-raised
                "Database must be already saved to metastore"
            )

        default_props = default_props or {}
        session: Session = inspect(database).session
        # load existing tables
        predicate = or_(
            *[
                and_(
                    Table.database_id == database.id,
                    Table.schema == (table.schema or default_schema),
                    Table.name == table.table,
                )
                for table in table_names
            ]
        )
        all_tables = session.query(Table).filter(predicate).order_by(Table.id).all()

        # add missing tables and pull its columns
        existing = {(table.schema, table.name) for table in all_tables}
        for table in table_names:
            schema = table.schema or default_schema
            name = table.table
            if (schema, name) not in existing:
                new_table = Table(
                    database=database,
                    database_id=database.id,
                    name=name,
                    schema=schema,
                    catalog=None,
                    **default_props,
                )
                if sync_columns:
                    new_table.sync_columns()
                all_tables.append(new_table)
                existing.add((schema, name))
                session.add(new_table)

        return all_tables
