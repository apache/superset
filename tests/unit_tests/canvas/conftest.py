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
from collections.abc import Iterator

import pytest

from tests.unit_tests.canvas.fixtures import canvas_rules, FakeResolver


@pytest.fixture
def widgets() -> Iterator[FakeResolver]:
    """Register the test widget types and resolver with the canvas registry."""
    from superset.canvas.definition import registry

    resolver = FakeResolver(hidden={"chart-secret"})
    previous_resolver = registry.get_widget_resolver()
    test_rules = list(canvas_rules())
    for rules in test_rules:
        registry.layout_rules.register(rules)
    registry.set_widget_resolver(resolver)
    yield resolver
    registry.set_widget_resolver(previous_resolver)
    for rules in test_rules:
        registry.layout_rules.unregister(rules.widget_type)
