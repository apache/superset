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
"""Split one pytest run into deterministic shards, one test file per shard.

Load with ``-p tests.pytest_shard`` and pass ``--num-shards N --shard-id K``
(``K`` counts from 1). Each test file lands on exactly one shard, chosen by a
stable hash of its path, so module-scoped fixtures behave as in a full run
and every pytest-xdist worker computes the same selection. The shards of one
commit together run each collected test exactly once.
"""

from __future__ import annotations

import zlib

import pytest


def pytest_addoption(parser: pytest.Parser) -> None:
    group = parser.getgroup("shard")
    group.addoption(
        "--num-shards",
        type=int,
        default=1,
        help="Number of shards the run is split into (default: 1, no split).",
    )
    group.addoption(
        "--shard-id",
        type=int,
        default=1,
        help="Which shard to run, from 1 to --num-shards.",
    )


def shard_of(nodeid: str, num_shards: int) -> int:
    """Return the 1-based shard for a test, keyed on its file path."""
    path = nodeid.split("::", 1)[0]
    return zlib.crc32(path.encode("utf-8")) % num_shards + 1


def pytest_collection_modifyitems(
    config: pytest.Config, items: list[pytest.Item]
) -> None:
    num_shards: int = config.getoption("num_shards")
    shard_id: int = config.getoption("shard_id")
    if num_shards < 1 or not 1 <= shard_id <= num_shards:
        raise pytest.UsageError(
            f"--shard-id must be between 1 and --num-shards ({num_shards}); "
            f"got {shard_id}"
        )
    if num_shards == 1:
        return
    selected = [item for item in items if shard_of(item.nodeid, num_shards) == shard_id]
    deselected = [
        item for item in items if shard_of(item.nodeid, num_shards) != shard_id
    ]
    items[:] = selected
    config.hook.pytest_deselected(items=deselected)
