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

from pathlib import Path
from typing import Any

import yaml

from scripts import change_detector

WORKFLOW_PATH = (
    Path(__file__).resolve().parents[2]
    / ".github/workflows/frontend-bundle-size-nightly.yml"
)


def load_workflow() -> dict[str, Any]:
    return yaml.safe_load(WORKFLOW_PATH.read_text())


def test_scheduled_bundle_size_action_uses_read_only_token() -> None:
    workflow = load_workflow()
    job = workflow["jobs"]["refresh-baseline"]
    steps = {step["name"]: step for step in job["steps"]}

    benchmark_step = steps["Update bundle size baseline"]
    assert benchmark_step["with"]["github-token"] == "${{ secrets.GITHUB_TOKEN }}"
    assert workflow["permissions"]["contents"] == "read"
    effective_permissions = job.get("permissions", workflow["permissions"])
    assert effective_permissions.get("contents") in {None, "read"}


def test_scheduled_bundle_size_changes_trigger_python_tests() -> None:
    assert change_detector.detect_changes(
        [".github/workflows/frontend-bundle-size-nightly.yml"],
        change_detector.PATTERNS["python"],
    )
