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
"""cross-filter-global-scoping

Revision ID: 4ea966691069
Revises: 7e67aecbf3f1
Create Date: 2023-05-11 12:41:38.095717

"""

# revision identifiers, used by Alembic.
revision = "4ea966691069"
down_revision = "7e67aecbf3f1"

import copy  # noqa: E402
import logging  # noqa: E402

import sqlalchemy as sa  # noqa: E402
from alembic import op  # noqa: E402
from sqlalchemy.ext.declarative import declarative_base  # noqa: E402

from superset import db  # noqa: E402
from superset.migrations.shared.utils import paginated_update  # noqa: E402
from superset.utils import json  # noqa: E402

Base = declarative_base()
logger = logging.getLogger(__name__)


class Dashboard(Base):
    __tablename__ = "dashboards"

    id = sa.Column(sa.Integer, primary_key=True)
    json_metadata = sa.Column(sa.Text)


def upgrade():
    bind = op.get_bind()
    session = db.Session(bind=bind)
    for dashboard in paginated_update(session.query(Dashboard)):
        #
        # This is needed in order to work-around a potential issue
        # that some folks may have run into where their json_metadata's
        # were left partially upgraded.
        #
        needs_upgrade = True
        try:
            json_metadata = json.loads(dashboard.json_metadata or "{}")
            new_chart_configuration = {}
            for config in json_metadata.get("chart_configuration", {}).values():
                if not isinstance(config, dict):
                    continue
                chart_id = int(config.get("id", 0))
                scope = config.get("crossFilters", {}).get("scope", {})

                # Skip any JSON's that have the "new" structure
                if not isinstance(scope, dict):
                    needs_upgrade = False
                    continue

                excluded = [
                    int(excluded_id) for excluded_id in scope.get("excluded", [])
                ]
                new_chart_configuration[chart_id] = copy.deepcopy(config)
                new_chart_configuration[chart_id]["id"] = chart_id
                new_chart_configuration[chart_id]["crossFilters"]["scope"][
                    "excluded"
                ] = excluded
                if scope.get("rootPath") == ["ROOT_ID"] and excluded == [chart_id]:
                    new_chart_configuration[chart_id]["crossFilters"]["scope"] = (
                        "global"
                    )

            json_metadata["chart_configuration"] = new_chart_configuration

            if needs_upgrade:
                dashboard.json_metadata = json.dumps(json_metadata)

        except Exception:
            logger.exception("Failed to run up migration")
            raise

    session.commit()
    session.close()


def downgrade():
    bind = op.get_bind()
    session = db.Session(bind=bind)

    for dashboard in paginated_update(session.query(Dashboard)):
        try:
            json_metadata = json.loads(dashboard.json_metadata)
            new_chart_configuration = {}
            for config in json_metadata.get("chart_configuration", {}).values():
                if not isinstance(config, dict):
                    continue
                chart_id = config.get("id")
                if chart_id is None:
                    continue
                scope = config.get("crossFilters", {}).get("scope", {})
                new_chart_configuration[chart_id] = copy.deepcopy(config)
                if scope in ("global", "Global"):
                    new_chart_configuration[chart_id]["crossFilters"]["scope"] = {
                        "rootPath": ["ROOT_ID"],
                        "excluded": [chart_id],
                    }

            json_metadata["chart_configuration"] = new_chart_configuration

            if "global_chart_configuration" in json_metadata:
                del json_metadata["global_chart_configuration"]

            dashboard.json_metadata = json.dumps(json_metadata)

        except Exception:
            logger.exception("Failed to run down migration")
            raise

    session.commit()
    session.close()
