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

import copy
import json
from typing import Any

from sqlalchemy import and_, Column, Integer, String, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import Session

from superset import conf, is_feature_enabled
from superset.constants import TimeGrain
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
    remove_keys: set[str] = set()
    rename_keys: dict[str, str] = {}
    source_viz_type: str
    target_viz_type: str
    has_x_axis_control: bool = False

    def __init__(self, form_data: str) -> None:
        self.data = try_load_json(form_data)

    def _pre_action(self) -> None:
        """Some actions before migrate"""

    def _migrate(self) -> None:
        if self.data.get("viz_type") != self.source_viz_type:
            return

        if "viz_type" in self.data:
            self.data["viz_type"] = self.target_viz_type

        # Sometimes visualizations have same keys in the source form_data and rename_keys
        # We need to remove them from data to allow the migration to work properly with rename_keys
        for source_key, target_key in self.rename_keys.items():
            if source_key in self.data and target_key in self.data:
                self.data.pop(target_key)

        rv_data = {}
        for key, value in self.data.items():
            if key in self.rename_keys and self.rename_keys[key] in rv_data:
                raise ValueError("Duplicate key in target viz")

            if key in self.rename_keys:
                rv_data[self.rename_keys[key]] = value
                continue

            if key in self.remove_keys:
                continue

            rv_data[key] = value

        if is_feature_enabled("GENERIC_CHART_AXES"):
            self._migrate_temporal_filter(rv_data)

        self.data = rv_data

    def _post_action(self) -> None:
        """Some actions after migrate"""

    def _migrate_temporal_filter(self, rv_data: dict[str, Any]) -> None:
        """Adds a temporal filter."""
        granularity_sqla = rv_data.pop("granularity_sqla", None)
        time_range = rv_data.pop("time_range", None) or conf.get("DEFAULT_TIME_FILTER")

        if not granularity_sqla:
            return

        if self.has_x_axis_control:
            rv_data["x_axis"] = granularity_sqla
            rv_data["time_grain_sqla"] = rv_data.get("time_grain_sqla") or TimeGrain.DAY

        temporal_filter = {
            "clause": "WHERE",
            "subject": granularity_sqla,
            "operator": "TEMPORAL_RANGE",
            "comparator": time_range,
            "expressionType": "SIMPLE",
        }

        if isinstance(granularity_sqla, dict):
            temporal_filter["comparator"] = None
            temporal_filter["expressionType"] = "SQL"
            temporal_filter["subject"] = granularity_sqla["label"]
            temporal_filter["sqlExpression"] = granularity_sqla["sqlExpression"]

        rv_data["adhoc_filters"] = (rv_data.get("adhoc_filters") or []) + [
            temporal_filter
        ]

    @classmethod
    def upgrade_slice(cls, slc: Slice) -> None:
        clz = cls(slc.params)
        form_data_bak = copy.deepcopy(clz.data)

        clz._pre_action()
        clz._migrate()
        clz._post_action()

        # viz_type depends on the migration and should be set after its execution
        # because a source viz can be mapped to different target viz types
        slc.viz_type = clz.target_viz_type

        # only backup params
        slc.params = json.dumps({**clz.data, FORM_DATA_BAK_FIELD_NAME: form_data_bak})

        if "form_data" in (query_context := try_load_json(slc.query_context)):
            query_context["form_data"] = clz.data
            slc.query_context = json.dumps(query_context)

    @classmethod
    def downgrade_slice(cls, slc: Slice) -> None:
        form_data = try_load_json(slc.params)
        if "viz_type" in (form_data_bak := form_data.get(FORM_DATA_BAK_FIELD_NAME, {})):
            slc.params = json.dumps(form_data_bak)
            slc.viz_type = form_data_bak.get("viz_type")
            query_context = try_load_json(slc.query_context)
            if "form_data" in query_context:
                query_context["form_data"] = form_data_bak
                slc.query_context = json.dumps(query_context)

    @classmethod
    def upgrade(cls, session: Session) -> None:
        slices = session.query(Slice).filter(Slice.viz_type == cls.source_viz_type)
        for slc in paginated_update(
            slices,
            lambda current, total: print(f"Upgraded {current}/{total} charts"),
        ):
            cls.upgrade_slice(slc)

    @classmethod
    def downgrade(cls, session: Session) -> None:
        slices = session.query(Slice).filter(
            and_(
                Slice.viz_type == cls.target_viz_type,
                Slice.params.like(f"%{FORM_DATA_BAK_FIELD_NAME}%"),
            )
        )
        for slc in paginated_update(
            slices,
            lambda current, total: print(f"Downgraded {current}/{total} charts"),
        ):
            cls.downgrade_slice(slc)
