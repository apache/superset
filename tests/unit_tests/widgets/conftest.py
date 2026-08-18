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
Make the ``@widget`` decorator concrete and register the built-in widgets
before any test module in this directory is collected.

These are lightweight unit tests that don't spin up the full app fixture, but
``superset.widgets.builtin`` applies ``@widget`` at import time — which is a
stub until ``inject_widget_implementations`` runs. conftest.py is imported
before its sibling test modules, so injecting here guarantees the decorator is
live (and the registry populated) first. The injection needs no app context.
"""

from superset.core.api.core_api_injection import inject_widget_implementations

inject_widget_implementations()
