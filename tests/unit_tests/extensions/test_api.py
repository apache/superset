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

"""Unit tests for the extensions REST API."""

from __future__ import annotations

from superset.extensions.api import _validate_segment

# ---------------------------------------------------------------------------
# _validate_segment helper — used by GET /api/v1/extensions/<publisher>/<name>
# and GET /api/v1/extensions/<publisher>/<name>/<file>
# ---------------------------------------------------------------------------


def test_validate_segment_accepts_alphanumeric() -> None:
    assert _validate_segment("acme") is True
    assert _validate_segment("my-ext") is True
    assert _validate_segment("my_ext") is True
    assert _validate_segment("Ext123") is True


def test_validate_segment_rejects_traversal() -> None:
    assert _validate_segment("..") is False
    assert _validate_segment("../etc") is False
    assert _validate_segment("acme/bad") is False
    assert _validate_segment("acme%2Fbad") is False
    assert _validate_segment("") is False


def test_validate_segment_rejects_dots() -> None:
    assert _validate_segment("acme.corp") is False
