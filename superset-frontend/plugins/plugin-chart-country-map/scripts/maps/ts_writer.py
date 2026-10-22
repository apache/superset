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
"""Writes `countries.ts` (the frontend plugin's control-panel options) and
`docs/data/countries.json` (the admin docs site's country list), matching
the notebook's "Output Typescript for Control Panel & JSON for Docs Site"
cell exactly.
"""

from __future__ import annotations

import json

_LICENSE_BOILERPLATE = """/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
"""

# Verbatim from the notebook's own JS template string - not generated
# from a dict, since the uk/usa branch uses a single combined condition
# with `.toUpperCase()` rather than a per-country literal, and the exact
# text has to match character-for-character for byte-identical output.
_ADDITIONAL_EXPORTS = """
export const countryOptions = Object.keys(countries).map(x => {
  if (x === 'uk' || x === 'usa') {
    return [x, x.toUpperCase()];
  }
  if (x === 'italy_regions') {
    return [x, 'Italy (regions)'];
  }
  if (x === 'france_regions') {
    return [x, 'France (regions)'];
  }
  if (x === 'france_overseas') {
    return [x, 'France (with overseas)'];
  }
  if (x === 'turkey_regions') {
    return [x, 'Turkey (regions)'];
  }
  return [
    x,
    x
      .split('_')
      .map(e => e[0].toUpperCase() + e.slice(1))
      .join(' '),
  ];
});

export default countries;
"""


def _to_js_identifier(name: str) -> str:
    return name.replace(" ", "_").replace("-", "_")


def _build_countries_ts(countries_combined: list[str]) -> str:
    imports = "\n".join(
        f"import {_to_js_identifier(c)} from "
        f"'./countries/{_to_js_identifier(c)}.geojson';"
        for c in countries_combined
    )
    exports = (
        "export const countries = {\n  "
        + ",\n  ".join(_to_js_identifier(c) for c in countries_combined)
        + ",\n};"
    )

    return f"{_LICENSE_BOILERPLATE}\n{imports}\n\n{exports}\n{_ADDITIONAL_EXPORTS}"


def _build_docs_json(countries_combined: list[str]) -> str:
    formatted = [c.replace("_", " ") for c in countries_combined]
    formatted = [c.upper() if c in {"usa", "uk"} else c.title() for c in formatted]
    formatted = [c.replace(" Regions", " (regions)") for c in formatted]
    formatted = [c.replace(" Overseas", " (with overseas)") for c in formatted]
    return json.dumps({"countries": formatted}, indent=2) + "\n"


def write_countries_ts(countries_combined: list[str], path: str) -> None:
    with open(path, "w", encoding="utf-8") as f:
        f.write(_build_countries_ts(countries_combined))


def write_docs_json(countries_combined: list[str], path: str) -> None:
    with open(path, "w", encoding="utf-8") as f:
        f.write(_build_docs_json(countries_combined))
