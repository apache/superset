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

"""The chart-viewer URI is content-addressed by the built bundle.

Hosts cache a ``ui://`` resource by URI and never re-fetch it, so a rebuilt
widget served under an unchanged URI is invisible to anyone who already loaded
it. These pin the property that makes that impossible.
"""

from pathlib import Path
from typing import Any

from superset.mcp_service.chart import constants


def _version_with_bundle(monkeypatch: Any, path: Path) -> str:
    monkeypatch.setattr(constants, "_BUNDLE_PATH", path)
    return constants._chart_viewer_version()


def test_version_changes_when_the_bundle_changes(
    monkeypatch: Any, tmp_path: Path
) -> None:
    bundle = tmp_path / "index.html"

    bundle.write_text("<html>build one</html>", encoding="utf-8")
    first = _version_with_bundle(monkeypatch, bundle)

    bundle.write_text("<html>build two</html>", encoding="utf-8")
    second = _version_with_bundle(monkeypatch, bundle)

    assert first != second


def test_version_is_stable_for_identical_content(
    monkeypatch: Any, tmp_path: Path
) -> None:
    # Rebuilding without source changes must not churn the URI, or every
    # rebuild would invalidate host caches for no reason.
    one = tmp_path / "one.html"
    two = tmp_path / "two.html"
    one.write_text("<html>same</html>", encoding="utf-8")
    two.write_text("<html>same</html>", encoding="utf-8")

    assert _version_with_bundle(monkeypatch, one) == _version_with_bundle(
        monkeypatch, two
    )


def test_version_carries_the_schema_version_and_a_digest(
    monkeypatch: Any, tmp_path: Path
) -> None:
    bundle = tmp_path / "index.html"
    bundle.write_text("<html>built</html>", encoding="utf-8")

    version = _version_with_bundle(monkeypatch, bundle)

    schema, _, digest = version.partition("-")
    assert schema == constants.CHART_VIEWER_SCHEMA_VERSION
    assert len(digest) == 12


def test_falls_back_to_the_schema_version_without_a_bundle(
    monkeypatch: Any, tmp_path: Path
) -> None:
    # A source checkout with no `npm run build` still has to serve a valid URI
    # (the resource returns a "not built" placeholder page in that case).
    missing = tmp_path / "never-built.html"

    assert (
        _version_with_bundle(monkeypatch, missing)
        == constants.CHART_VIEWER_SCHEMA_VERSION
    )
