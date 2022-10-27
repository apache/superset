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
"""create_ssh_tunnel_credentials_tbl

Revision ID: f3c2d8ec8595
Revises: deb4c9d4a4ef
Create Date: 2022-10-20 10:48:08.722861

"""

# revision identifiers, used by Alembic.
revision = "f3c2d8ec8595"
down_revision = "deb4c9d4a4ef"

from uuid import uuid4

import sqlalchemy as sa
from alembic import op
from sqlalchemy_utils import EncryptedType, UUIDType

from superset import app

app_config = app.config


def upgrade():
    op.create_table(
        "ssh_tunnel_credentials",
        # AuditMixinNullable
        sa.Column("created_on", sa.DateTime(), nullable=True),
        sa.Column("changed_on", sa.DateTime(), nullable=True),
        sa.Column("created_by_fk", sa.Integer(), nullable=True),
        sa.Column("changed_by_fk", sa.Integer(), nullable=True),
        # ExtraJSONMixin
        sa.Column("extra_json", sa.Text(), nullable=True),
        # ImportExportMixin
        sa.Column("uuid", UUIDType(binary=True), primary_key=False, default=uuid4),
        # SSHTunnelCredentials
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("database_id", sa.INTEGER(), sa.ForeignKey("dbs.id"), nullable=True),
        sa.Column("server_address", EncryptedType(sa.String, app_config["SECRET_KEY"])),
        sa.Column("server_port", EncryptedType(sa.String, app_config["SECRET_KEY"])),
        sa.Column(
            "username",
            EncryptedType(sa.String, app_config["SECRET_KEY"]),
        ),
        sa.Column(
            "password",
            EncryptedType(sa.String, app_config["SECRET_KEY"]),
            nullable=True,
        ),
        sa.Column(
            "private_key",
            EncryptedType(sa.String, app_config["SECRET_KEY"]),
            nullable=True,
        ),
        sa.Column(
            "private_key_password",
            EncryptedType(sa.String, app_config["SECRET_KEY"]),
            nullable=True,
        ),
    )


def downgrade():
    op.drop_table("ssh_tunnel_credentials")
