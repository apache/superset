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
"""add certificate to dbs

Revision ID: b5998378c225
Revises: 72428d1ea401
Create Date: 2020-03-25 10:49:10.883065

"""

# revision identifiers, used by Alembic.
revision = "b5998378c225"
down_revision = "72428d1ea401"


import sqlalchemy as sa  # noqa: E402
from alembic import op  # noqa: E402


def upgrade():
    kwargs: dict[str, str] = {}
    bind = op.get_bind()  # noqa: F841
    op.add_column(
        "dbs",
        sa.Column("server_cert", sa.LargeBinary(), nullable=True, **kwargs),
    )


def downgrade():
    op.drop_column("dbs", "server_cert")
