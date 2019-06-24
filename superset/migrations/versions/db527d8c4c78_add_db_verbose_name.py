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
"""Add verbose name to DruidCluster and Database

Revision ID: db527d8c4c78
Revises: b318dfe5fb6c
Create Date: 2017-03-16 18:10:57.193035

"""

# revision identifiers, used by Alembic.
revision = "db527d8c4c78"
down_revision = "b318dfe5fb6c"

from alembic import op
import logging
import sqlalchemy as sa


def upgrade():
    op.add_column(
        "clusters", sa.Column("verbose_name", sa.String(length=250), nullable=True)
    )
    op.add_column(
        "dbs", sa.Column("verbose_name", sa.String(length=250), nullable=True)
    )

    try:
        op.create_unique_constraint(None, "dbs", ["verbose_name"])
        op.create_unique_constraint(None, "clusters", ["verbose_name"])
    except Exception as e:
        logging.info("Constraint not created, expected when using sqlite")


def downgrade():
    try:
        op.drop_column("dbs", "verbose_name")
        op.drop_column("clusters", "verbose_name")
    except Exception as e:
        logging.exception(e)
