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
"""chart-ds-constraint

Revision ID: 7e67aecbf3f1
Revises: b5ea9d343307
Create Date: 2023-03-27 12:30:01.164594

"""

# revision identifiers, used by Alembic.
revision = "7e67aecbf3f1"
down_revision = "07f9a902af1b"

import logging  # noqa: E402

import sqlalchemy as sa  # noqa: E402
from alembic import op  # noqa: E402
from sqlalchemy.ext.declarative import declarative_base  # noqa: E402

from superset import db  # noqa: E402
from superset.utils import json  # noqa: E402

Base = declarative_base()

logger = logging.getLogger(__name__)


class Slice(Base):  # type: ignore
    __tablename__ = "slices"

    id = sa.Column(sa.Integer, primary_key=True)
    params = sa.Column(sa.String(250))
    datasource_type = sa.Column(sa.String(200))


def upgrade_slc(slc: Slice) -> None:
    # clean up all charts with datasource_type not != table
    slc.datasource_type = "table"
    ds_id = None
    ds_type = None
    try:
        params_dict = json.loads(slc.params)
        ds_id, ds_type = params_dict["datasource"].split("__")
        # the assumption here is that the query was saved as a dataset
        # but the type wasn't written properly to the slice
        # by updating the type here we expect it will either work
        # or it will 404 when the dataset is looked up.
        params_dict["datasource"] = f"{ds_id}__table"
        slc.params = json.dumps(params_dict)
        logger.warning(
            "updated slice datasource from %s__%s to %s__table for slice: %s",
            ds_id,
            ds_type,
            ds_id,
            slc.id,
        )
    except Exception:
        # skip any malformatted params
        logger.warning(
            "failed to update slice.id = %s w/ datasource = %s__%s to %s__table",
            slc.id,
            ds_id,
            ds_type,
            ds_id,
        )
        pass


def upgrade():
    bind = op.get_bind()
    session = db.Session(bind=bind)
    with op.batch_alter_table("slices") as batch_op:
        for slc in session.query(Slice).filter(Slice.datasource_type != "table").all():
            if slc.datasource_type == "query":
                upgrade_slc(slc)
                session.add(slc)

            else:
                logger.warning(
                    "unknown value detected for slc.datasource_type: %s",
                    slc.datasource_type,
                )

    # need commit the updated values for Slice.datasource_type before creating constraint  # noqa: E501
    session.commit()

    with op.batch_alter_table("slices") as batch_op:
        batch_op.create_check_constraint(
            "ck_chart_datasource", "datasource_type in ('table')"
        )

    session.commit()
    session.close()


def downgrade():
    op.drop_constraint("ck_chart_datasource", "slices", type_="check")
