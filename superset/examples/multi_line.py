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
import json

from superset import db
from superset.models.slice import Slice

from .birth_names import load_birth_names
from .helpers import merge_slice, misc_dash_slices
from .world_bank import load_world_bank_health_n_pop


def load_multi_line(only_metadata: bool = False) -> None:
    load_world_bank_health_n_pop(only_metadata)
    load_birth_names(only_metadata)
    ids = [
        row.id
        for row in db.session.query(Slice).filter(
            Slice.slice_name.in_(["Growth Rate", "Trends"])
        )
    ]

    slc = Slice(
        datasource_type="table",  # not true, but needed
        datasource_id=1,  # cannot be empty
        slice_name="Multi Line",
        viz_type="line_multi",
        params=json.dumps(
            {
                "slice_name": "Multi Line",
                "viz_type": "line_multi",
                "line_charts": [ids[0]],
                "line_charts_2": [ids[1]],
                "since": "1970",
                "until": "1995",
                "prefix_metric_with_slice_name": True,
                "show_legend": False,
                "x_axis_format": "%Y",
            }
        ),
    )

    misc_dash_slices.add(slc.slice_name)
    merge_slice(slc)
