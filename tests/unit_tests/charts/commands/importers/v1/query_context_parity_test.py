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
"""
Backend<->frontend query_context PARITY proof (Apache Superset #33615).

This is the "perfect fidelity" gate: for each shared input fixture, running the
frontend `buildQuery` in V8 on the backend (QueryContextGenerator) must produce
EXACTLY the query_context the frontend produces. The expected goldens are
written by the jest test
`superset-frontend/src/backend-querycontext/parity.test.ts` from the SAME
`generateQueryContext`, so a match proves the V8-on-backend path reproduces the
UI's output byte-for-byte.

Skip-guarded so it is green before the toolchain is set up (py_mini_racer +
built bundle + recorded goldens) and MEANINGFUL once it is. Full "perfect"
coverage = a fixture per registered viz type (follow-on).
"""

from __future__ import annotations

from pathlib import Path

import pytest

from superset.utils import json

pytest.importorskip("py_mini_racer")

# repo_root/tests/unit_tests/charts/commands/importers/v1/<this file>
_REPO_ROOT = Path(__file__).resolve().parents[6]
_FIXTURES = (
    _REPO_ROOT / "superset-frontend" / "src" / "backend-querycontext" / "__fixtures__"
)
_FORMDATA_DIR = _FIXTURES / "formdata"
_EXPECTED_DIR = _FIXTURES / "expected"
_BUNDLE = (
    _REPO_ROOT
    / "superset"
    / "commands"
    / "chart"
    / "_bundles"
    / "query_context_bundle.js"
)


def _fixture_names() -> list[str]:
    if not _FORMDATA_DIR.is_dir():
        return []
    return sorted(p.stem for p in _FORMDATA_DIR.glob("*.json"))


pytestmark = pytest.mark.skipif(
    not _BUNDLE.exists(),
    reason=(
        "query_context bundle not built — run "
        "`npm run build:backend-querycontext` in superset-frontend/"
    ),
)


@pytest.mark.parametrize("viz_type", _fixture_names())
def test_backend_matches_frontend_query_context(viz_type: str) -> None:
    from superset.commands.chart.query_context_generator import (
        get_query_context_generator,
    )

    expected_path = _EXPECTED_DIR / f"{viz_type}.json"
    if not expected_path.exists():
        pytest.skip(
            f"golden missing for {viz_type} — run the jest parity test "
            "(parity.test.ts) to record it"
        )

    form_data = json.loads((_FORMDATA_DIR / f"{viz_type}.json").read_text("utf-8"))
    expected = json.loads(expected_path.read_text("utf-8"))

    generator = get_query_context_generator()
    actual = generator.generate(viz_type, form_data)

    assert actual is not None, (
        f"backend generator returned None for {viz_type}; the V8 bundle must "
        "cover every parity-fixture viz type"
    )
    assert actual == expected, (
        f"backend query_context for {viz_type} diverges from the frontend "
        "buildQuery golden"
    )
