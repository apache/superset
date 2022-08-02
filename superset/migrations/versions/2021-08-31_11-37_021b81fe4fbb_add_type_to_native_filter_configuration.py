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
"""Add type to native filter configuration

Revision ID: 021b81fe4fbb
Revises: 07071313dd52
Create Date: 2021-08-31 11:37:40.604081

"""

# revision identifiers, used by Alembic.
revision = "021b81fe4fbb"
down_revision = "07071313dd52"

import json
import logging

import sqlalchemy as sa
from alembic import op
from sqlalchemy.ext.declarative.api import declarative_base

from superset import db

Base = declarative_base()

logger = logging.getLogger("alembic")


class Dashboard(Base):
    __tablename__ = "dashboards"
    id = sa.Column(sa.Integer, primary_key=True)
    json_metadata = sa.Column(sa.Text)


def upgrade():
    logger.info("[AddTypeToNativeFilter] Starting upgrade")
    bind = op.get_bind()
    session = db.Session(bind=bind)

    for dashboard in session.query(Dashboard).all():
        logger.info("[AddTypeToNativeFilter] Updating Dashboard<pk:%s> ", dashboard.id)

        if not dashboard.json_metadata:
            logger.info(
                "[AddTypeToNativeFilter] Skipping Dashboard<pk:%s> json_metadata is %s",
                dashboard.id,
                dashboard.json_metadata,
            )
            continue
        try:
            json_meta = json.loads(dashboard.json_metadata)
        except:
            logger.exception("[AddTypeToNativeFilter] Error loading json_metadata")
            continue

        if "native_filter_configuration" not in json_meta:
            logger.info(
                "[AddTypeToNativeFilter] Skipping Dashboard<pk:%s>."
                " native_filter_configuration not found.",
                dashboard.id,
            )
            continue

        for native_filter in json_meta["native_filter_configuration"]:
            native_filter["type"] = "NATIVE_FILTER"
        dashboard.json_metadata = json.dumps(json_meta)

    session.commit()
    session.close()
    logger.info("[AddTypeToNativeFilter] Done!")


def downgrade():
    logger.info("[RemoveTypeToNativeFilter] Starting downgrade")
    bind = op.get_bind()
    session = db.Session(bind=bind)

    for dashboard in session.query(Dashboard).all():
        logger.info(
            "[RemoveTypeToNativeFilter] Updating Dashobard<pk:%s>",
            dashboard.id,
        )
        if not dashboard.json_metadata:
            logger.info(
                "[RemoveTypeToNativeFilter] Skipping Dashboard<pk:%s> json_metadata is %s",
                dashboard.id,
                dashboard.json_metadata,
            )
            continue
        try:
            json_meta = json.loads(dashboard.json_metadata)
        except:
            logger.exception("[RemoveTypeToNativeFilter] Error loading json_metadata")
            continue

        if "native_filter_configuration" not in json_meta:
            logger.info(
                "[RemoveTypeToNativeFilter] Skipping Dashboard<pk:%s>."
                " native_filter_configuration not found.",
                dashboard.id,
            )
            continue
        for native_filter in json_meta["native_filter_configuration"]:
            native_filter.pop("type", None)
        dashboard.json_metadata = json.dumps(json_meta)
    session.commit()
    session.close()
    logger.info("[RemoveTypeToNativeFilter] Done!")
