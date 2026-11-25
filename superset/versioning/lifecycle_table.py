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
"""Immutable archive-time dashboard membership, registered on shared metadata."""

import sqlalchemy as sa
from flask_appbuilder import Model
from sqlalchemy_utils import UUIDType

version_chart_archive_scope_table = sa.Table(
    "version_chart_archive_scope",
    Model.metadata,  # pylint: disable=no-member
    sa.Column("id", UUIDType(binary=True), primary_key=True),
    # The migration owns the FK to Continuum's dynamically registered table.
    sa.Column("transaction_id", sa.BigInteger, nullable=False),
    sa.Column("chart_id", sa.Integer, nullable=False),
    sa.Column("chart_uuid", UUIDType(binary=True), nullable=False),
    sa.Column("dashboard_id", sa.Integer, nullable=False),
    sa.Column("dashboard_uuid", UUIDType(binary=True), nullable=False),
    sa.UniqueConstraint(
        "transaction_id",
        "chart_uuid",
        "dashboard_id",
        "dashboard_uuid",
        name="uq_chart_archive_scope_identity",
    ),
    sa.Index(
        "ix_chart_archive_scope_dashboard",
        "dashboard_id",
        "dashboard_uuid",
        "transaction_id",
    ),
    sa.Index("ix_chart_archive_scope_chart", "chart_id", "transaction_id"),
    extend_existing=True,
)
