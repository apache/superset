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
"""remove dataset health check message

Revision ID: 134cea61c5e7
Revises: 301362411006
Create Date: 2021-04-07 07:21:27.324983

"""

# revision identifiers, used by Alembic.
revision = "134cea61c5e7"
down_revision = "301362411006"

import logging  # noqa: E402

from alembic import op  # noqa: E402
from sqlalchemy import Column, Integer, Text  # noqa: E402
from sqlalchemy.ext.declarative import declarative_base  # noqa: E402

from superset import db  # noqa: E402
from superset.utils import json  # noqa: E402

Base = declarative_base()


class SqlaTable(Base):
    __tablename__ = "tables"

    id = Column(Integer, primary_key=True)
    extra = Column(Text)


def upgrade():
    bind = op.get_bind()
    session = db.Session(bind=bind)

    for datasource in session.query(SqlaTable):
        if datasource.extra:
            try:
                extra = json.loads(datasource.extra)

                if extra and "health_check" in extra:
                    del extra["health_check"]
                    datasource.extra = json.dumps(extra) if extra else None
            except Exception as ex:
                logging.exception(ex)

    session.commit()
    session.close()


def downgrade():
    pass
