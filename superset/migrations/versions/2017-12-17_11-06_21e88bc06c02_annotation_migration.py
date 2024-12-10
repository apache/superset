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
"""migrate_old_annotation_layers

Revision ID: 21e88bc06c02
Revises: 67a6ac9b727b
Create Date: 2017-12-17 11:06:30.180267

"""

from alembic import op
from sqlalchemy import Column, Integer, or_, String, Text
from sqlalchemy.ext.declarative import declarative_base

from superset import db
from superset.utils import json

# revision identifiers, used by Alembic.
revision = "21e88bc06c02"
down_revision = "67a6ac9b727b"

Base = declarative_base()


class Slice(Base):
    __tablename__ = "slices"
    id = Column(Integer, primary_key=True)
    viz_type = Column(String(250))
    params = Column(Text)


def upgrade():
    bind = op.get_bind()
    session = db.Session(bind=bind)

    for slc in session.query(Slice).filter(
        or_(Slice.viz_type.like("line"), Slice.viz_type.like("bar"))
    ):
        params = json.loads(slc.params)
        layers = params.get("annotation_layers", [])
        if layers:
            new_layers = []
            for layer in layers:
                new_layers.append(
                    {
                        "annotationType": "INTERVAL",
                        "style": "solid",
                        "name": f"Layer {layer}",
                        "show": True,
                        "overrides": {"since": None, "until": None},
                        "value": layer,
                        "width": 1,
                        "sourceType": "NATIVE",
                    }
                )
            params["annotation_layers"] = new_layers
            slc.params = json.dumps(params)
            session.commit()
    session.close()


def downgrade():
    bind = op.get_bind()
    session = db.Session(bind=bind)

    for slc in session.query(Slice).filter(
        or_(Slice.viz_type.like("line"), Slice.viz_type.like("bar"))
    ):
        params = json.loads(slc.params)
        layers = params.get("annotation_layers", [])
        if layers:
            params["annotation_layers"] = [layer["value"] for layer in layers]
            slc.params = json.dumps(params)
            session.commit()
    session.close()
