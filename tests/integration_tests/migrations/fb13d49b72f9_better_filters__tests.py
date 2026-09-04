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
from importlib import import_module

from superset.utils import json

better_filters = import_module(
    "superset.migrations.versions.2018-12-11_22-03_fb13d49b72f9_better_filters",
)
Slice = better_filters.Slice
upgrade_slice = better_filters.upgrade_slice


def test_upgrade_slice():
    slc = Slice(
        slice_name="FOO",
        viz_type="filter_box",
        params=json.dumps(dict(metric="foo", groupby=["bar"])),  # noqa: C408
    )
    upgrade_slice(slc)
    params = json.loads(slc.params)
    assert "metric" not in params
    assert "filter_configs" in params

    cfg = params["filter_configs"][0]
    assert cfg.get("metric") == "foo"
