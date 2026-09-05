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
"""Unit tests for the Task model's property merge semantics."""

from typing import Any

from superset.models.tasks import Task
from superset.utils import json


def _task(properties: dict[str, Any]) -> Task:
    """A bare Task carrying only serialized properties (no DB session needed)."""
    return Task(properties=json.dumps(properties))


def test_private_namespaces_do_not_collide() -> None:
    """A write to private.task must never clobber private.framework (or vice versa),
    and existing keys within a namespace are preserved across writes."""
    task = _task({"private": {"framework": {"celery_task_id": "c1"}, "task": {}}})

    # Task-owned write leaves the framework namespace intact.
    task.update_task_private({"cancel_query_id": "42", "cancel_database_id": 7})
    private = task.properties_dict["private"]
    assert private["framework"]["celery_task_id"] == "c1"
    assert private["task"] == {"cancel_query_id": "42", "cancel_database_id": 7}

    # Framework-owned write leaves the task namespace intact and merges (not
    # replaces) within its own namespace.
    task.update_framework_private({"exception_type": "KeyError"})
    private = task.properties_dict["private"]
    assert private["framework"] == {
        "celery_task_id": "c1",
        "exception_type": "KeyError",
    }
    assert private["task"] == {"cancel_query_id": "42", "cancel_database_id": 7}


def test_update_properties_does_not_clobber_private() -> None:
    """A top-level property update leaves the private subtree untouched."""
    task = _task({"private": {"framework": {"celery_task_id": "c1"}, "task": {}}})

    task.update_properties({"is_abortable": True})

    assert task.properties_dict["is_abortable"] is True
    assert task.properties_dict["private"]["framework"]["celery_task_id"] == "c1"


def test_private_merge_tolerates_malformed_existing_value() -> None:
    """A legacy/corrupted non-dict private (or namespace) must not break a write;
    the bad value is treated as empty rather than raising TypeError."""
    # Whole private bucket is a non-dict scalar.
    task = _task({"private": "legacy-garbage"})
    task.update_framework_private({"celery_task_id": "c1"})
    assert task.properties_dict["private"]["framework"] == {"celery_task_id": "c1"}

    # A single namespace holds a non-dict value.
    task = _task({"private": {"framework": "oops", "task": {}}})
    task.update_framework_private({"celery_task_id": "c1"})
    assert task.properties_dict["private"]["framework"] == {"celery_task_id": "c1"}
