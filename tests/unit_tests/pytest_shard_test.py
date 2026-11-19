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
from tests.pytest_shard import shard_of


def test_shard_of_keeps_a_file_on_one_shard() -> None:
    """Every test in a file lands on the same shard, so module fixtures hold."""
    shards = {
        shard_of(f"tests/unit_tests/foo_test.py::{name}", 3)
        for name in ("test_a", "TestBar::test_b", "test_c[param]")
    }
    assert len(shards) == 1


def test_shard_of_covers_every_shard_within_range() -> None:
    """Shard ids stay in 1..N, and a realistic set of files reaches all of them."""
    files = [f"tests/unit_tests/module_{i}_test.py" for i in range(200)]
    assert {shard_of(path, 3) for path in files} == {1, 2, 3}
