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

from typing import List

import sqlalchemy as sa
from flask_appbuilder import Model
from sqlalchemy.orm import backref, relationship
from sqlalchemy.schema import UniqueConstraint

from superset.columns.models import Column
from superset.models.core import Database
from superset.models.helpers import (
    AuditMixinNullable,
    ExtraJSONMixin,
    ImportExportMixin,
)

association_table = sa.Table(
    "sl_table_columns",
    Model.metadata,  # pylint: disable=no-member
    sa.Column("table_id", sa.ForeignKey("sl_tables.id")),
    sa.Column("column_id", sa.ForeignKey("sl_columns.id")),
)


class Table(Model, AuditMixinNullable, ExtraJSONMixin, ImportExportMixin):
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

    # We use ``sa.Text`` for these attributes because (1) in modern databases the
    # performance is the same as ``VARCHAR``[1] and (2) because some table names can be
    # **really** long (eg, Google Sheets URLs).
    #
    # [1] https://www.postgresql.org/docs/9.1/datatype-character.html
    catalog = sa.Column(sa.Text)
    schema = sa.Column(sa.Text)
    name = sa.Column(sa.Text)

    # The relationship between tables and columns is 1:n, but we use a many-to-many
    # association to differentiate between the relationship between datasets and
    # columns.
    columns: List[Column] = relationship(
        "Column", secondary=association_table, cascade="all, delete"
    )

    # Column is managed externally and should be read-only inside Superset
    is_managed_externally = sa.Column(sa.Boolean, nullable=False, default=False)
    external_url = sa.Column(sa.Text, nullable=True)
