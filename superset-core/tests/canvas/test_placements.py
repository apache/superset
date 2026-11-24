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

import pytest
from superset_core.canvas import placements


def test_the_placement_lookups_wait_for_the_host() -> None:
    with pytest.raises(NotImplementedError):
        placements.load_placed_widget("1", "chart")
    with pytest.raises(NotImplementedError):
        placements.editable_widgets({"00000000-0000-4000-8000-000000000001"})


def test_a_missing_placement_is_a_lookup_error() -> None:
    assert issubclass(placements.PlacementNotFoundError, LookupError)
