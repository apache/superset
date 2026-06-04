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
"""drop postgres enum constrains for tags

Revision ID: 07f9a902af1b
Revises: b5ea9d343307
Create Date: 2023-03-29 20:30:10.214951

"""

# revision identifiers, used by Alembic.
revision = "07f9a902af1b"
down_revision = "b5ea9d343307"

from alembic import op  # noqa: E402
from sqlalchemy.dialects import postgresql  # noqa: E402


def upgrade():
    conn = op.get_bind()
    if isinstance(conn.dialect, postgresql.dialect):
        conn.execute(
            'ALTER TABLE "tagged_object" ALTER COLUMN "object_type" TYPE VARCHAR'
        )
        conn.execute('ALTER TABLE "tag" ALTER COLUMN "type" TYPE VARCHAR')
        conn.execute("DROP TYPE IF EXISTS objecttypes")
        conn.execute("DROP TYPE IF EXISTS tagtypes")


def downgrade():
    # Leaving the column type as VARCHAR in case the column contains values that
    # do not comply with the previous enum type
    pass
