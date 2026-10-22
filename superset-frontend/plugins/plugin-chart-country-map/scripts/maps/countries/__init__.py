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
"""Registry of converted per-country build modules.

Each module exposes `NAME` (its registry key, used on the CLI's
--countries flag) and `build(ctx) -> dict[str, GeoDataFrame]` - a dict
since one notebook section can produce more than one named output (Italy
produces both "italy_regions" and
"italy_regions_and_autonomous_provinces").

This is a prototype covering 4 of the ~26 countries the notebook special-
cases, picked to cover distinct patterns: an external pinned GeoJSON
fetch with validation (morocco), one section producing two outputs
(italy), an external fetch that can legitimately fail (latvia), and a
shared geometry helper (usa). The other ~22 aren't converted yet.
"""

from __future__ import annotations

from . import italy, latvia, morocco, usa

REGISTRY = [morocco, italy, latvia, usa]
