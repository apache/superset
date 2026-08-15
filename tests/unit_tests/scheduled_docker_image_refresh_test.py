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
    / ".github/workflows/scheduled-docker-image-refresh.yml"
)


def load_workflow() -> dict[str, Any]:
    return yaml.safe_load(WORKFLOW_PATH.read_text())


def test_scheduled_refresh_uses_current_workflow_actions() -> None:
    workflow = load_workflow()
    steps = {step["name"]: step for step in workflow["jobs"]["docker-rebuild"]["steps"]}

    action_checkout = steps["Checkout workflow actions"]
    assert action_checkout["with"]["ref"] == "${{ github.sha }}"
    assert action_checkout["with"]["path"] == "workflow-source"
    assert (
        steps["Setup Docker Environment"]["uses"]
        == "./workflow-source/.github/actions/setup-docker"
    )
    assert (
        steps["Setup supersetbot"]["uses"]
        == "./workflow-source/.github/actions/setup-supersetbot/"
    )


def test_scheduled_refresh_notifier_uses_existing_labels() -> None:
    workflow = load_workflow()
    notify_step = workflow["jobs"]["notify-on-failure"]["steps"][0]

    assert '--label "infra:container"' in notify_step["run"]
    assert '--label "#bug"' in notify_step["run"]
    assert '--label "bug"' not in notify_step["run"]


def test_scheduled_refresh_changes_trigger_python_tests() -> None:
    assert change_detector.detect_changes(
        [".github/workflows/scheduled-docker-image-refresh.yml"],
        change_detector.PATTERNS["python"],
    )
