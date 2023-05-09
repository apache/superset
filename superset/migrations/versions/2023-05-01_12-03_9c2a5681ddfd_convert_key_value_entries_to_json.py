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
"""convert key-value entries to json

Revision ID: 9c2a5681ddfd
Revises: 7e67aecbf3f1
Create Date: 2023-05-01 12:03:17.079862

"""

# revision identifiers, used by Alembic.
revision = "9c2a5681ddfd"
down_revision = "7e67aecbf3f1"

import io
import json
import pickle

from alembic import op
from sqlalchemy import Column, Integer, LargeBinary, String
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import Session

from superset import db
from superset.migrations.shared.utils import paginated_update

Base = declarative_base()
VALUE_MAX_SIZE = 2**24 - 1
RESOURCES_TO_MIGRATE = ("app", "dashboard_permalink", "explore_permalink")


class RestrictedUnpickler(pickle.Unpickler):
    def find_class(self, module, name):
        if not (module == "superset.utils.core" and name == "DatasourceType"):
            raise pickle.UnpicklingError(f"Unpickling of {module}.{name} is forbidden")

        return super().find_class(module, name)


class KeyValueEntry(Base):
    __tablename__ = "key_value"
    id = Column(Integer, primary_key=True)
    resource = Column(String(32), nullable=False)
    value = Column(LargeBinary(length=VALUE_MAX_SIZE), nullable=False)


def upgrade():
    bind = op.get_bind()
    session: Session = db.Session(bind=bind)
    truncated_count = 0
    for entry in paginated_update(
        session.query(KeyValueEntry).filter(
            KeyValueEntry.resource.in_(RESOURCES_TO_MIGRATE)
        )
    ):
        try:
            value = RestrictedUnpickler(io.BytesIO(entry.value)).load() or {}
        except pickle.UnpicklingError as ex:
            if str(ex) == "pickle data was truncated":
                # make truncated values that were created prior to #20385 an empty
                # dict so that downgrading will work properly.
                truncated_count += 1
                value = {}
            else:
                raise

        entry.value = bytes(json.dumps(value), encoding="utf-8")

    if truncated_count:
        print(f"Replaced {truncated_count} corrupted values with an empty value")


def downgrade():
    bind = op.get_bind()
    session: Session = db.Session(bind=bind)
    for entry in paginated_update(
        session.query(KeyValueEntry).filter(
            KeyValueEntry.resource.in_(RESOURCES_TO_MIGRATE)
        ),
    ):
        value = json.loads(entry.value) or {}
        entry.value = pickle.dumps(value)
