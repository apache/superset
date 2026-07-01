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
) -> list[str]:
    """Return list of error messages for names not found in *valid*.

    Includes close-match suggestions when available.
    """
    errors: list[str] = []
    for name in requested:
        if name not in valid:
            suggestions = difflib.get_close_matches(name, valid, n=3, cutoff=0.6)
            msg = f"Unknown {kind}: '{name}'"
            if suggestions:
                msg += f". Did you mean: {', '.join(suggestions)}?"
            errors.append(msg)
    return errors
