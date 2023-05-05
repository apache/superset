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
import pytest

from superset.cachekeys.commands.warm_up_cache import WarmUpCacheCommand
from superset.cachekeys.commands.exceptions import WarmUpCacheChartNotFoundError, WarmUpCacheParametersExpectedError, WarmUpCacheTableNotFoundError
from superset.extensions import db
from tests.integration_tests.base_tests import SupersetTestCase
from tests.integration_tests.fixtures.birth_names_dashboard import (
    load_birth_names_dashboard_with_slices,
    load_birth_names_data,
)
from tests.integration_tests.fixtures.energy_dashboard import (
    load_energy_table_with_slice,
    load_energy_table_data,
)


class TestWarmUpCacheCommand(SupersetTestCase):
    def test_warm_up_cache_command_required_params_missing(self):
        with self.assertRaises(WarmUpCacheParametersExpectedError):
            WarmUpCacheCommand(None, 1, None, None, None).run()

    def test_warm_up_cache_command_chart_not_found(self):
        with self.assertRaises(WarmUpCacheChartNotFoundError):
            WarmUpCacheCommand(99999, None, None, None, None).run()

    def test_warm_up_cache_command_table_not_found(self):
        with self.assertRaises(WarmUpCacheTableNotFoundError):
            WarmUpCacheCommand(None, None, "not_here", "abc", None).run()

    @pytest.mark.usefixtures(
        "load_energy_table_with_slice", "load_birth_names_dashboard_with_slices"
    )
    def test_warm_up_cache(self):
        slc = self.get_slice("Girls", db.session)
        result = WarmUpCacheCommand(slc.id, None, None, None, None).run()
        self.assertEqual(result, [{"chart_id": slc.id, "viz_error": None, "viz_status": "success"}])
