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
"""rename pie label type

Revision ID: 41ce8799acc3
Revises: e11ccdd12658
Create Date: 2021-02-10 12:32:27.385579

"""

# revision identifiers, used by Alembic.
revision = "41ce8799acc3"
down_revision = "e11ccdd12658"

from alembic import op  # noqa: E402
from sqlalchemy import and_, Column, Integer, String, Text  # noqa: E402
from sqlalchemy.ext.declarative import declarative_base  # noqa: E402

from superset import db  # noqa: E402
from superset.utils import json  # noqa: E402

Base = declarative_base()


class Slice(Base):
    """Declarative class to do query in upgrade"""

    __tablename__ = "slices"
    id = Column(Integer, primary_key=True)
    viz_type = Column(String(250))
    params = Column(Text)


def upgrade():
    bind = op.get_bind()
    session = db.Session(bind=bind)

    slices = (
        session.query(Slice)
        .filter(and_(Slice.viz_type == "pie", Slice.params.like("%pie_label_type%")))
        .all()
    )
    changes = 0
    for slc in slices:
        try:
            params = json.loads(slc.params)
            pie_label_type = params.pop("pie_label_type", None)
            if pie_label_type:
                changes += 1
                params["label_type"] = pie_label_type
                slc.params = json.dumps(params, sort_keys=True)
        except Exception as e:
            print(e)
            print(f"Parsing params for slice {slc.id} failed.")
            pass

    session.commit()
    session.close()
    print(f"Updated {changes} pie chart labels.")


def downgrade():
    bind = op.get_bind()
    session = db.Session(bind=bind)

    slices = (
        session.query(Slice)
        .filter(and_(Slice.viz_type == "pie", Slice.params.like("%label_type%")))
        .all()
    )
    changes = 0
    for slc in slices:
        try:
            params = json.loads(slc.params)
            label_type = params.pop("label_type", None)
            if label_type:
                changes += 1
                params["pie_label_type"] = label_type
                slc.params = json.dumps(params, sort_keys=True)
        except Exception as e:
            print(e)
            print(f"Parsing params for slice {slc.id} failed.")
            pass

    session.commit()
    session.close()
    print(f"Updated {changes} pie chart labels.")
