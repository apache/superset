# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements. See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership. The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License. You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied. See the License for the
# specific language governing permissions and limitations
# under the License.

"""Run shared connection-level regressions in the PostgreSQL CI matrix too."""

import pytest

from tests.unit_tests.commands.report.execution_claim_test import (
    claim_engine as claim_engine,
    sessions as sessions,
    test_competing_workers_have_one_winner as test_claim_race,
    test_recovery_can_fence_worker_during_transport as test_delivery_fencing,
    test_terminal_fallback_persists_without_working_log as test_terminal_fallback,
)

__all__ = ["test_claim_race", "test_delivery_fencing", "test_terminal_fallback"]

pytestmark = pytest.mark.usefixtures("app_context")
