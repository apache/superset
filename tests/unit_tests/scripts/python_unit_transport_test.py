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
"""Keep real Thrift transport suites enabled in the Python unit-test job."""

from pathlib import Path

import yaml


def test_python_unit_workflow_installs_transport_extras() -> None:
    """Install both optional drivers before pytest can skip their test files."""
    root = Path(__file__).resolve().parents[3]
    workflow = yaml.safe_load(
        (root / ".github/workflows/superset-python-unittest.yml").read_text()
    )
    steps = workflow["jobs"]["unit-tests"]["steps"]
    test_index = next(
        index
        for index, step in enumerate(steps)
        if step.get("name") == "Python unit tests"
    )
    assert any(
        'uv pip install --system -e ".[hive,impala]"' in step.get("run", "")
        and "if" not in step
        for step in steps[:test_index]
    )
