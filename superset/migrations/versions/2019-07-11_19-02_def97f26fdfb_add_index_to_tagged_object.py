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
"""Add index to tagged_object

Revision ID: def97f26fdfb
Revises: d6ffdf31bdd4
Create Date: 2019-07-11 19:02:38.768324

"""

# revision identifiers, used by Alembic.
revision = "def97f26fdfb"
down_revision = "190188938582"

from alembic import op  # noqa: E402


def upgrade():
    op.create_index(
        op.f("ix_tagged_object_object_id"), "tagged_object", ["object_id"], unique=False
    )


def downgrade():
    op.drop_index(op.f("ix_tagged_object_object_id"), table_name="tagged_object")
