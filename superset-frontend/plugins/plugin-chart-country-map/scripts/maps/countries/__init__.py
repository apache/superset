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
since one notebook section can produce more than one named output (e.g.
France produces "france", "france_regions" and "france_overseas").

This covers all ~26 special-cased sections of the notebook it replaces.
Every other country Superset ships (the ~190 that don't need any
correction) is handled generically - see `maps/catalog.py`.
"""

from __future__ import annotations

from . import (
    china,
    finland,
    france,
    india,
    iran,
    italy,
    kenya,
    latvia,
    madagascar,
    malawi,
    morocco,
    netherlands,
    norway,
    philippines,
    portugal,
    russia,
    south_africa,
    spain,
    turkey,
    uk,
    ukraine,
    usa,
    vietnam,
)

REGISTRY = [
    china,
    finland,
    france,
    india,
    iran,
    italy,
    kenya,
    latvia,
    madagascar,
    malawi,
    morocco,
    netherlands,
    norway,
    philippines,
    portugal,
    russia,
    south_africa,
    spain,
    turkey,
    uk,
    ukraine,
    usa,
    vietnam,
]
