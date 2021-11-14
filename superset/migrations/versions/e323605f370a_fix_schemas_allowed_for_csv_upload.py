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
"""fix schemas_allowed_for_csv_upload

Revision ID: e323605f370a
Revises: 31b2a1039d4a
Create Date: 2021-08-02 16:39:45.329151

"""
import json
import logging

from alembic import op
from sqlalchemy import Column, Integer, Text
from sqlalchemy.ext.declarative import declarative_base

from superset import db

# revision identifiers, used by Alembic.
revision = "e323605f370a"
down_revision = "31b2a1039d4a"


Base = declarative_base()


class Database(Base):

    __tablename__ = "dbs"
    id = Column(Integer, primary_key=True)
    extra = Column(Text)


def upgrade():
    """
    Fix databases with ``schemas_allowed_for_csv_upload`` stored as string.
    """
    bind = op.get_bind()
    session = db.Session(bind=bind)

    for database in session.query(Database).all():
        try:
            extra = json.loads(database.extra)
        except json.decoder.JSONDecodeError as ex:
            logging.warning(str(ex))
            continue

        schemas_allowed_for_csv_upload = extra.get("schemas_allowed_for_csv_upload")
        if not isinstance(schemas_allowed_for_csv_upload, str):
            continue

        if schemas_allowed_for_csv_upload == "[]":
            extra["schemas_allowed_for_csv_upload"] = []
        else:
            extra["schemas_allowed_for_csv_upload"] = [
                schema.strip()
                for schema in schemas_allowed_for_csv_upload.split(",")
                if schema.strip()
            ]

        database.extra = json.dumps(extra)

    session.commit()
    session.close()


def downgrade():
    pass
