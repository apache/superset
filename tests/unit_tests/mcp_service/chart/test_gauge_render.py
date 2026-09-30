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

"""Optional renderer regression: provide Node's vega@5 and vega-lite@5 via NODE_PATH."""

import os
import shutil
import subprocess

import pytest

from superset.mcp_service.chart.preview_utils import generate_gauge_vega_lite_preview
from superset.mcp_service.chart.schemas import ChartError
from superset.utils import json


@pytest.mark.skipif(
    not os.environ.get("NODE_PATH"), reason="Requires vega@5/vega-lite@5 in NODE_PATH"
)
def test_gauge_rendered_pointer_origin_matches_arc_center() -> None:
    """Check actual scenegraph geometry in every facet, not only needle length."""
    specs = []
    for groupby in ([], ["team"]):
        for pointer in (True, False):
            for start, end in ((225, -45), (180, 0), (90, -90)):
                preview = generate_gauge_vega_lite_preview(
                    [{"team": "A", "score": 0}, {"team": "B", "score": 75}]
                    if groupby
                    else [{"score": 75}],
                    {
                        "metric": "score",
                        "groupby": groupby,
                        "show_pointer": pointer,
                        "start_angle": start,
                        "end_angle": end,
                        "min_val": 0,
                        "max_val": 100,
                        "intervals": "30,70,100",
                    },
                )
                assert not isinstance(preview, ChartError)
                specs.append(preview.specification)
    script = r"""
const assert = require('assert/strict');
const vl = require('vega-lite');
const vega = require('vega');
const fs = require('fs');
(async () => {
  for (const spec of JSON.parse(fs.readFileSync(0, 'utf8'))) {
    const warnings = [];
    const compiled = vl.compile(spec, {logger: {
      warn: message => warnings.push(message), info() {}, debug() {},
      error: message => { throw Error(message); }
    }}).spec;
    assert.deepEqual(warnings, []);
    const view = new vega.View(vega.parse(compiled), {renderer: 'none'});
    await view.runAsync();
    assert((await view.toSVG()).includes('<path'));
    const rules = [];
    function walk(item, type, target) {
      if (item.mark?.marktype === type) target.push(item);
      for (const child of item.items || []) walk(child, type, target);
    }
    walk(view.scenegraph().root, 'rule', rules);
    assert.equal(rules.length, spec.usermeta.show_pointer ? (spec.facet ? 2 : 1) : 0);
    for (const rule of rules) {
      const arcs = [];
      walk(rule.mark.group, 'arc', arcs);
      assert(arcs.length > 0);
      for (const arc of arcs) {
        assert.equal(rule.x, arc.x, 'needle x must be at its own dial center');
        assert.equal(rule.y, arc.y, 'needle y must be at its own dial center');
      }
      const radius = (arcs[0].innerRadius + arcs[0].outerRadius) / 2;
      assert(radius > arcs[0].innerRadius && radius < arcs[0].outerRadius);
      assert(rule.x > 0 && rule.y > 0);
      assert([rule.x, rule.y, rule.x2, rule.y2].every(Number.isFinite));
      assert(Math.abs(Math.hypot(rule.x2 - rule.x, rule.y2 - rule.y) - radius) < 1e-8);
      const angle = rule.datum.__mcp_gauge_angle;
      assert(Math.abs(rule.x2 - rule.x - radius * Math.sin(angle)) < 1e-8);
      assert(Math.abs(rule.y2 - rule.y + radius * Math.cos(angle)) < 1e-8);
    }
    view.finalize();
  }
})().catch(error => { console.error(error); process.exit(1); });
"""
    node = shutil.which("node")
    assert node is not None, "The opted-in renderer regression requires Node"
    # Execute only this fixed test script; generated fixture data enters via stdin.
    subprocess.run(  # noqa: S603
        [node, "-e", script], input=json.dumps(specs), text=True, check=True
    )
