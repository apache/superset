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
from typing import List

import sqlalchemy as sa
from flask_appbuilder import Model
from sqlalchemy.orm import backref, relationship

from superset.models.core import Database
from superset.models.helpers import (
    AuditMixinNullable,
    ExtraJSONMixin,
    ImportExportMixin,
)


class SSHTunnelConfiguration(
    Model, AuditMixinNullable, ExtraJSONMixin, ImportExportMixin
):
    """
    A table/view in a database.
    """

    __tablename__ = "sl_datasets"

    id = sa.Column(sa.Integer, primary_key=True)
    database_id = sa.Column(sa.Integer, sa.ForeignKey("dbs.id"), nullable=False)
    database: Database = relationship(
        "Database",
        backref=backref("datasets", cascade="all, delete-orphan"),
        foreign_keys=[database_id],
    )
