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

from superset.versioning.queries import _changed_by_from_row
from superset.versioning.schemas import (
    ActivityChangedBySchema,
    VersionChangedBySchema,
)


def test_changed_by_exposes_display_fields_only() -> None:
    """``username`` is a login identifier, not display data. The activity
    payload has always excluded it (pinned in test_activity.py); the
    version payload must match — it is breaking to remove after release."""
    row = {
        "user_id": 5,
        "first_name": "Mike",
        "last_name": "Bridge",
        # A widened SELECT must not leak through the projection.
        "username": "mbridge",
    }
    result = _changed_by_from_row(row)
    assert result == {"id": 5, "first_name": "Mike", "last_name": "Bridge"}
    assert "username" not in result


def test_changed_by_is_none_without_user() -> None:
    row = {"user_id": None, "first_name": None, "last_name": None}
    assert _changed_by_from_row(row) is None


def test_version_and_activity_attribution_schemas_match() -> None:
    """The two attribution shapes are deliberately identical so clients can
    share one type; a field added to one must be added to (or rejected
    from) both."""
    version_fields = set(VersionChangedBySchema().fields)
    activity_fields = set(ActivityChangedBySchema().fields)
    assert version_fields == activity_fields == {"id", "first_name", "last_name"}
