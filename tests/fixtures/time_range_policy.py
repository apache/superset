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
"""Shared builders for time range limits tests."""

from __future__ import annotations

from typing import Any

ALIAS_ADDONS: dict[str, dict[str, Any]] = {
    "TIME_GRAIN_ADDONS": {"PT0.5H": "Half hour", "P0.25Y": "Quarter year"},
    "TIME_GRAIN_ADDON_EXPRESSIONS": {"sqlite": {"PT0.5H": "x", "P0.25Y": "x"}},
}


__all__ = ["ALIAS_ADDONS", "Any"]
