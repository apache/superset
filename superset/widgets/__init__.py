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
Schema-driven controls for Dashboard V2 widgets (experimental).

Each data-backed widget type declares its control panel as a Pydantic
model whose JSON Schema *is* the control panel. That single backend-owned schema
drives both the human control panel (rendered generically with JSONForms in the
dashboard Inspector) and read-only MCP progressive disclosure, so an agent and a
human edit the same ``node.props`` by different routes.

This reuses the Semantic Layer's schema machinery verbatim
(``superset_core.semantic_layers.config.build_configuration_schema`` /
``check_dependencies``) and the ``x-control`` / ``x-dynamic`` / ``x-dependsOn`` /
``x-propertyOrder`` conventions.

See ``WIDGET_FRAMEWORK.md`` for the broader proposal. This POC implements only
the control-schema half of that contract; widget data is still fetched on the
frontend via the v1 ``/api/v1/chart/data`` path. In the eventual design this
package lives in ``superset-core``; it is kept in the app here to move quickly.
"""
