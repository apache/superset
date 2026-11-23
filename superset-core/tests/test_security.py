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
"""``superset_core.security`` holds stubs until the host injects its own."""

from unittest.mock import MagicMock

import pytest


def test_the_stub_raises_until_the_host_injects_its_decision() -> None:
    from superset_core.security import can_access_datasource

    with pytest.raises(NotImplementedError):
        can_access_datasource(MagicMock())
