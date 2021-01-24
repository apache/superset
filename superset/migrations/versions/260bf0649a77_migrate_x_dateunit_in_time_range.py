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
"""migrate [x dateunit] to [x dateunit ago/later]

Revision ID: 260bf0649a77
Revises: c878781977c6
Create Date: 2021-01-23 16:25:14.496774

"""

# revision identifiers, used by Alembic.
revision = "260bf0649a77"
down_revision = "c878781977c6"

import json
import re

import sqlalchemy as sa
from alembic import op
from sqlalchemy import Column, Integer, or_, Text
from sqlalchemy.dialects.mysql.base import MySQLDialect
from sqlalchemy.dialects.sqlite.base import SQLiteDialect
from sqlalchemy.exc import OperationalError
from sqlalchemy.ext.declarative import declarative_base

from superset import db
from superset.utils.date_parser import DateRangeMigration

Base = declarative_base()


class Slice(Base):
    __tablename__ = "slices"

    id = Column(Integer, primary_key=True)
    slice_name = Column(Text)
    params = Column(Text)


def upgrade():
    bind = op.get_bind()
    session = db.Session(bind=bind)
    x_dateunit_in_since = DateRangeMigration.x_dateunit_in_since
    x_dateunit_in_until = DateRangeMigration.x_dateunit_in_until

    if isinstance(bind.dialect, SQLiteDialect):
        # The REGEXP operator is a special syntax for the regexp() user function.
        # https://www.sqlite.org/lang_expr.html#regexp
        to_lower = sa.func.LOWER
        where_clause = or_(
            sa.func.REGEXP(to_lower(Slice.params), x_dateunit_in_since),
            sa.func.REGEXP(to_lower(Slice.params), x_dateunit_in_until),
        )
    elif isinstance(bind.dialect, MySQLDialect):
        to_lower = sa.func.LOWER
        where_clause = or_(
            to_lower(Slice.params).op("REGEXP")(x_dateunit_in_since),
            to_lower(Slice.params).op("REGEXP")(x_dateunit_in_until),
        )
    else:
        # isinstance(bind.dialect, PGDialect):
        where_clause = or_(
            Slice.params.op("~*")(x_dateunit_in_since),
            Slice.params.op("~*")(x_dateunit_in_until),
        )

    try:
        slices = session.query(Slice).filter(where_clause).all()
        sep = " : "
        pattern = DateRangeMigration.x_dateunit
        for idx, slc in enumerate(slices):
            print(f"Upgrading ({idx + 1}/{len(slices)}): {slc.slice_name}#{slc.id}")
            params = json.loads(slc.params)
            time_range = params["time_range"]
            if sep in time_range:
                start, end = time_range.split(sep)
                if re.match(pattern, start):
                    start = f"{start.strip()} ago"
                if re.match(pattern, end):
                    end = f"{end.strip()} later"
                params["time_range"] = f"{start}{sep}{end}"

                slc.params = json.dumps(params, sort_keys=True, indent=4)
                session.commit()
    except OperationalError:
        pass

    session.close()


def downgrade():
    pass
