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
"""Shared helpers for the canvas MCP tools."""

from __future__ import annotations

from typing import Any

from superset.extensions import db


def find_canvas(identifier: int | str) -> Any:
    """Look up a Canvas by integer id or uuid string."""
    from superset.models.canvas import Canvas

    query = db.session.query(Canvas)
    if isinstance(identifier, int) or str(identifier).isdigit():
        return query.filter(Canvas.id == int(identifier)).one_or_none()
    return query.filter(Canvas.uuid == str(identifier)).one_or_none()
