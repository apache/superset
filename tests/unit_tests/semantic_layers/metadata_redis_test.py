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

"""Opt-in actual Redis acceptance; never flush a database or delete shared keys."""

from __future__ import annotations

import multiprocessing
import os
import time
from collections.abc import Iterator
from concurrent.futures import Future
from multiprocessing.context import SpawnContext
from multiprocessing.process import BaseProcess
from multiprocessing.queues import Queue
from multiprocessing.synchronize import Event
from typing import Any, cast
from urllib.parse import ParseResult, urlparse
from uuid import uuid4

import pytest
from flask import Flask
from superset_core.semantic_layers.metadata import CatalogSnapshot, MetadataRefreshError

from superset.coordination.deadline_backend import DeadlineRedisBackend
from superset.semantic_layers.cache_inspection import CacheEntryInfo
from superset.semantic_layers.metadata import ScopedMetadataStore


@pytest.fixture
def redis_config() -> dict[str, Any]:
    url: str | None = os.environ.get("SEMANTIC_METADATA_TEST_REDIS_URL")
    if url is None:
        pytest.skip(
            "Set SEMANTIC_METADATA_TEST_REDIS_URL for isolated Redis acceptance"
        )
    assert url is not None
    parsed: ParseResult = urlparse(url)
    return {
        "CACHE_TYPE": "RedisCache",
        "CACHE_REDIS_HOST": parsed.hostname,
        "CACHE_REDIS_PORT": parsed.port or 6379,
        "CACHE_REDIS_DB": int(parsed.path.lstrip("/") or "0"),
    }


@pytest.fixture
def redis_scope(redis_config: dict[str, Any]) -> Iterator[str]:
    scope: str = "sc121047-test-" + uuid4().hex
    yield scope
    backend: DeadlineRedisBackend = DeadlineRedisBackend(
        redis_config, deadline=time.monotonic() + 5
    )
    backend.delete(
        *(
            f"semantic-metadata:{{{scope}}}:{suffix}"
            for suffix in ("snapshot", "lease", "compatibility")
        )
    )


def _reader(
    config: dict[str, Any], scope: str, commands: Queue[bool], results: Queue[str]
) -> None:
    store: ScopedMetadataStore = ScopedMetadataStore(
        DeadlineRedisBackend(config, deadline=time.monotonic() + 30),
        scope,
        deadline=time.monotonic() + 30,
    )

    def forbidden(deadline: float) -> str:
        raise AssertionError("warm reader fetched upstream")

    while commands.get(timeout=10):
        results.put(store.read(forbidden).cache_token)


def _paused_writer(
    config: dict[str, Any],
    scope: str,
    started: Event,
    release: Event,
    results: Queue[str],
) -> None:
    deadline: float = time.monotonic() + 30
    store: ScopedMetadataStore = ScopedMetadataStore(
        DeadlineRedisBackend(config, deadline=deadline), scope, deadline=deadline
    )

    def fetch(budget: float) -> str:
        started.set()
        assert release.wait(10)
        return '["old"]'

    try:
        store.refresh(fetch)
        results.put("published")
    except MetadataRefreshError as error:
        results.put(error.category)


def test_two_processes_alternate_100_reads_of_one_observation(
    redis_config: dict[str, Any], redis_scope: str
) -> None:
    deadline: float = time.monotonic() + 30
    backend: DeadlineRedisBackend = DeadlineRedisBackend(
        redis_config, deadline=deadline
    )
    snapshot: CatalogSnapshot = ScopedMetadataStore(
        backend, redis_scope, deadline=deadline
    ).read(lambda budget: '["orders"]')
    context: SpawnContext = cast(SpawnContext, multiprocessing.get_context("spawn"))
    commands: list[Queue[bool]] = [context.Queue(), context.Queue()]
    results: Queue[str] = context.Queue()
    processes: list[BaseProcess] = [
        context.Process(
            target=_reader, args=(redis_config, redis_scope, queue, results)
        )
        for queue in commands
    ]
    process: BaseProcess
    index: int
    queue: Queue[bool]
    try:
        for process in processes:
            process.start()
        for index in range(100):
            commands[index % 2].put(True)
            assert results.get(timeout=10) == snapshot.cache_token
    finally:
        for queue in commands:
            queue.put(False)
        for process in processes:
            process.join(10)
            if process.is_alive():
                process.terminate()
                process.join(2)
            assert process.exitcode == 0


