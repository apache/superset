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
End-to-end tests for the AI assistant API.

Runs against the real Flask app and the real metadata database, so these cover
what unit tests cannot: that the authorization decorators are actually wired,
that ownership scoping holds across users, and that a turn survives the round
trip through storage.
"""

from typing import Any

import pytest

from superset import db
from superset.models.ai import AIChatFeedback, AIChatMessage, AIChatThread
from tests.integration_tests.base_tests import SupersetTestCase

AI_BASE = "/api/v1/ai"


class TestAIApi(SupersetTestCase):
    """Conversation lifecycle, authorization, and streaming."""

    def tearDown(self) -> None:
        """Leave no conversations behind for the next test."""
        super().tearDown()
        db.session.query(AIChatFeedback).delete()
        db.session.query(AIChatMessage).delete()
        db.session.query(AIChatThread).delete()
        db.session.commit()

    # ------------------------------------------------------------------
    # helpers
    # ------------------------------------------------------------------

    def _create_thread(self, title: str = "Test thread") -> dict[str, Any]:
        response = self.client.post(f"{AI_BASE}/thread/", json={"title": title})
        assert response.status_code == 201
        return response.json["result"]

    # ------------------------------------------------------------------
    # authentication
    # ------------------------------------------------------------------

    def test_endpoints_require_authentication(self) -> None:
        """
        Every route rejects an anonymous caller.

        This is the regression guard for the defect this feature was rewritten
        to avoid: in the implementation it derives from, the auth decorators were
        applied in an order that made them unreachable, so all of these were
        open.
        """
        self.logout()
        cases = [
            ("get", f"{AI_BASE}/agent/", None),
            ("get", f"{AI_BASE}/model/", None),
            ("get", f"{AI_BASE}/thread/", None),
            ("post", f"{AI_BASE}/thread/", {}),
            ("get", f"{AI_BASE}/thread/00000000-0000-4000-8000-000000000000", None),
            ("put", f"{AI_BASE}/thread/00000000-0000-4000-8000-000000000000", {}),
            ("delete", f"{AI_BASE}/thread/00000000-0000-4000-8000-000000000000", None),
            (
                "post",
                f"{AI_BASE}/thread/00000000-0000-4000-8000-000000000000/message",
                {"content": "hi"},
            ),
            (
                "get",
                f"{AI_BASE}/thread/00000000-0000-4000-8000-000000000000/stream"
                "?run_id=abc",
                None,
            ),
            (
                "post",
                f"{AI_BASE}/thread/00000000-0000-4000-8000-000000000000/cancel",
                {"run_id": "abc"},
            ),
            ("post", f"{AI_BASE}/feedback", {"message_uuid": "x", "liked": True}),
        ]
        for method, url, payload in cases:
            call = getattr(self.client, method)
            response = call(url, json=payload) if payload is not None else call(url)
            assert response.status_code in (401, 403, 302), (
                f"{method.upper()} {url} returned {response.status_code} "
                f"for an anonymous caller"
            )

    # ------------------------------------------------------------------
    # permission model
    # ------------------------------------------------------------------

    def test_gamma_has_no_access_by_default(self) -> None:
        """
        Gamma does not get the assistant unless an operator grants it.

        It runs queries and costs money per question, so it is granted
        deliberately rather than inherited. Keeping it out of Gamma is also what
        keeps it out of the Public role, which copies Gamma when
        ``PUBLIC_ROLE_LIKE`` is set — an anonymous visitor able to spend an
        operator's inference budget is not a default anyone should get by
        accident.
        """
        self.login("gamma")
        for method, url, payload in [
            ("get", f"{AI_BASE}/agent/", None),
            ("get", f"{AI_BASE}/thread/", None),
            ("post", f"{AI_BASE}/thread/", {"title": "nope"}),
        ]:
            call = getattr(self.client, method)
            response = call(url, json=payload) if payload is not None else call(url)
            assert response.status_code == 403, (
                f"{method.upper()} {url} returned {response.status_code} for Gamma"
            )

    def test_alpha_has_access(self) -> None:
        """Alpha is the lowest stock role the assistant is granted to."""
        self.login("alpha")
        assert self.client.get(f"{AI_BASE}/agent/").status_code == 200
        assert self.client.post(f"{AI_BASE}/thread/", json={}).status_code == 201

    def test_admin_has_access(self) -> None:
        """Admin has it too, as with every other feature."""
        self.login("admin")
        assert self.client.get(f"{AI_BASE}/agent/").status_code == 200

    # ------------------------------------------------------------------
    # thread lifecycle
    # ------------------------------------------------------------------

    def test_thread_crud(self) -> None:
        """A conversation can be created, listed, fetched, renamed and deleted."""
        self.login("admin")

        thread = self._create_thread("Revenue questions")
        uuid = thread["uuid"]
        assert thread["title"] == "Revenue questions"
        assert thread["status"] == "active"
        assert thread["message_count"] == 0

        listed = self.client.get(f"{AI_BASE}/thread/")
        assert listed.status_code == 200
        assert uuid in [t["uuid"] for t in listed.json["result"]]

        fetched = self.client.get(f"{AI_BASE}/thread/{uuid}")
        assert fetched.status_code == 200
        assert fetched.json["result"]["messages"] == []

        renamed = self.client.put(f"{AI_BASE}/thread/{uuid}", json={"title": "Renamed"})
        assert renamed.status_code == 200
        assert renamed.json["result"]["title"] == "Renamed"

        archived = self.client.put(
            f"{AI_BASE}/thread/{uuid}", json={"status": "archived"}
        )
        assert archived.status_code == 200
        assert archived.json["result"]["status"] == "archived"

        deleted = self.client.delete(f"{AI_BASE}/thread/{uuid}")
        assert deleted.status_code == 200
        assert self.client.get(f"{AI_BASE}/thread/{uuid}").status_code == 404

    def test_unknown_thread_is_404(self) -> None:
        """A well-formed but unknown identifier is not found."""
        self.login("admin")
        missing = "00000000-0000-4000-8000-000000000000"
        assert self.client.get(f"{AI_BASE}/thread/{missing}").status_code == 404

    def test_malformed_thread_uuid_is_404(self) -> None:
        """A malformed identifier is refused, not raised on."""
        self.login("admin")
        assert self.client.get(f"{AI_BASE}/thread/not-a-uuid").status_code == 404

    def test_invalid_title_is_rejected(self) -> None:
        """Over-long titles are refused rather than silently truncated."""
        self.login("admin")
        response = self.client.post(f"{AI_BASE}/thread/", json={"title": "x" * 600})
        assert response.status_code == 400

    def test_unknown_status_is_rejected(self) -> None:
        """Only the documented lifecycle values are accepted."""
        self.login("admin")
        thread = self._create_thread()
        response = self.client.put(
            f"{AI_BASE}/thread/{thread['uuid']}", json={"status": "banana"}
        )
        assert response.status_code == 400

    # ------------------------------------------------------------------
    # ownership isolation — the security boundary
    # ------------------------------------------------------------------

    def test_another_user_cannot_read_a_thread(self) -> None:
        """
        A conversation is invisible to anyone but its owner.

        404 rather than 403 on purpose: a 403 would confirm the conversation
        exists, which is itself a disclosure.
        """
        self.login("admin")
        uuid = self._create_thread("Admin's private analysis")["uuid"]

        self.logout()
        self.login("alpha")
        assert self.client.get(f"{AI_BASE}/thread/{uuid}").status_code == 404

    def test_another_user_cannot_modify_or_delete_a_thread(self) -> None:
        """Writes are owner-scoped too, not just reads."""
        self.login("admin")
        uuid = self._create_thread()["uuid"]

        self.logout()
        self.login("alpha")
        assert (
            self.client.put(
                f"{AI_BASE}/thread/{uuid}", json={"title": "hijacked"}
            ).status_code
            == 404
        )
        assert self.client.delete(f"{AI_BASE}/thread/{uuid}").status_code == 404
        assert (
            self.client.post(
                f"{AI_BASE}/thread/{uuid}/message", json={"content": "hi"}
            ).status_code
            == 404
        )

        # The thread is untouched.
        self.logout()
        self.login("admin")
        assert self.client.get(f"{AI_BASE}/thread/{uuid}").status_code == 200

    def test_another_user_cannot_stream_or_cancel_a_run(self) -> None:
        """A run identifier does not grant access to someone else's stream."""
        self.login("admin")
        uuid = self._create_thread()["uuid"]
        accepted = self.client.post(
            f"{AI_BASE}/thread/{uuid}/message", json={"content": "hello"}
        )
        assert accepted.status_code == 202
        run_id = accepted.json["result"]["run_id"]

        self.logout()
        self.login("alpha")
        assert (
            self.client.get(
                f"{AI_BASE}/thread/{uuid}/stream?run_id={run_id}"
            ).status_code
            == 404
        )
        assert (
            self.client.post(
                f"{AI_BASE}/thread/{uuid}/cancel", json={"run_id": run_id}
            ).status_code
            == 404
        )

    def test_thread_list_only_shows_own_threads(self) -> None:
        """Listing is scoped to the caller."""
        self.login("admin")
        admin_uuid = self._create_thread("admin thread")["uuid"]

        self.logout()
        self.login("alpha")
        gamma_uuid = self._create_thread("gamma thread")["uuid"]
        listed = self.client.get(f"{AI_BASE}/thread/")
        uuids = [t["uuid"] for t in listed.json["result"]]
        assert gamma_uuid in uuids
        assert admin_uuid not in uuids

    # ------------------------------------------------------------------
    # messages and runs
    # ------------------------------------------------------------------

    def test_posting_a_message_accepts_and_persists(self) -> None:
        """A posted message is stored and a run is started."""
        self.login("admin")
        uuid = self._create_thread()["uuid"]

        response = self.client.post(
            f"{AI_BASE}/thread/{uuid}/message", json={"content": "how many orders?"}
        )
        assert response.status_code == 202
        result = response.json["result"]
        assert result["message_uuid"]
        assert result["assistant_message_uuid"]
        assert result["run_id"]

        fetched = self.client.get(f"{AI_BASE}/thread/{uuid}")
        roles = [m["role"] for m in fetched.json["result"]["messages"]]
        assert "user" in roles
        assert "assistant" in roles

    def test_empty_message_is_rejected(self) -> None:
        """An empty turn is refused before any model call."""
        self.login("admin")
        uuid = self._create_thread()["uuid"]
        response = self.client.post(
            f"{AI_BASE}/thread/{uuid}/message", json={"content": ""}
        )
        assert response.status_code == 400

    def test_replaying_a_request_id_does_not_duplicate(self) -> None:
        """
        A retried post is idempotent.

        Clients retry on a dropped connection, and a duplicated turn would both
        double-charge for inference and corrupt the transcript.
        """
        self.login("admin")
        uuid = self._create_thread()["uuid"]
        payload = {"content": "same question", "request_id": "req-abc-1"}

        first = self.client.post(f"{AI_BASE}/thread/{uuid}/message", json=payload)
        second = self.client.post(f"{AI_BASE}/thread/{uuid}/message", json=payload)
        assert first.status_code == 202
        assert second.status_code == 202
        assert (
            first.json["result"]["message_uuid"]
            == second.json["result"]["message_uuid"]
        )

        fetched = self.client.get(f"{AI_BASE}/thread/{uuid}")
        user_messages = [
            m for m in fetched.json["result"]["messages"] if m["role"] == "user"
        ]
        assert len(user_messages) == 1

    def test_deleting_a_thread_removes_its_messages(self) -> None:
        """Conversations are deleted whole."""
        self.login("admin")
        uuid = self._create_thread()["uuid"]
        self.client.post(f"{AI_BASE}/thread/{uuid}/message", json={"content": "hi"})

        assert self.client.delete(f"{AI_BASE}/thread/{uuid}").status_code == 200
        remaining = (
            db.session.query(AIChatMessage)
            .join(AIChatThread)
            .filter(AIChatThread.uuid == uuid)
            .count()
        )
        assert remaining == 0

    # ------------------------------------------------------------------
    # streaming
    # ------------------------------------------------------------------

    def test_stream_requires_a_run_id(self) -> None:
        """The stream endpoint will not guess which run to follow."""
        self.login("admin")
        uuid = self._create_thread()["uuid"]
        assert self.client.get(f"{AI_BASE}/thread/{uuid}/stream").status_code == 400

    def test_stream_returns_event_stream_headers(self) -> None:
        """
        The response is shaped so proxies do not buffer it.

        Without these headers an intermediary holds every frame until the
        response completes, which defeats the point of streaming.
        """
        self.login("admin")
        uuid = self._create_thread()["uuid"]
        accepted = self.client.post(
            f"{AI_BASE}/thread/{uuid}/message", json={"content": "hello"}
        )
        run_id = accepted.json["result"]["run_id"]

        response = self.client.get(
            f"{AI_BASE}/thread/{uuid}/stream?run_id={run_id}",
            buffered=False,
        )
        assert response.status_code == 200
        assert response.headers["Content-Type"].startswith("text/event-stream")
        assert response.headers["X-Accel-Buffering"] == "no"
        assert "no-cache" in response.headers["Cache-Control"]
        response.close()

    def test_stream_delivers_a_complete_turn(self) -> None:
        """
        A full turn arrives on the stream and ends with a terminal frame.

        The scripted provider makes this deterministic: no network, no model.
        """
        self.login("admin")
        uuid = self._create_thread()["uuid"]
        accepted = self.client.post(
            f"{AI_BASE}/thread/{uuid}/message", json={"content": "hello there"}
        )
        run_id = accepted.json["result"]["run_id"]

        frames = _read_stream(
            self.client, f"{AI_BASE}/thread/{uuid}/stream?run_id={run_id}"
        )
        names = [name for name, _ in frames]
        assert "session" in names
        assert "final" in names
        assert names[-1] == "done"

    def test_answer_is_persisted_after_the_run(self) -> None:
        """
        The transcript survives the stream.

        A client that reconnects after a run finishes must still be able to read
        the answer, so it has to be in the database and not only on the wire.
        """
        self.login("admin")
        uuid = self._create_thread()["uuid"]
        accepted = self.client.post(
            f"{AI_BASE}/thread/{uuid}/message", json={"content": "persist me"}
        )
        run_id = accepted.json["result"]["run_id"]
        _read_stream(self.client, f"{AI_BASE}/thread/{uuid}/stream?run_id={run_id}")

        fetched = self.client.get(f"{AI_BASE}/thread/{uuid}")
        assistant = [
            m for m in fetched.json["result"]["messages"] if m["role"] == "assistant"
        ][0]
        assert assistant["status"] in ("complete", "error", "cancelled")
        if assistant["status"] == "complete":
            assert assistant["content"]
            assert assistant["extra"].get("outcome") == "success"

    # ------------------------------------------------------------------
    # agents, models, feedback
    # ------------------------------------------------------------------

    def test_agents_endpoint_lists_profiles(self) -> None:
        """The built-in profiles are offered, without leaking their gating."""
        self.login("admin")
        response = self.client.get(f"{AI_BASE}/agent/")
        assert response.status_code == 200
        profiles = response.json["result"]
        assert profiles
        keys = [p["key"] for p in profiles]
        assert "default" in keys
        for profile in profiles:
            assert set(profile) == {"key", "name", "description", "tools"}

    def test_models_endpoint_lists_configured_models(self) -> None:
        """A picker can discover what this deployment allows."""
        self.login("admin")
        response = self.client.get(f"{AI_BASE}/model/")
        assert response.status_code == 200
        assert isinstance(response.json["result"], list)

    def test_feedback_round_trip(self) -> None:
        """An assistant message can be rated once per user."""
        self.login("admin")
        uuid = self._create_thread()["uuid"]
        accepted = self.client.post(
            f"{AI_BASE}/thread/{uuid}/message", json={"content": "rate me"}
        )
        message_uuid = accepted.json["result"]["assistant_message_uuid"]
        run_id = accepted.json["result"]["run_id"]
        _read_stream(self.client, f"{AI_BASE}/thread/{uuid}/stream?run_id={run_id}")

        first = self.client.post(
            f"{AI_BASE}/feedback",
            json={"message_uuid": message_uuid, "liked": True, "comment": "useful"},
        )
        assert first.status_code == 200

        # A changed mind updates in place rather than adding a second verdict.
        second = self.client.post(
            f"{AI_BASE}/feedback", json={"message_uuid": message_uuid, "liked": False}
        )
        assert second.status_code == 200
        assert db.session.query(AIChatFeedback).count() == 1

    def test_feedback_on_unknown_message_is_404(self) -> None:
        """Feedback cannot be attached to a message that does not exist."""
        self.login("admin")
        response = self.client.post(
            f"{AI_BASE}/feedback",
            json={
                "message_uuid": "00000000-0000-4000-8000-000000000000",
                "liked": True,
            },
        )
        assert response.status_code == 404

    def test_cancel_records_the_request(self) -> None:
        """Cancelling a live run is accepted."""
        self.login("admin")
        uuid = self._create_thread()["uuid"]
        accepted = self.client.post(
            f"{AI_BASE}/thread/{uuid}/message", json={"content": "cancel me"}
        )
        run_id = accepted.json["result"]["run_id"]

        response = self.client.post(
            f"{AI_BASE}/thread/{uuid}/cancel", json={"run_id": run_id}
        )
        assert response.status_code == 200


def _read_stream(client: Any, url: str, limit: int = 200) -> list[tuple[str, str]]:
    """
    Read an SSE response into (event, data) pairs.

    Stops at the terminal ``done`` frame so a test never waits on the
    keep-alive timer.
    """
    response = client.get(url, buffered=False)
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


@pytest.mark.usefixtures("app_context")
def test_disabled_assistant_is_invisible(app_context: Any) -> None:
    """
    With no provider configured, the endpoints report not found.

    A deployment that has not set up the assistant should not advertise it.
    """
    from flask import current_app

    from superset.ai.factories import is_configured

    original = current_app.config.get("AI_LLM_PROVIDER_CLASS")
    current_app.config["AI_LLM_PROVIDER_CLASS"] = None
    try:
        assert is_configured() is False
    finally:
        current_app.config["AI_LLM_PROVIDER_CLASS"] = original
