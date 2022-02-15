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
"""migrate pivot table v2 heatmaps to new format

Revision ID: 143b6f2815da
Revises: e323605f370a
Create Date: 2021-08-03 15:36:35.925420

"""

# revision identifiers, used by Alembic.
revision = "143b6f2815da"
down_revision = "e323605f370a"

import json
from typing import Any, Dict, List, Tuple

from alembic import op
from sqlalchemy import and_, Column, Integer, String, Text
from sqlalchemy.ext.declarative import declarative_base

from superset import db

Base = declarative_base()


class Slice(Base):
    __tablename__ = "slices"
    id = Column(Integer, primary_key=True)
    viz_type = Column(String(250))
    params = Column(Text)


VALID_RENDERERS = (
    "Table With Subtotal",
    "Table With Subtotal Heatmap",
    "Table With Subtotal Col Heatmap",
    "Table With Subtotal Row Heatmap",
    "Table With Subtotal Barchart",
    "Table With Subtotal Col Barchart",
    "Table With Subtotal Row Barchart",
)


def upgrade():
    bind = op.get_bind()
    session = db.Session(bind=bind)

    slices = (
        session.query(Slice)
        .filter(
            and_(
                Slice.viz_type == "pivot_table_v2",
                Slice.params.like('%"tableRenderer%'),
            )
        )
        .all()
    )
    changed_slices = 0
    for slice in slices:
        try:
            params = json.loads(slice.params)
            table_renderer = params.pop("tableRenderer", None)
            conditional_formatting = params.get("conditional_formatting")

            # don't update unless table_renderer is valid and
            # conditional_formatting is undefined
            if table_renderer in VALID_RENDERERS and conditional_formatting is None:
                metric_labels = [
                    metric if isinstance(metric, str) else metric["label"]
                    for metric in params.get("metrics")
                ]
                params["conditional_formatting"] = [
                    {
                        "colorScheme": "rgb(255,0,0)",
                        "column": metric_label,
                        "operator": "None",
                    }
                    for metric_label in metric_labels
                ]
                changed_slices += 1
                slice.params = json.dumps(params, sort_keys=True)
        except Exception as e:
            print(f"Parsing json_metadata for slice {slice.id} failed.")
            raise e

    session.commit()
    session.close()
    print(f"Upgraded {changed_slices} slices.")


def downgrade():
    # slices can't be downgraded
    pass
