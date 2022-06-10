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
"""Add extra column to SavedQuery

Licensed to the Apache Software Foundation (ASF) under one or more
contributor license agreements.  See the NOTICE file distributed with
this work for additional information regarding copyright ownership.
The ASF licenses this file to You under the Apache License, Version 2.0
(the "License"); you may not use this file except in compliance with
the License.  You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

Revision ID: a33a03f16c4a
Revises: fb13d49b72f9
Create Date: 2019-01-14 16:00:26.344439

"""

# revision identifiers, used by Alembic.
revision = "a33a03f16c4a"
down_revision = "fb13d49b72f9"

import sqlalchemy as sa
from alembic import op


def upgrade():
    with op.batch_alter_table("saved_query") as batch_op:
        batch_op.add_column(sa.Column("extra_json", sa.Text(), nullable=True))


def downgrade():
    with op.batch_alter_table("saved_query") as batch_op:
        batch_op.drop_column("extra_json")
