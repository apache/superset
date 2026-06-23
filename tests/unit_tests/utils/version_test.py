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
"""Tests for superset.utils.version helpers."""

from superset.utils.version import visible_version_metadata


def _metadata():
    return {
        "version_string": "4.0.0",
        "version_sha": "abcdef12",
        "build_number": "build-42",
    }


def test_visible_version_metadata_hides_build_details_when_not_exposed():
    """Build details are blanked while the release version string is kept."""
    result = visible_version_metadata(_metadata(), expose_build_details=False)
    assert result["version_string"] == "4.0.0"
    assert result["version_sha"] == ""
    assert result["build_number"] is None


def test_visible_version_metadata_keeps_build_details_when_exposed():
    """All details pass through unchanged when exposure is allowed."""
    metadata = _metadata()
    result = visible_version_metadata(metadata, expose_build_details=True)
    assert result == metadata


def test_visible_version_metadata_does_not_mutate_input():
    """Hiding build details must not mutate the caller's metadata dict."""
    metadata = _metadata()
    visible_version_metadata(metadata, expose_build_details=False)
    assert metadata["version_sha"] == "abcdef12"
    assert metadata["build_number"] == "build-42"
