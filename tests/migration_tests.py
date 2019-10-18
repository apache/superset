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

from superset.migrations.versions.fb13d49b72f9_better_filters import (
    Slice,
    upgrade_slice,
)

from .base_tests import SupersetTestCase


class MigrationTestCase(SupersetTestCase):
    def test_upgrade_slice(self):
        slc = Slice(
            slice_name="FOO",
            viz_type="filter_box",
            params=json.dumps(dict(metric="foo", groupby=["bar"])),
        )
        upgrade_slice(slc)
        params = json.loads(slc.params)
        self.assertNotIn("metric", params)
        self.assertIn("filter_configs", params)

        cfg = params["filter_configs"][0]
        self.assertEquals(cfg.get("metric"), "foo")
