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
"""strip metricSqlExpressions from ag_grid_table params

Before PR #41555 the AG Grid table plugin leaked ``metricSqlExpressions``
(a mapping of every datasource metric/column name to its SQL expression) into
``extra_form_data`` on every filter interaction, which was then serialised into
the ``params`` and ``query_context`` columns on save.  For datasources with
many metrics this bloated each chart record by hundreds of MB.

This migration strips the field from existing rows so those records are no
longer loaded eagerly on every dashboard request.

Revision ID: d24e6b0a9c7f
Revises: 8f3a1b2c4d5e
Create Date: 2026-06-30 00:00:00.000000

"""

from alembic import op
from sqlalchemy import Column, Integer, String, Text
from sqlalchemy.orm import declarative_base

from superset import db
from superset.utils import json

# revision identifiers, used by Alembic.
revision = "d24e6b0a9c7f"
down_revision = "8f3a1b2c4d5e"

Base = declarative_base()

_FIELD = "metricSqlExpressions"
_VIZ_TYPE = "ag_grid_table"


class Slice(Base):
    __tablename__ = "slices"
    id = Column(Integer, primary_key=True)
    viz_type = Column(String(250))
    params = Column(Text)
    query_context = Column(Text)


def _strip_params(slc: Slice) -> bool:
    """Remove _FIELD from extra_form_data in params. Returns True if changed."""
    if not slc.params:
        return False
    try:
        params = json.loads(slc.params)
    except Exception:
        return False

    extra = params.get("extra_form_data", {})
    if _FIELD not in extra:
        return False

    del extra[_FIELD]
    params["extra_form_data"] = extra
    slc.params = json.dumps(params)
    return True


def _strip_query_context(slc: Slice) -> bool:
    """Remove _FIELD from query_context.form_data.extra_form_data."""
    if not slc.query_context:
        return False
    try:
        qc = json.loads(slc.query_context)
    except Exception:
        return False

    extra = qc.get("form_data", {}).get("extra_form_data", {})
    if _FIELD not in extra:
        return False

    del extra[_FIELD]
    slc.query_context = json.dumps(qc)
    return True


def upgrade() -> None:
    bind = op.get_bind()
    session = db.Session(bind=bind)

    for slc in session.query(Slice).filter(Slice.viz_type == _VIZ_TYPE):
        _strip_params(slc)
        _strip_query_context(slc)

    session.flush()


def downgrade() -> None:
    # The stripped data was runtime-derived and is regenerated automatically
    # by the chart plugin on the next render — there is nothing to restore.
    pass
