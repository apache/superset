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
"""Tests for helpers shared by legacy and Celery SQL execution."""

import pytest


@pytest.mark.parametrize(
    ("legacy_name", "celery_name"),
    [
        ("_extract_errors", "_extract_errors"),
        ("_discard_unreferenced_results", "_discard_unreferenced_results"),
        ("_discard_unpublished_results", "_discard_stored_results"),
    ],
)
def test_execution_helpers_are_shared(legacy_name: str, celery_name: str) -> None:
    """Both execution paths use the same neutral helper implementation."""
    from superset import sql_lab
    from superset.sql.execution import celery_task

    helper = getattr(sql_lab, legacy_name)
    assert helper is getattr(celery_task, celery_name)
    assert helper.__module__ == "superset.sql.execution.utils"
