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
"""reconvert legacy filters into adhoc

Revision ID: 78ee127d0d1d
Revises: c2acd2cf3df2
Create Date: 2019-11-06 15:23:26.497876

"""

# revision identifiers, used by Alembic.
revision = "78ee127d0d1d"
down_revision = "c2acd2cf3df2"

import copy  # noqa: E402
import logging  # noqa: E402

from alembic import op  # noqa: E402
from sqlalchemy import Column, Integer, Text  # noqa: E402
from sqlalchemy.ext.declarative import declarative_base  # noqa: E402

from superset import db  # noqa: E402
from superset.utils import json  # noqa: E402
from superset.utils.core import (  # noqa: E402
    convert_legacy_filters_into_adhoc,
)

Base = declarative_base()


class Slice(Base):
    __tablename__ = "slices"

    id = Column(Integer, primary_key=True)
    params = Column(Text)


def upgrade():
    bind = op.get_bind()
    session = db.Session(bind=bind)

    for slc in session.query(Slice).all():
        if slc.params:
            try:
                source = json.loads(slc.params)
                target = copy.deepcopy(source)
                convert_legacy_filters_into_adhoc(target)

                if source != target:
                    slc.params = json.dumps(target, sort_keys=True)
            except Exception as ex:
                logging.warn(ex)

    session.commit()
    session.close()


def downgrade():
    pass
