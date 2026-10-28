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
from __future__ import annotations

import re
from typing import Any

from superset.utils import json

UI_PREF_KEY_PATTERN = re.compile(r"^[a-z0-9_]{1,64}$")
MAX_UI_PREF_VALUE_BYTES = 16 * 1024


def validate_ui_pref_key(key: str) -> str | None:
    """Return an error message if ``key`` is invalid, else None."""
    if not UI_PREF_KEY_PATTERN.fullmatch(key):
        return "Invalid preference key."
    return None


def validate_ui_pref_value(value: Any) -> str | None:
    """Return an error message if ``value`` is not a JSON dict within size limits."""
    if not isinstance(value, dict):
        return "Preference value must be a JSON object."
    try:
        encoded = json.dumps(value)
    except (TypeError, ValueError):
        return "Preference value must be a JSON object."
    if len(encoded.encode("utf-8")) > MAX_UI_PREF_VALUE_BYTES:
        return "Preference value exceeds maximum size."
    return None
