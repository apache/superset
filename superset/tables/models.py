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

import uuid
from typing import List, TYPE_CHECKING

import sqlalchemy as sa
from flask_appbuilder import Model
from sqlalchemy.orm import backref, relationship
from sqlalchemy_utils import UUIDType

from superset.columns.models import Column

if TYPE_CHECKING:
    from superset.models.core import Database


association_table = sa.Table(
    "table_columns",
    Model.metadata,  # pylint: disable=no-member
    sa.Column("table_id", sa.ForeignKey("relations.id")),
    sa.Column("column_id", sa.ForeignKey("columns.id")),
)


class Table(Model):  # pylint: disable=too-few-public-methods
    """
    A table/view in a database.
    """

    # We use the name "relations" because it represents both tables and views; but
    # also because "tables" is already taken by the deprecated ``SqlaTable`` class.
    __tablename__ = "relations"

    id = sa.Column(sa.Integer, primary_key=True)
    uuid = sa.Column(
        UUIDType(binary=True), primary_key=False, unique=True, default=uuid.uuid4,
    )

    database_id = sa.Column(sa.Integer, sa.ForeignKey("dbs.id"), nullable=False)
    database: "Database" = relationship(
        "Database",
        backref=backref("relations", cascade="all, delete-orphan"),
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
    columns: List[Column] = relationship("Column", secondary=association_table)
