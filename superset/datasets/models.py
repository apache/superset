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
Dataset model.

This model was introduced in SIP-68 (https://github.com/apache/superset/issues/14909),
and represents a "dataset" -- either a physical table or a virtual. In addition to a
dataset, new models for columns, metrics, and tables were also introduced.

These models are not fully implemented, and shouldn't be used yet.
"""

from typing import List

import sqlalchemy as sa
from flask_appbuilder import Model
from sqlalchemy.orm import relationship

from superset.columns.models import Column
from superset.models.helpers import (
    AuditMixinNullable,
    ExtraJSONMixin,
    ImportExportMixin,
)
from superset.tables.models import Table

column_association_table = sa.Table(
    "sl_dataset_columns",
    Model.metadata,  # pylint: disable=no-member
    sa.Column("dataset_id", sa.ForeignKey("sl_datasets.id")),
    sa.Column("column_id", sa.ForeignKey("sl_columns.id")),
)

table_association_table = sa.Table(
    "sl_dataset_tables",
    Model.metadata,  # pylint: disable=no-member
    sa.Column("dataset_id", sa.ForeignKey("sl_datasets.id")),
    sa.Column("table_id", sa.ForeignKey("sl_tables.id")),
)


class Dataset(Model, AuditMixinNullable, ExtraJSONMixin, ImportExportMixin):
    """
    A table/view in a database.
    """

    __tablename__ = "sl_datasets"

    id = sa.Column(sa.Integer, primary_key=True)

    # A temporary column, used for shadow writing to the new model. Once the ``SqlaTable``
    # model has been deleted this column can be removed.
    sqlatable_id = sa.Column(sa.Integer, nullable=True, unique=True)

    # We use ``sa.Text`` for these attributes because (1) in modern databases the
    # performance is the same as ``VARCHAR``[1] and (2) because some table names can be
    # **really** long (eg, Google Sheets URLs).
    #
    # [1] https://www.postgresql.org/docs/9.1/datatype-character.html
    name = sa.Column(sa.Text)

    expression = sa.Column(sa.Text)

    # n:n relationship
    tables: List[Table] = relationship("Table", secondary=table_association_table)

    # The relationship between datasets and columns is 1:n, but we use a many-to-many
    # association to differentiate between the relationship between tables and columns.
    columns: List[Column] = relationship(
        "Column", secondary=column_association_table, cascade="all, delete"
    )

    # Does the dataset point directly to a ``Table``?
    is_physical = sa.Column(sa.Boolean, default=False)

    # Column is managed externally and should be read-only inside Superset
    is_managed_externally = sa.Column(sa.Boolean, nullable=False, default=False)
    external_url = sa.Column(sa.Text, nullable=True)
