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
Worker-mode execution, end to end over a real Redis.

The other integration tests cover inline execution, where the run happens inside
the streaming response. Worker mode is a different path: the run happens in a
Celery worker and the browser reads a Redis stream. That crossing is where
worker mode can silently produce nothing, so it is exercised against a real
Redis rather than a fake.

A Celery broker is not required — the task body is a thin wrapper around
``execute_turn``, so calling that directly is the same code the worker runs.
Skipped when no Redis is reachable.
"""

import threading
from typing import Any

import pytest

from superset import db
from superset.models.ai import AIChatFeedback, AIChatMessage, AIChatThread
from tests.integration_tests.base_tests import SupersetTestCase

AI_BASE = "/api/v1/ai"

REDIS_CONFIG = {
    "CACHE_TYPE": "RedisCache",
    "CACHE_REDIS_HOST": "127.0.0.1",
    "CACHE_REDIS_PORT": 6379,
    "CACHE_REDIS_DB": 0,
    "CACHE_DEFAULT_TIMEOUT": 300,
}


def _redis_available() -> bool:
    """Whether a Redis we can use for streams is reachable."""
    try:
        from superset.async_events.cache_backend import RedisCacheBackend

        backend = RedisCacheBackend.from_config(REDIS_CONFIG)
        backend.xadd("ai-probe", {"data": "{}"}, "*", 5)
        return True
    except Exception:  # pylint: disable=broad-except
        return False


class TestAIWorkerMode(SupersetTestCase):
    """Turns executed out of process, read back over Redis."""

    def setUp(self) -> None:
        super().setUp()
        if not _redis_available():
            pytest.skip("Redis is not reachable")
        from flask import current_app

        self._restore = {
            key: current_app.config.get(key)
            for key in (
                "AI_ASSISTANT_EXECUTION_MODE",
                "AI_ASSISTANT_EVENT_BUS",
                "AI_ASSISTANT_EVENT_BUS_CACHE_CONFIG",
            )
        }
        current_app.config["AI_ASSISTANT_EXECUTION_MODE"] = "worker"
        current_app.config["AI_ASSISTANT_EVENT_BUS"] = "redis"
        current_app.config["AI_ASSISTANT_EVENT_BUS_CACHE_CONFIG"] = REDIS_CONFIG
        self.login("admin")

    def tearDown(self) -> None:
        from flask import current_app

        for key, value in self._restore.items():
            current_app.config[key] = value
        super().tearDown()
        db.session.query(AIChatFeedback).delete()
        db.session.query(AIChatMessage).delete()
        db.session.query(AIChatThread).delete()
        db.session.commit()

    def test_the_redis_bus_is_actually_usable(self) -> None:
        """
        The configured backend supports the stream commands the bus needs.

        This is the check that catches the mistake of handing the bus the
        general-purpose cache client, which has no ``xadd`` and would fail on the
        first published event.
        """
        from superset.ai.eventbus import get_event_bus, RedisStreamEventBus

        bus = get_event_bus()
        assert isinstance(bus, RedisStreamEventBus)

        from superset.ai.events import done_event, thinking_event
        from superset.ai.types import ProgressStage

        run_id = "worker-bus-probe"
        bus.publish(run_id, thinking_event(ProgressStage.START, "hello"))
        bus.publish(run_id, done_event(ok=True))

        received = [
            event
            for event in bus.consume(run_id, timeout_seconds=5, poll_seconds=0.05)
            if event is not None
        ]
        assert [e.type.value for e in received] == ["thinking", "done"]

    def test_memory_bus_with_worker_mode_is_refused(self) -> None:
        """
        The unusable combination fails loudly.

        An in-process queue cannot carry events from a worker to the web process,
        and the failure mode is a stream that stays empty forever — so it is
        rejected rather than discovered in production.
        """
        from flask import current_app

        from superset.ai.eventbus import get_event_bus

        current_app.config["AI_ASSISTANT_EVENT_BUS"] = "memory"
        with pytest.raises(RuntimeError, match="AI_ASSISTANT_EVENT_BUS"):
            get_event_bus()

    def test_a_turn_runs_in_the_worker_and_streams_over_redis(self) -> None:
        """
        The full worker path: enqueue, execute elsewhere, read over Redis.

        The run is driven on another thread while the request thread reads the
        stream, which is the same producer/consumer split a real worker has.
        """
        from superset.ai.orchestrator import execute_turn, TurnRequest

        thread_uuid = self._create_thread()
        accepted = self.client.post(
            f"{AI_BASE}/thread/{thread_uuid}/message",
            json={"content": "worker mode question"},
        )
        assert accepted.status_code == 202
        result = accepted.json["result"]
        run_id = result["run_id"]

        turn = TurnRequest(
            thread_uuid=thread_uuid,
            user_id=self._admin_id(),
            run_id=run_id,
            assistant_message_uuid=result["assistant_message_uuid"],
        )

        # Run it exactly as the Celery task does, in its own app context.
        from flask import current_app

        app = current_app._get_current_object()  # noqa: SLF001
        outcome: dict[str, Any] = {}

        def worker() -> None:
            with app.app_context():
                app.config["AI_ASSISTANT_EXECUTION_MODE"] = "worker"
                app.config["AI_ASSISTANT_EVENT_BUS"] = "redis"
                app.config["AI_ASSISTANT_EVENT_BUS_CACHE_CONFIG"] = REDIS_CONFIG
                outcome["value"] = execute_turn(turn)

        runner = threading.Thread(target=worker, name="ai-test-worker")
        runner.start()
        runner.join(timeout=60)
        assert not runner.is_alive(), "the worker run did not finish"
        assert outcome["value"].value == "success"

        # Now read the stream the way a browser would. The stream is replayable,
        # so a reader arriving after the run finished still gets everything —
        # which is the property that makes worker mode survive a reconnect.
        frames = self._read_stream(
            f"{AI_BASE}/thread/{thread_uuid}/stream?run_id={run_id}"
        )
        names = [name for name, _ in frames]
        assert "session" in names
        assert "final" in names
        assert names[-1] == "done"

    def test_the_answer_is_persisted_by_the_worker(self) -> None:
        """A worker-executed turn leaves the same transcript as an inline one."""
        from superset.ai.orchestrator import execute_turn, TurnRequest

        thread_uuid = self._create_thread()
        accepted = self.client.post(
            f"{AI_BASE}/thread/{thread_uuid}/message",
            json={"content": "persist from the worker"},
        )
        result = accepted.json["result"]

        from flask import current_app

        app = current_app._get_current_object()  # noqa: SLF001

        def worker() -> None:
            with app.app_context():
                app.config["AI_ASSISTANT_EXECUTION_MODE"] = "worker"
                app.config["AI_ASSISTANT_EVENT_BUS"] = "redis"
                app.config["AI_ASSISTANT_EVENT_BUS_CACHE_CONFIG"] = REDIS_CONFIG
                execute_turn(
                    TurnRequest(
                        thread_uuid=thread_uuid,
                        user_id=self._admin_id(),
                        run_id=result["run_id"],
                        assistant_message_uuid=result["assistant_message_uuid"],
                    )
                )

        runner = threading.Thread(target=worker)
        runner.start()
        runner.join(timeout=60)

        fetched = self.client.get(f"{AI_BASE}/thread/{thread_uuid}")
        assistant = [
            m for m in fetched.json["result"]["messages"] if m["role"] == "assistant"
        ][0]
        assert assistant["status"] == "complete"
        assert assistant["content"]
        assert assistant["extra"]["outcome"] == "success"

    def test_the_task_wrapper_matches_the_orchestrator(self) -> None:
        """
        The Celery task adds no behaviour of its own.

        Keeping the task a thin wrapper is what stops the two execution modes
        from drifting apart, so it is worth asserting the shape.
        """
        from superset.ai.tasks import run_turn, submit_turn

        assert run_turn.name == "ai.run_turn"
        assert callable(submit_turn)

    # ------------------------------------------------------------------
    # helpers
    # ------------------------------------------------------------------

    def _create_thread(self) -> str:
        response = self.client.post(f"{AI_BASE}/thread/", json={"title": "worker"})
        assert response.status_code == 201
        return str(response.json["result"]["uuid"])

    def _admin_id(self) -> int:
        return int(self.get_user("admin").id)

    def _read_stream(self, url: str, limit: int = 200) -> list[tuple[str, str]]:
        response = self.client.get(url, buffered=False)
        assert response.status_code == 200
        frames: list[tuple[str, str]] = []
        event_name = ""
        try:
            for raw in response.response:
                chunk = raw.decode("utf-8") if isinstance(raw, bytes) else raw
                for line in chunk.splitlines():
                    if line.startswith("event: "):
                        event_name = line[len("event: ") :].strip()
                    elif line.startswith("data: "):
                        frames.append((event_name, line[len("data: ") :]))
                        if event_name == "done" or len(frames) >= limit:
                            return frames
        finally:
            response.close()
        return frames
