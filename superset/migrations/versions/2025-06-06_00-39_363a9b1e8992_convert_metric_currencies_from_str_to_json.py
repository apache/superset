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
"""convert_metric_currencies_from_str_to_json

Revision ID: 363a9b1e8992
Revises: f1edd4a4d4f2
Create Date: 2025-06-06 00:39:00.107746

"""

import json
import logging

from sqlalchemy import Column, Integer, JSON, String
from sqlalchemy.ext.declarative import declarative_base

from superset import db
from superset.migrations.shared.utils import paginated_update

logger = logging.getLogger("alembic")
logger.setLevel(logging.INFO)

# revision identifiers, used by Alembic.
revision = "363a9b1e8992"
down_revision = "f1edd4a4d4f2"

Base = declarative_base()


class SqlMetric(Base):
    __tablename__ = "sql_metrics"

    id = Column(Integer, primary_key=True)
    metric_name = Column(String(512))
    currency = Column(JSON)


def upgrade():
    currency_configs = db.session.query(SqlMetric).filter(
        SqlMetric.currency.isnot(None)
    )
    for metric in paginated_update(
        currency_configs,
        lambda current, total: logger.info((f"Upgrading {current}/{total} metrics")),
    ):
        while True:
            if isinstance(metric.currency, str):
                try:
                    metric.currency = json.loads(metric.currency)
                except Exception as e:
                    logger.error(
                        f"Error loading metric {metric.metric_name} as json: {e}"
                    )
                    metric.currency = {}
                    break
            else:
                break


def downgrade():
    """
    The downgrade just dumps the metric as a str. Might not retrieve the old value,
    but the syntax was a bug and shouldn't be preserved either way.
    """
    currency_configs = db.session.query(SqlMetric).filter(
        SqlMetric.currency.isnot(None)
    )
    for metric in paginated_update(
        currency_configs,
        lambda current, total: logger.info((f"Downgrading {current}/{total} metrics")),
    ):
        try:
            metric.currency = json.dumps(metric.currency)
        except Exception as e:
            logger.error(f"Error dumping metric {metric.metric_name} to string: {e}")
            metric.currency = {}