def test_real_invalidation_fences_a_paused_process(
    redis_config: dict[str, Any], redis_scope: str
) -> None:
    context: SpawnContext = cast(SpawnContext, multiprocessing.get_context("spawn"))
    started: Event = context.Event()
    release: Event = context.Event()
    results: Queue[str] = context.Queue()
    process: BaseProcess = context.Process(
        target=_paused_writer,
        args=(redis_config, redis_scope, started, release, results),
    )
    process.start()
    deadline: float = time.monotonic() + 30
    store: ScopedMetadataStore = ScopedMetadataStore(
        DeadlineRedisBackend(redis_config, deadline=deadline),
        redis_scope,
        deadline=deadline,
    )
    try:
        assert started.wait(10)
        store.invalidate_catalog()
        current: CatalogSnapshot = store.read(lambda budget: '["new"]')
        release.set()
        assert results.get(timeout=10) == "configuration_changed"
        assert store.peek() == current
    finally:
        release.set()
        process.join(10)
        if process.is_alive():
            process.terminate()
            process.join(2)
        assert process.exitcode == 0


def test_real_atomic_ttl_generation_and_namespace_isolation(
    redis_config: dict[str, Any], redis_scope: str
) -> None:
    deadline: float = time.monotonic() + 10
    backend: DeadlineRedisBackend = DeadlineRedisBackend(
        redis_config, deadline=deadline
    )
    store: ScopedMetadataStore = ScopedMetadataStore(
        backend, redis_scope, deadline=deadline
    )
    first: CatalogSnapshot = store.read(lambda budget: '["orders"]')
    before: CacheEntryInfo = store.inspect_catalog()
    generation: str = store.compatibility_generation()
    store.invalidate_compatibility()
    assert store.compatibility_generation() != generation
    assert store.peek() == first
    other: ScopedMetadataStore = ScopedMetadataStore(
        backend, redis_scope + "-tenant-b", deadline=deadline
    )
    assert other.peek() is None
    assert other.peek_compatibility_generation() is None
    second: CatalogSnapshot = store.refresh(lambda budget: '["orders"]').snapshot
    after: CacheEntryInfo = store.inspect_catalog()
    assert first.payload == second.payload
    assert first.cache_token != second.cache_token
    assert before.created_at != after.created_at
    assert after.state == "present"
    assert after.expiry_kind == "finite"
    assert after.remaining_ttl_seconds is not None
    assert 295 < after.remaining_ttl_seconds <= 300


@pytest.mark.parametrize("owner_fails", [False, True])
def test_real_cold_reader_waits_then_recovers_from_owner_outcome(
    redis_config: dict[str, Any], redis_scope: str, owner_fails: bool
) -> None:
    from concurrent.futures import ThreadPoolExecutor
    from threading import Event as ThreadEvent

    started: ThreadEvent = ThreadEvent()
    waiting: ThreadEvent = ThreadEvent()
    release: ThreadEvent = ThreadEvent()
    deadline: float = time.monotonic() + 5
    owner: ScopedMetadataStore = ScopedMetadataStore(
        DeadlineRedisBackend(redis_config, deadline=deadline),
        redis_scope,
        deadline=deadline,
    )

    def wait(seconds: float) -> None:
        waiting.set()
        time.sleep(seconds)

    follower: ScopedMetadataStore = ScopedMetadataStore(
        DeadlineRedisBackend(redis_config, deadline=deadline),
        redis_scope,
        deadline=deadline,
        wait=wait,
    )

    def fetch(budget: float) -> str:
        started.set()
        assert release.wait(2)
        if owner_fails:
            raise MetadataRefreshError("upstream")
        return '["owner"]'

    executor: ThreadPoolExecutor
    with ThreadPoolExecutor(max_workers=2) as executor:
        first: Future[CatalogSnapshot] = executor.submit(owner.read, fetch)
        assert started.wait(2)
        second: Future[CatalogSnapshot] = executor.submit(
            follower.read, lambda budget: '["recovered"]'
        )
        try:
            assert waiting.wait(2)
        finally:
            release.set()
        if owner_fails:
            with pytest.raises(MetadataRefreshError, match="upstream"):
                first.result(timeout=2)
            assert second.result(timeout=2).payload == '["recovered"]'
        else:
            assert first.result(timeout=2) == second.result(timeout=2)


