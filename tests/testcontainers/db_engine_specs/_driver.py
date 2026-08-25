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
"""
Shared import guard for the per-dialect testcontainers modules
(tests/testcontainers/db_engine_specs/test_*.py), each of which needs its
own optional `testcontainers[...]` driver submodule to even import.
"""

import importlib
import os


def require_driver(module_name: str) -> None:
    """
    Import `module_name`, a dialect's `testcontainers` driver submodule.

    Most environments treat that driver as optional: a bare local `pytest`
    run, or another CI job that never installed the `testcontainers` extras,
    should skip the module rather than fail collection outright.

    The dedicated per-dialect CI job (.github/workflows/testcontainers.yml)
    sets SUPERSET_TESTCONTAINERS_STRICT, because there the driver is not
    optional -- that job's matrix installs exactly this one driver for
    exactly this one module. A broken or missing import there means the job
    is misconfigured, and should fail loudly instead of silently reporting
    a misleadingly green, zero-tests-run result.
    """
    if os.environ.get("SUPERSET_TESTCONTAINERS_STRICT"):
        importlib.import_module(module_name)
    else:
        import pytest

        pytest.importorskip(module_name)
