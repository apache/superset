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
"""The two contributed pages are not the same audience.

`/approvals` is the inbox. Everyone in the workflow needs it, authors
included, so the extension widens its permission to whichever roles may read
a change request -- which on a stock install is Admin, Alpha and Gamma.

`/change-review-settings` says whether review is on for the instance. That is
an administrator's question, and it was reaching everybody because it
declared the same permission and so rode along on the same widening.
"""

import json
from pathlib import Path
from typing import Any

import pytest

MANIFEST = (
    Path(__file__).resolve().parents[3]
    / "local_extensions"
    / "asset-approval"
    / "extension.json"
)


def _pages() -> dict[str, dict[str, Any]]:
    manifest = json.loads(MANIFEST.read_text())
    return {page["path"]: page for page in manifest["contributions"]["pages"]}


def test_the_settings_page_does_not_share_the_inbox_permission() -> None:
    pages = _pages()

    assert pages["/approvals"]["permission"] == "can_review"
    assert pages["/change-review-settings"]["permission"] != "can_review"


def test_only_the_inbox_permission_is_widened_to_the_workflow() -> None:
    """What the extension grants, and to what.

    ``_grant_page_permission_to_the_workflow`` hands out exactly one
    permission. A page that wants to stay with Admin only has to declare a
    different one, because the host grants a declared permission to Admin and
    the view-menu prefix keeps it off the other builtin roles.
    """
    from asset_approval import entrypoint

    widened = entrypoint.PAGE_PERMISSION
    declared = {page["permission"] for page in _pages().values()}

    assert widened == "can_review"
    assert declared - {widened} == {"can_configure_review"}


@pytest.mark.parametrize("path", ["/approvals", "/change-review-settings"])
def test_both_pages_still_follow_the_feature_flag(path: str) -> None:
    """With the flag off neither page exists, for anyone (QA-23)."""
    assert _pages()[path]["featureFlag"] == "CHANGE_MANAGEMENT"


@pytest.mark.parametrize("path", ["/approvals", "/change-review-settings"])
def test_neither_permission_is_one_superset_reserves(path: str) -> None:
    """A reserved name would quietly undo the restriction.

    ``ACCESSIBLE_PERMS`` is held by every role, and a name in
    ``OBJECT_SPEC_PERMISSIONS`` loses its Admin grant on the next
    ``superset init``. ``superset.extensions.view`` refuses both at
    registration; this says the manifest does not rely on being refused.
    """
    from superset.security.manager import SupersetSecurityManager

    permission = _pages()[path]["permission"]

    assert permission not in SupersetSecurityManager.ACCESSIBLE_PERMS
    assert permission not in SupersetSecurityManager.OBJECT_SPEC_PERMISSIONS
