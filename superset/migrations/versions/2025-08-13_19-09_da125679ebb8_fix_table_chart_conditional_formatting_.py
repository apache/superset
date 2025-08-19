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
"""fix_table_chart_conditional_formatting_add_flag

Revision ID: da125679ebb8
Revises: c233f5365c9e
Create Date: 2025-08-13 19:09:41.796801

"""

# revision identifiers, used by Alembic.
revision = 'da125679ebb8'
down_revision = 'c233f5365c9e'


from alembic import op
from sqlalchemy import Column, Integer, String, Text
from sqlalchemy.ext.declarative import declarative_base

from superset import db
from superset.utils import json

Base = declarative_base()


class Slice(Base):
    __tablename__ = "slices"
    id = Column(Integer, primary_key=True)
    viz_type = Column(String(250))
    params = Column(Text)


def upgrade():
    bind = op.get_bind()
    session = db.Session(bind=bind)

    for slc in session.query(Slice).filter(Slice.viz_type == "table"):
        params = json.loads(slc.params)
        conditional_formatting = params.get("conditional_formatting", [])
        if conditional_formatting:
            new_conditional_formatting = []
            for formatter in conditional_formatting:
                color_scheme = formatter.get("colorScheme")
               
                if color_scheme not in ["Green", "Red"]:
                    new_conditional_formatting.append(
                        {**formatter, "toAllRow": False, "toTextColor":False}
                    )
                else:
                    new_conditional_formatting.append(formatter)
            params["conditional_formatting"] = new_conditional_formatting
            slc.params = json.dumps(params)
            session.commit()
    session.close()


def downgrade():
    bind = op.get_bind()
    session = db.Session(bind=bind)

    for slc in session.query(Slice).filter(Slice.viz_type == "table"):
        params = json.loads(slc.params)
        conditional_formatting = params.get("conditional_formatting", [])
        if conditional_formatting:
            new_conditional_formatting = []
            for formatter in conditional_formatting:
                if "toAllRow" in formatter or "toTextColor" in formatter:
                    new_formatter = formatter.copy()
                    new_formatter.pop("toAllRow", None)
                    new_formatter.pop("toTextColor", None)
                    new_conditional_formatting.append(new_formatter)
                else:
                    new_conditional_formatting.append(formatter)
            
            params["conditional_formatting"] = new_conditional_formatting
            slc.params = json.dumps(params)
            session.commit()
    
    session.close()