def test_actual_blocked_redis_io_is_cancelled_by_the_shared_deadline(
    redis_config: dict[str, Any], redis_scope: str
) -> None:
    from redis.exceptions import TimeoutError as RedisTimeoutError

    started: float = time.monotonic()
    backend: DeadlineRedisBackend = DeadlineRedisBackend(
        redis_config, deadline=started + 0.1
    )
    with pytest.raises(RedisTimeoutError):
        backend.execute("BLPOP", "semantic-metadata:{" + redis_scope + "}:empty", 3)
    assert time.monotonic() - started < 0.5


def test_real_cache_inspection_observes_coherent_creation_and_ttl(
    redis_config: dict[str, Any], redis_scope: str, app: Flask
) -> None:
    from concurrent.futures import ThreadPoolExecutor
    from threading import Event as ThreadEvent

    from flask_caching import Cache

    from superset.semantic_layers.cache_inspection import inspect_data_cache

    prefix: str = redis_scope + ":inspection:"
    cache: Cache = Cache(app, config={**redis_config, "CACHE_KEY_PREFIX": prefix})
    native: Any = cache.cache
    reader: DeadlineRedisBackend = DeadlineRedisBackend(
        redis_config, deadline=time.monotonic() + 10
    )
    stop: ThreadEvent = ThreadEvent()

    def replace() -> None:
        while not stop.is_set():
            native.set("entry", {"dttm": "2026-01-01T00:00:00"}, timeout=10)
            native.set("entry", {"dttm": "2026-02-01T00:00:00"}, timeout=20)

    native.set("entry", {"dttm": "2026-01-01T00:00:00"}, timeout=10)
    executor: ThreadPoolExecutor
    try:
        with ThreadPoolExecutor(max_workers=1) as executor:
            future: Future[None] = executor.submit(replace)
            try:
                for _ in range(30):
                    info: CacheEntryInfo = inspect_data_cache(
                        cache, "entry", "query_result", backend=reader
                    )
                    assert info.created_at is not None
                    assert info.remaining_ttl_seconds is not None
                    assert (
                        info.created_at.month == 1
                        and 9 < info.remaining_ttl_seconds <= 10
                    ) or (
                        info.created_at.month == 2
                        and 19 < info.remaining_ttl_seconds <= 20
                    )
            finally:
                stop.set()
                future.result(timeout=3)
        native.set("entry", {"legacy": True}, timeout=0)
        legacy: CacheEntryInfo = inspect_data_cache(
            cache, "entry", "query_result", backend=reader
        )
        assert legacy.created_at is None
        assert legacy.expiry_kind == "none"
        native.delete("entry")
        assert (
            inspect_data_cache(cache, "entry", "query_result", backend=reader).state
            == "missing"
        )
    finally:
        stop.set()
        native.delete("entry")


@pytest.mark.parametrize("budget", [0.05, 0.15])
def test_actual_deadline_exhaustion_does_not_pin_following_readers(
    redis_config: dict[str, Any], redis_scope: str, budget: float
) -> None:
    deadline: float = time.monotonic() + budget
    owner: ScopedMetadataStore = ScopedMetadataStore(
        DeadlineRedisBackend(redis_config, deadline=deadline),
        redis_scope,
        deadline=deadline,
    )

    def exhaust(remaining_deadline: float) -> str:
        time.sleep(max(0, remaining_deadline - time.monotonic()) + 0.02)
        return "[]"

    with pytest.raises(MetadataRefreshError, match="deadline"):
        owner.refresh(exhaust)
    started: float = time.monotonic()
    follower: ScopedMetadataStore = ScopedMetadataStore(
        DeadlineRedisBackend(redis_config, deadline=started + 2),
        redis_scope,
        deadline=started + 2,
    )
    assert (
        follower.read(lambda remaining_deadline: '["recovered"]').payload
        == '["recovered"]'
    )
    assert time.monotonic() - started < 0.5
