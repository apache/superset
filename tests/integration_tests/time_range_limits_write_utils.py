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
"""Shared builders for time range limits tests."""

from __future__ import annotations

from collections.abc import Iterator
from typing import Any

import pytest

from superset import db, security_manager
from superset.models.dashboard import Dashboard
from superset.models.helpers import SKIP_VISIBILITY_FILTER_CLASSES
from superset.utils import json
from tests.integration_tests.base_tests import subjects_from_users, SupersetTestCase
from tests.integration_tests.constants import ADMIN_USERNAME
from tests.integration_tests.test_app import app

KEY = "time_range_limits"


def metadata(policy: Any = None, **extra: Any) -> str:
    data: dict[str, Any] = dict(extra)
    if policy is not None:
        data[KEY] = policy
    return json.dumps(data)


__all__ = [
    "ADMIN_USERNAME",
    "Any",
    "Dashboard",
    "Iterator",
    "KEY",
    "SKIP_VISIBILITY_FILTER_CLASSES",
    "SupersetTestCase",
    "app",
    "db",
    "json",
    "metadata",
    "pytest",
    "security_manager",
    "subjects_from_users",
]
