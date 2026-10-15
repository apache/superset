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
from unittest.mock import patch

import pytest

from tests.unit_tests.canvas.fixtures import canvas_widget_types, FakeResolver


@pytest.fixture
def widget_types() -> Iterator[FakeResolver]:
    """Swap in the test widgets and a persisted-instance resolver."""
    from superset.canvas.definition import registry
    from superset.widgets.registry import registry as widget_registry

    resolver = FakeResolver(hidden={"chart-secret"})
    previous_resolver = registry.get_widget_resolver()
    registry.set_widget_resolver(resolver)
    with patch.dict(widget_registry, canvas_widget_types(), clear=True):
        yield resolver
    registry.set_widget_resolver(previous_resolver)
