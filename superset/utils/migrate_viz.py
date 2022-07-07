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
from enum import Enum
from typing import Dict, Set, Type, TYPE_CHECKING

if TYPE_CHECKING:
    from superset.models.slice import Slice


# pylint: disable=invalid-name
class MigrateVizEnum(str, Enum):
    # the Enum member name is viz_type in database
    treemap = "treemap"


class MigrateViz:
    remove_keys: Set[str] = set()
    mapping_keys: Dict[str, str] = {}
    source_viz_type: str
    target_viz_type: str

    def __init__(self, form_data: str) -> None:
        self.data = json.loads(form_data)

    def _pre_action(self) -> None:
        """some actions before migrate"""

    def _migrate(self) -> None:
        if self.data.get("viz_type") != self.source_viz_type:
            return

        if "viz_type" in self.data:
            self.data["viz_type"] = self.target_viz_type

        rv_data = {}
        for key, value in self.data.items():
            if key in self.mapping_keys and self.mapping_keys[key] in rv_data:
                raise ValueError("Duplicate key in target viz")

            if key in self.mapping_keys:
                rv_data[self.mapping_keys[key]] = value

            if key in self.remove_keys:
                continue

            rv_data[key] = value

        self.data = rv_data

    def _post_action(self) -> None:
        """some actions after migrate"""

    @classmethod
    def upgrade(cls, slc: Slice) -> Slice:
        clz = cls(slc.params)
        slc.viz_type = cls.target_viz_type
        form_data_bak = clz.data.copy()

        clz._pre_action()
        clz._migrate()
        clz._post_action()

        # only backup params
        slc.params = json.dumps({**clz.data, "form_data_bak": form_data_bak})

        query_context = json.loads(slc.query_context or "{}")
        if "form_data" in query_context:
            query_context["form_data"] = clz.data
            slc.query_context = json.dumps(query_context)
        return slc

    @classmethod
    def downgrade(cls, slc: Slice) -> Slice:
        form_data = json.loads(slc.params)
        if "form_data_bak" in form_data and "viz_type" in form_data.get(
            "form_data_bak"
        ):
            form_data_bak = form_data["form_data_bak"]
            slc.params = json.dumps(form_data_bak)
            slc.viz_type = form_data_bak.get("viz_type")

            query_context = json.loads(slc.query_context or "{}")
            if "form_data" in query_context:
                query_context["form_data"] = form_data_bak
                slc.query_context = json.dumps(query_context)
        return slc


class MigrateTreeMap(MigrateViz):
    source_viz_type = "treemap"
    target_viz_type = "treemap_v2"
    remove_keys = {"metrics"}

    def _pre_action(self) -> None:
        if (
            "metrics" in self.data
            and isinstance(self.data["metrics"], list)
            and len(self.data["metrics"]) > 0
        ):
            self.data["metric"] = self.data["metrics"][0]


get_migrate_class: Dict[MigrateVizEnum, Type[MigrateViz]] = {
    MigrateVizEnum.treemap: MigrateTreeMap,
}
