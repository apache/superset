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
# isort:skip_file
import copy
import json

import tests.test_app  # pylint: disable=unused-import
from superset import db
from superset.dashboards.dao import DashboardDAO
from superset.models.dashboard import Dashboard
from tests.base_tests import SupersetTestCase


class DashboardDAOTests(SupersetTestCase):
    def test_set_dash_metadata(self):
        dash = db.session.query(Dashboard).filter_by(slug="world_health").first()
        data = dash.data
        positions = data["position_json"]
        data.update({"positions": positions})
        original_data = copy.deepcopy(data)

        # add filter scopes
        filter_slice = dash.slices[0]
        immune_slices = dash.slices[2:]
        filter_scopes = {
            str(filter_slice.id): {
                "region": {
                    "scope": ["ROOT_ID"],
                    "immune": [slc.id for slc in immune_slices],
                }
            }
        }
        data.update({"filter_scopes": json.dumps(filter_scopes)})
        DashboardDAO.set_dash_metadata(dash, data)
        updated_metadata = json.loads(dash.json_metadata)
        self.assertEqual(updated_metadata["filter_scopes"], filter_scopes)

        # remove a slice and change slice ids (as copy slices)
        removed_slice = immune_slices.pop()
        removed_component = [
            key
            for (key, value) in positions.items()
            if isinstance(value, dict)
            and value.get("type") == "CHART"
            and value["meta"]["chartId"] == removed_slice.id
        ]
        positions.pop(removed_component[0], None)

        data.update({"positions": positions})
        DashboardDAO.set_dash_metadata(dash, data)
        updated_metadata = json.loads(dash.json_metadata)
        expected_filter_scopes = {
            str(filter_slice.id): {
                "region": {
                    "scope": ["ROOT_ID"],
                    "immune": [slc.id for slc in immune_slices],
                }
            }
        }
        self.assertEqual(updated_metadata["filter_scopes"], expected_filter_scopes)

        # reset dash to original data
        DashboardDAO.set_dash_metadata(dash, original_data)
