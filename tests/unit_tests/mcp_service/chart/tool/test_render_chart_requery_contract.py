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

"""Server half of the chart-viewer re-query contract.

The widget builds its ``render_chart_requery`` payload against a checked-in
copy of this tool's ``inputSchema``. If the tool's signature changes and the
fixture is not regenerated, the widget would start sending payloads the server
rejects — which is exactly how every drill-down and brush-to-zoom shipped
broken once already, with no test failing.

This test fails when the schema drifts from the fixture. The TypeScript half
(``chart_viewer/src/requery.contract.test.ts``) validates the widget's payloads
against the same file, so the two cannot diverge silently.

To regenerate after an intentional signature change, see the ``REGENERATE``
note below.
"""

from pathlib import Path
from typing import Any

import pytest

from superset.utils import json

# tests/unit_tests/mcp_service/chart/tool/<this file> -> repo root
FIXTURE = (
    Path(__file__).parents[5]
    / "superset"
    / "mcp_service"
    / "chart"
    / "resources"
    / "chart_viewer"
    / "src"
    / "__fixtures__"
    / "render_chart_requery.inputSchema.json"
)

# REGENERATE:
#   python3 - <<'EOF'
#   import asyncio, json, os
#   os.environ.setdefault("SUPERSET_CONFIG",
#                         "tests.integration_tests.superset_test_config")
#   from superset.app import create_app
#   app = create_app()
#   async def main():
#       from superset.mcp_service.app import mcp
#       tool = await mcp.get_tool("render_chart_requery")
#       Path(FIXTURE).write_text(
#           json.dumps(tool.parameters, indent=2, sort_keys=True) + "\n")
#   with app.app_context():
#       asyncio.run(main())
#   EOF
# Then re-run the widget's vitest suite to confirm its payloads still validate.


@pytest.mark.asyncio
async def test_requery_input_schema_matches_widget_fixture(app: Any) -> None:
    """The published schema must equal the copy the widget builds against."""
    from superset.mcp_service.app import mcp

    tool = await mcp.get_tool("render_chart_requery")
    live = json.loads(json.dumps(tool.parameters, sort_keys=True))
    fixture = json.loads(FIXTURE.read_text(encoding="utf-8"))

    assert live == fixture, (
        "render_chart_requery's inputSchema drifted from the chart-viewer "
        "fixture. The widget builds its re-query payload from that file, so "
        "this drift would break drill-down and brush-to-zoom in every host. "
        "Regenerate the fixture (see the REGENERATE note in this file) and "
        "re-run the widget's vitest suite."
    )


@pytest.mark.asyncio
async def test_requery_still_takes_a_request_envelope(app: Any) -> None:
    """Pin the two facts the widget's payload shape depends on.

    Asserted independently of the fixture so that regenerating the fixture
    cannot quietly bless a breaking rename.
    """
    from superset.mcp_service.app import mcp

    tool = await mcp.get_tool("render_chart_requery")
    schema = tool.parameters

    assert schema["required"] == ["request"], (
        "The widget wraps its arguments in a `request` envelope; a flat "
        "payload is rejected by validation."
    )
    request_model = schema["$defs"]["RenderChartRequeryRequest"]["properties"]
    assert (
        "identifier" in request_model
    ), "The widget keys the chart by `identifier` (not `chart_id`)."
    # group_by was removed because extra_form_data ignores it; if it comes
    # back, the widget needs a deliberate decision, not a silent no-op.
    assert "group_by" not in request_model
