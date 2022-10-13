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
"""rename to schemas_allowed_for_file_upload in dbs.extra

Revision ID: 0ca9e5f1dacd
Revises: b92d69a6643c
Create Date: 2021-11-11 04:18:26.171851

"""

# revision identifiers, used by Alembic.
revision = "0ca9e5f1dacd"
down_revision = "b92d69a6643c"

import json
import logging

from alembic import op
from sqlalchemy import Column, Integer, Text
from sqlalchemy.ext.declarative import declarative_base

from superset import db

Base = declarative_base()


class Database(Base):

    __tablename__ = "dbs"
    id = Column(Integer, primary_key=True)
    extra = Column(Text)


def upgrade():
    bind = op.get_bind()
    session = db.Session(bind=bind)

    for database in session.query(Database).all():
        try:
            extra = json.loads(database.extra)
        except json.decoder.JSONDecodeError as ex:
            logging.warning(str(ex))
            continue

        if "schemas_allowed_for_csv_upload" in extra:
            extra["schemas_allowed_for_file_upload"] = extra.pop(
                "schemas_allowed_for_csv_upload"
            )

            database.extra = json.dumps(extra)

    session.commit()
    session.close()


def downgrade():
    bind = op.get_bind()
    session = db.Session(bind=bind)

    for database in session.query(Database).all():
        try:
            extra = json.loads(database.extra)
        except json.decoder.JSONDecodeError as ex:
            logging.warning(str(ex))
            continue

        if "schemas_allowed_for_file_upload" in extra:
            extra["schemas_allowed_for_csv_upload"] = extra.pop(
                "schemas_allowed_for_file_upload"
            )

            database.extra = json.dumps(extra)

    session.commit()
    session.close()
