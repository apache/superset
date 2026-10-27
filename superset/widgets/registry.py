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
In-memory registry of Dashboard V2 widgets, keyed by widget type.

The public contract (``Widget`` base class + ``@widget`` decorator) lives in
``superset_core.widgets`` so extensions can register widgets the same way
built-ins do. This module holds only the host-side registry the concrete
decorator writes into (see
``superset.core.api.core_api_injection.inject_widget_implementations``),
mirroring ``superset.semantic_layers.registry``.
"""

from __future__ import annotations

from superset_core.widgets.base import Widget

registry: dict[str, type[Widget]] = {}
