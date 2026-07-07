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

"""Shared query validation utilities for MCP tools."""

import difflib


def validate_names(
    requested: list[str],
    valid: set[str],
    kind: str,
    *,
    empty_hint: str | None = None,
    list_valid_on_miss: bool = False,
    full_list_hint: str = "call get_dataset_info for the full list",
) -> list[str]:
    """Return list of error messages for names not found in *valid*.

    Includes close-match suggestions when available. When *valid* is empty,
    appends *empty_hint* instead of a useless fuzzy match. When no close
    match exists and *list_valid_on_miss* is set, lists the valid names so
    the caller does not have to guess again; *full_list_hint* names the tool
    to call when the valid list is truncated.
    """
    errors: list[str] = []
    for name in requested:
        if name not in valid:
            msg = f"Unknown {kind}: '{name}'"
            if not valid:
                if empty_hint:
                    msg += f". {empty_hint}"
            else:
                suggestions = difflib.get_close_matches(name, valid, n=3, cutoff=0.6)
                if suggestions:
                    msg += f". Did you mean: {', '.join(suggestions)}?"
                elif list_valid_on_miss:
                    shown = sorted(valid)[:10]
                    more = len(valid) - len(shown)
                    suffix = f" (and {more} more; {full_list_hint})" if more > 0 else ""
                    msg += f". Valid {kind}s: {', '.join(shown)}{suffix}"
            errors.append(msg)
    return errors
