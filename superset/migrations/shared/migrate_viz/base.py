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
from __future__ import annotations

import json
from typing import Dict, Set

from alembic import op
from sqlalchemy import and_, Column, Integer, String, Text
from sqlalchemy.ext.declarative import declarative_base

from superset import db
from superset.migrations.shared.utils import paginated_update, try_load_json

Base = declarative_base()


class Slice(Base):  # type: ignore
    __tablename__ = "slices"

    id = Column(Integer, primary_key=True)
    slice_name = Column(String(250))
    viz_type = Column(String(250))
    params = Column(Text)
    query_context = Column(Text)


FORM_DATA_BAK_FIELD_NAME = "form_data_bak"


class MigrateViz:
    remove_keys: Set[str] = set()
    rename_keys: Dict[str, str] = {}
    source_viz_type: str
    target_viz_type: str

    def __init__(self, form_data: str) -> None:
        self.data = try_load_json(form_data)

    def _pre_action(self) -> None:
        """some actions before migrate"""

    def _migrate(self) -> None:
        if self.data.get("viz_type") != self.source_viz_type:
            return

        if "viz_type" in self.data:
            self.data["viz_type"] = self.target_viz_type

        rv_data = {}
        for key, value in self.data.items():
            if key in self.rename_keys and self.rename_keys[key] in rv_data:
                raise ValueError("Duplicate key in target viz")

            if key in self.rename_keys:
                rv_data[self.rename_keys[key]] = value

            if key in self.remove_keys:
                continue

            rv_data[key] = value

        self.data = rv_data

    def _post_action(self) -> None:
        """some actions after migrate"""

    @classmethod
    def upgrade_slice(cls, slc: Slice) -> Slice:
        clz = cls(slc.params)
        slc.viz_type = cls.target_viz_type
        form_data_bak = clz.data.copy()

        clz._pre_action()
        clz._migrate()
        clz._post_action()

        # only backup params
        slc.params = json.dumps({**clz.data, FORM_DATA_BAK_FIELD_NAME: form_data_bak})

        query_context = try_load_json(slc.query_context)
        if "form_data" in query_context:
            query_context["form_data"] = clz.data
            slc.query_context = json.dumps(query_context)
        return slc

    @classmethod
    def downgrade_slice(cls, slc: Slice) -> Slice:
        form_data = try_load_json(slc.params)
        form_data_bak = form_data.get(FORM_DATA_BAK_FIELD_NAME, {})
        if "viz_type" in form_data_bak:
            slc.params = json.dumps(form_data_bak)
            slc.viz_type = form_data_bak.get("viz_type")
            query_context = try_load_json(slc.query_context)
            if "form_data" in query_context:
                query_context["form_data"] = form_data_bak
                slc.query_context = json.dumps(query_context)
        return slc

    @classmethod
    def upgrade(cls) -> None:
        bind = op.get_bind()
        session = db.Session(bind=bind)
        slices = session.query(Slice).filter(Slice.viz_type == cls.source_viz_type)
        for slc in paginated_update(
            slices,
            lambda current, total: print(
                f"  Updating {current}/{total} charts", end="\r"
            ),
        ):
            new_viz = cls.upgrade_slice(slc)
            session.merge(new_viz)

    @classmethod
    def downgrade(cls) -> None:
        bind = op.get_bind()
        session = db.Session(bind=bind)
        slices = session.query(Slice).filter(
            and_(
                Slice.viz_type == cls.target_viz_type,
                Slice.params.like(f"%{FORM_DATA_BAK_FIELD_NAME}%"),
            )
        )
        for slc in paginated_update(
            slices,
            lambda current, total: print(
                f"  Downgrading {current}/{total} charts", end="\r"
            ),
        ):
            new_viz = cls.downgrade_slice(slc)
            session.merge(new_viz)
