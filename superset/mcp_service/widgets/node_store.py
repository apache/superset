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

"""
In-memory Dashboard V2 widget-node store, for MCP tools (experimental).

Dashboard V2's node tree (the block/widget document, including ``node.props``)
lives entirely in the frontend's in-memory ``DashboardProvider`` singleton --
there is deliberately no persistence, and no backend-addressable mirror of it.
This module is NOT that: it is a minimal, MCP-process-local registry a write
tool (``set_widget_control_values``) can locate a node in and commit validated
control values to. It does not round-trip with the frontend, does not persist
across process restarts, and is not a general dashboard/node API -- widening
its scope (default seeding, generated-value propagation, a real bridge to the
frontend's document) is explicitly out of scope here; see
``docs/superpowers/specs/2026-08-27-widget-value-write-path-design.md``.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class WidgetNode:
    widget_type: str
    props: dict[str, Any] = field(default_factory=dict)


nodes: dict[str, WidgetNode] = {}
