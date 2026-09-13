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
"""migrate-sunburst-chart

Revision ID: a32e0c4d8646
Revises: 59a1450b3c10
Create Date: 2023-12-22 14:41:43.638321

"""

# revision identifiers, used by Alembic.
revision = "a32e0c4d8646"
down_revision = "59a1450b3c10"

from alembic import op  # noqa: E402

from superset import db  # noqa: E402
from superset.migrations.shared.migrate_viz import MigrateSunburst  # noqa: E402


def upgrade():
    bind = op.get_bind()
    session = db.Session(bind=bind)
    MigrateSunburst.upgrade(session)


def downgrade():
    bind = op.get_bind()
    session = db.Session(bind=bind)
    MigrateSunburst.downgrade(session)
