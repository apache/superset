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
"""adding slug to dash

Revision ID: 1a48a5411020
Revises: 289ce07647b
Create Date: 2015-12-04 09:42:16.973264

"""

# revision identifiers, used by Alembic.
revision = "1a48a5411020"
down_revision = "289ce07647b"

import sqlalchemy as sa
from alembic import op


def upgrade():
    op.add_column("dashboards", sa.Column("slug", sa.String(length=255), nullable=True))
    try:
        op.create_unique_constraint("idx_unique_slug", "dashboards", ["slug"])
    except:
        pass


def downgrade():
    op.drop_constraint(None, "dashboards", type_="unique")
    op.drop_column("dashboards", "slug")
