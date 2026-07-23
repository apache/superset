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
"""remove_legacy_plugins_5_0

Revision ID: d482d51c15ca
Revises: eb1c288c71c4
Create Date: 2025-01-08 09:34:57.533332

"""

from alembic import op

from superset import db
from superset.migrations.shared.migrate_viz.processors import (
    MigrateAreaChart,
    MigrateBarChart,
    MigrateDistBarChart,
    MigrateHeatmapChart,
    MigrateHistogramChart,
    MigrateLineChart,
    MigrateSankey,
)

# revision identifiers, used by Alembic.
revision = "d482d51c15ca"
down_revision = "eb1c288c71c4"


def upgrade():
    bind = op.get_bind()
    session = db.Session(bind=bind)
    try:
        MigrateAreaChart.upgrade(session)
        MigrateBarChart.upgrade(session)
        MigrateDistBarChart.upgrade(session)
        MigrateHeatmapChart.upgrade(session)
        MigrateHistogramChart.upgrade(session)
        MigrateLineChart.upgrade(session)
        MigrateSankey.upgrade(session)
        session.commit()
    except Exception as e:
        session.rollback()
        raise Exception(f"Error upgrading legacy viz types: {e}") from e
    finally:
        session.close()


def downgrade():
    bind = op.get_bind()
    session = db.Session(bind=bind)
    try:
        MigrateAreaChart.downgrade(session)
        MigrateBarChart.downgrade(session)
        MigrateDistBarChart.downgrade(session)
        MigrateHeatmapChart.downgrade(session)
        MigrateHistogramChart.downgrade(session)
        MigrateLineChart.downgrade(session)
        MigrateSankey.downgrade(session)
        session.commit()
    except Exception as e:
        session.rollback()
        raise Exception(f"Error downgrading legacy viz types: {e}") from e
    finally:
        session.close()
