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
REST API for the AI assistant.

Every route carries ``@protect()`` and is reached through ``@expose`` on a
``BaseSupersetApi`` subclass, which is what makes Flask-AppBuilder's
authorization actually run. Ownership is enforced a second time in the command
and DAO layers, so a conversation identifier is never on its own a capability.
"""

from __future__ import annotations

import logging
import time
from collections.abc import Generator
from typing import Any, cast

from flask import current_app, request, Response, stream_with_context
from flask_appbuilder.api import expose, permission_name, protect, safe
from marshmallow import ValidationError

from superset.ai.events import (
    error_event,
    KEEPALIVE_FRAME,
    KEEPALIVE_INTERVAL_SECONDS,
)
from superset.ai.schemas import (
    AgentResponseSchema,
    CancelPostSchema,
    FeedbackPostSchema,
    MessagePostSchema,
    RunAcceptedResponseSchema,
    SuggestedPromptsPostSchema,
    ThreadDetailResponseSchema,
    ThreadPostSchema,
    ThreadPutSchema,
    ThreadResponseSchema,
)
from superset.ai.types import MessageRole, MessageStatus
from superset.commands.ai.exceptions import (
    AIChatMessageInvalidError,
    AIChatMessageNotFoundError,
    AIChatThreadInvalidError,
    AIChatThreadNotFoundError,
)
from superset.extensions import event_logger
from superset.utils.core import get_user_id
from superset.utils.decorators import transaction
from superset.views.base_api import BaseSupersetApi, statsd_metrics

logger = logging.getLogger(__name__)

#: Upper bound on how long a client may hold a stream open, so an abandoned
#: browser tab cannot pin a worker indefinitely.
_STREAM_TIMEOUT_SECONDS = 900

#: How often a reader checks the event bus for new frames.
#:
#: Deliberately separate from ``KEEPALIVE_INTERVAL_SECONDS``. Passing the
#: keep-alive interval as the poll interval made the reader sleep fifteen seconds
#: between checks and then deliver everything that had accumulated in one batch —
#: so a worker-mode run showed no streaming at all: the answer and every tool call
#: appeared in fifteen-second lumps. One controls responsiveness, the other how
#: often an idle connection is reassured; they are not the same number.
_EVENT_POLL_SECONDS = 0.1


class AIRestApi(BaseSupersetApi):
    """Conversations with the AI assistant."""

    resource_name = "ai"
    openapi_spec_tag = "AI Assistant"
    allow_browser_login = True
    class_permission_name = "AIAssistant"

    openapi_spec_component_schemas = (
        AgentResponseSchema,
        CancelPostSchema,
        FeedbackPostSchema,
        MessagePostSchema,
        RunAcceptedResponseSchema,
        SuggestedPromptsPostSchema,
        ThreadDetailResponseSchema,
        ThreadPostSchema,
        ThreadPutSchema,
        ThreadResponseSchema,
    )

    @expose("/agent/", methods=("GET",))
    @protect()
    @safe
    @statsd_metrics
    @permission_name("read")
    def agents(self) -> Response:
        """List agent profiles the current user may select.
        ---
        get:
          summary: List available agent profiles
          responses:
            200:
              description: Available profiles
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      result:
                        type: array
                        items:
                          $ref: '#/components/schemas/AgentResponseSchema'
            401:
              $ref: '#/components/responses/401'
            403:
              $ref: '#/components/responses/403'
            404:
              $ref: '#/components/responses/404'
        """
        if (unavailable := self._reject_if_unconfigured()) is not None:
            return unavailable

        from superset.ai.factories import get_profiles

        profiles = get_profiles().visible_to_current_user()
        return self.response(200, result=[p.to_public_dict() for p in profiles])

    @expose("/model/", methods=("GET",))
    @protect()
    @safe
    @statsd_metrics
    @permission_name("read")
    def models(self) -> Response:
        """List models this deployment has configured.
        ---
        get:
          summary: List selectable models
          responses:
            200:
              description: Configured model identifiers
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      result:
                        type: array
                        items:
                          type: string
            401:
              $ref: '#/components/responses/401'
            404:
              $ref: '#/components/responses/404'
        """
        if (unavailable := self._reject_if_unconfigured()) is not None:
            return unavailable

        from superset.ai.factories import get_provider

        return self.response(200, result=get_provider().available_models())

    @expose("/thread/", methods=("POST",))
    @protect()
    @safe
    @statsd_metrics
    @permission_name("write")
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.post_thread",
        log_to_statsd=False,
    )
    def post_thread(self) -> Response:
        """Create a conversation.
        ---
        post:
          summary: Create a conversation
          requestBody:
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/ThreadPostSchema'
          responses:
            201:
              description: Conversation created
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      result:
                        $ref: '#/components/schemas/ThreadResponseSchema'
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            404:
              $ref: '#/components/responses/404'
        """
        if (unavailable := self._reject_if_unconfigured()) is not None:
            return unavailable

        from superset.commands.ai import CreateAIChatThreadCommand

        try:
            payload = ThreadPostSchema().load(request.json or {})
        except ValidationError as error:
            return self.response_400(message=error.messages)
        try:
            thread = CreateAIChatThreadCommand(
                user_id=self._user_id(),
                title=payload.get("title"),
                agent_key=payload.get("agent_key"),
            ).run()
        except AIChatThreadInvalidError as ex:
            return self.response_422(message=str(ex))
        return self.response(201, result=_thread_dict(thread))

    @expose("/thread/", methods=("GET",))
    @protect()
    @safe
    @statsd_metrics
    @permission_name("read")
    def get_threads(self) -> Response:
        """List the current user's conversations.
        ---
        get:
          summary: List conversations
          parameters:
          - in: query
            name: limit
            schema:
              type: integer
          - in: query
            name: offset
            schema:
              type: integer
          responses:
            200:
              description: Conversations
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      count:
                        type: integer
                      result:
                        type: array
                        items:
                          $ref: '#/components/schemas/ThreadResponseSchema'
            401:
              $ref: '#/components/responses/401'
            404:
              $ref: '#/components/responses/404'
        """
        if (unavailable := self._reject_if_unconfigured()) is not None:
            return unavailable

        from superset.daos.ai import AIChatThreadDAO

        limit = request.args.get("limit", type=int) or 50
        offset = request.args.get("offset", type=int) or 0
        threads = AIChatThreadDAO.find_all_for_user(
            self._user_id(), limit=limit, offset=offset
        )
        return self.response(
            200,
            count=len(threads),
            result=[_thread_dict(thread) for thread in threads],
        )

    @expose("/thread/<thread_uuid>", methods=("GET",))
    @protect()
    @safe
    @statsd_metrics
    @permission_name("read")
    def get_thread(self, thread_uuid: str) -> Response:
        """Fetch a conversation and its messages.
        ---
        get:
          summary: Get a conversation
          parameters:
          - in: path
            name: thread_uuid
            required: true
            schema:
              type: string
              format: uuid
          responses:
            200:
              description: Conversation with messages
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      result:
                        $ref: '#/components/schemas/ThreadDetailResponseSchema'
            401:
              $ref: '#/components/responses/401'
            404:
              $ref: '#/components/responses/404'
        """
        if (unavailable := self._reject_if_unconfigured()) is not None:
            return unavailable

        from superset.daos.ai import (
            AIChatFeedbackDAO,
            AIChatMessageDAO,
            AIChatThreadDAO,
        )

        user_id = self._user_id()
        thread = AIChatThreadDAO.find_by_uuid_for_user(thread_uuid, user_id)
        if thread is None:
            return self.response_404()

        messages = AIChatMessageDAO.find_for_thread(thread)
        # Resolved for the whole transcript at once so the panel can show which
        # replies this user already rated; without it a reload loses the verdict
        # and the message looks unrated.
        verdicts = AIChatFeedbackDAO.find_verdicts_for_user(
            [message.id for message in messages], user_id
        )
        detail = _thread_dict(thread)
        detail["messages"] = [
            _message_dict(message, liked=verdicts.get(message.id))
            for message in messages
        ]
        return self.response(200, result=detail)

    @expose("/thread/<thread_uuid>", methods=("PUT",))
    @protect()
    @safe
    @statsd_metrics
    @permission_name("write")
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.put_thread",
        log_to_statsd=False,
    )
    def put_thread(self, thread_uuid: str) -> Response:
        """Rename or archive a conversation.
        ---
        put:
          summary: Update a conversation
          parameters:
          - in: path
            name: thread_uuid
            required: true
            schema:
              type: string
              format: uuid
          requestBody:
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/ThreadPutSchema'
          responses:
            200:
              description: Conversation updated
            401:
              $ref: '#/components/responses/401'
            404:
              $ref: '#/components/responses/404'
            422:
              $ref: '#/components/responses/422'
        """
        if (unavailable := self._reject_if_unconfigured()) is not None:
            return unavailable

        from superset.commands.ai import UpdateAIChatThreadCommand

        try:
            payload = ThreadPutSchema().load(request.json or {})
        except ValidationError as error:
            return self.response_400(message=error.messages)
        try:
            thread = UpdateAIChatThreadCommand(
                thread_uuid,
                self._user_id(),
                title=payload.get("title"),
                status=payload.get("status"),
            ).run()
        except AIChatThreadNotFoundError:
            return self.response_404()
        except AIChatThreadInvalidError as ex:
            return self.response_422(message=str(ex))
        return self.response(200, result=_thread_dict(thread))

    @expose("/thread/<thread_uuid>", methods=("DELETE",))
    @protect()
    @safe
    @statsd_metrics
    @permission_name("write")
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.delete_thread",
        log_to_statsd=False,
    )
    def delete_thread(self, thread_uuid: str) -> Response:
        """Delete a conversation and its messages.
        ---
        delete:
          summary: Delete a conversation
          parameters:
          - in: path
            name: thread_uuid
            required: true
            schema:
              type: string
              format: uuid
          responses:
            200:
              description: Conversation deleted
            401:
              $ref: '#/components/responses/401'
            404:
              $ref: '#/components/responses/404'
        """
        if (unavailable := self._reject_if_unconfigured()) is not None:
            return unavailable

        from superset.commands.ai import DeleteAIChatThreadCommand

        try:
            DeleteAIChatThreadCommand(thread_uuid, self._user_id()).run()
        except AIChatThreadNotFoundError:
            return self.response_404()
        return self.response(200, message="OK")

    @expose("/thread/<thread_uuid>/message", methods=("POST",))
    @protect()
    @safe
    @statsd_metrics
    @permission_name("write")
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.post_message",
        log_to_statsd=False,
    )
    def post_message(self, thread_uuid: str) -> Response:
        """Post a user message and start a run.
        ---
        post:
          summary: Post a message
          description: >
            Stores the user's message, creates a placeholder assistant message,
            and starts a run. Returns immediately; consume the answer from the
            stream endpoint using the returned run identifier.
          parameters:
          - in: path
            name: thread_uuid
            required: true
            schema:
              type: string
              format: uuid
          requestBody:
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/MessagePostSchema'
          responses:
            202:
              description: Run accepted
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      result:
                        $ref: '#/components/schemas/RunAcceptedResponseSchema'
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            404:
              $ref: '#/components/responses/404'
            422:
              $ref: '#/components/responses/422'
        """
        if (unavailable := self._reject_if_unconfigured()) is not None:
            return unavailable

        from superset.ai.orchestrator import new_run_id
        from superset.commands.ai import AppendAIChatMessageCommand

        try:
            payload = MessagePostSchema().load(request.json or {})
        except ValidationError as error:
            return self.response_400(message=error.messages)
        user_id = self._user_id()

        try:
            user_message = AppendAIChatMessageCommand(
                thread_uuid,
                user_id,
                MessageRole.USER,
                payload["content"],
                request_id=payload.get("request_id"),
            ).run()
            # Created up front so a client that reconnects before any token
            # arrives still has a row to attach its stream to.
            assistant_message_command = AppendAIChatMessageCommand(
                thread_uuid,
                user_id,
                MessageRole.ASSISTANT,
                "",
                request_id=payload.get("request_id"),
                status=MessageStatus.PENDING,
            )
            assistant_message = assistant_message_command.run()
        except AIChatThreadNotFoundError:
            return self.response_404()
        except (AIChatMessageInvalidError, AIChatThreadInvalidError) as ex:
            return self.response_422(message=str(ex))

        if assistant_message_command.created:
            run_id = new_run_id()
            _record_run_context(assistant_message, run_id, payload)
            self._start_run(
                thread_uuid=thread_uuid,
                user_id=user_id,
                run_id=run_id,
                assistant_message_uuid=str(assistant_message.uuid),
                agent_key=payload.get("agent_key"),
                model=payload.get("model"),
                page_context=payload.get("page_context"),
            )
        else:
            # A retried idempotency key returns the run already attached to
            # the reused assistant row instead of starting inference again.
            run_id = str(
                assistant_message.extra.get("run_id") or assistant_message.uuid
            )

        return self.response(
            202,
            result={
                "message_uuid": str(user_message.uuid),
                "assistant_message_uuid": str(assistant_message.uuid),
                "run_id": run_id,
            },
        )

    @expose("/thread/<thread_uuid>/stream", methods=("GET",))
    @protect()
    @statsd_metrics
    @permission_name("read")
    def stream(self, thread_uuid: str) -> Response:
        """Stream a run's events.
        ---
        get:
          summary: Stream assistant events
          description: >
            Server-sent events for one run. Frame names are session, thinking,
            thoughts, checkpoint, assistant_delta, final, error, cancelled and
            done. The done frame is always last and reports whether the run
            succeeded.
          parameters:
          - in: path
            name: thread_uuid
            required: true
            schema:
              type: string
              format: uuid
          - in: query
            name: run_id
            required: true
            schema:
              type: string
          responses:
            200:
              description: An event stream
              content:
                text/event-stream:
                  schema:
                    type: string
            401:
              $ref: '#/components/responses/401'
            404:
              $ref: '#/components/responses/404'
        """
        # No @safe here: once headers are flushed an exception can no longer
        # become a status code, so failures are reported as in-band error frames.
        if (unavailable := self._reject_if_unconfigured()) is not None:
            return unavailable

        from superset.daos.ai import AIChatMessageDAO, AIChatThreadDAO

        run_id = request.args.get("run_id")
        if not run_id:
            return self.response_400(message="run_id is required")

        # Ownership is checked before the stream opens; the run identifier alone
        # must not grant access to another user's conversation.
        thread = AIChatThreadDAO.find_by_uuid_for_user(thread_uuid, self._user_id())
        if thread is None:
            return self.response_404()

        pending = _find_run_message(AIChatMessageDAO.find_for_thread(thread), run_id)
        if pending is None:
            return self.response_404()

        turn = None
        if current_app.config.get("AI_ASSISTANT_EXECUTION_MODE") != "worker":
            from superset.ai.orchestrator import TurnRequest

            extra = pending.extra
            turn = TurnRequest(
                thread_uuid=thread_uuid,
                user_id=self._user_id(),
                run_id=run_id,
                assistant_message_uuid=str(pending.uuid),
                profile_key=extra.get("agent_key"),
                model=extra.get("model"),
                page_context=extra.get("page_context"),
            )

        generator = self._build_stream(run_id, turn)
        response = Response(
            generator,
            content_type="text/event-stream; charset=utf-8",
            headers={
                "Cache-Control": "no-cache, no-transform",
                "Connection": "keep-alive",
                # Defeats proxy buffering, which otherwise holds frames until
                # the response completes and makes streaming pointless.
                "X-Accel-Buffering": "no",
                "Content-Encoding": "identity",
            },
            direct_passthrough=False,
        )
        response.implicit_sequence_conversion = False
        return response

    @expose("/thread/<thread_uuid>/cancel", methods=("POST",))
    @protect()
    @safe
    @statsd_metrics
    @permission_name("write")
    def cancel(self, thread_uuid: str) -> Response:
        """Ask a run to stop.
        ---
        post:
          summary: Cancel a run
          description: >
            Cancellation is cooperative: the run stops at its next step
            boundary. A run inside a single long model call or query will not
            stop until that call returns.
          parameters:
          - in: path
            name: thread_uuid
            required: true
            schema:
              type: string
              format: uuid
          requestBody:
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/CancelPostSchema'
          responses:
            200:
              description: Cancellation recorded
            401:
              $ref: '#/components/responses/401'
            404:
              $ref: '#/components/responses/404'
        """
        if (unavailable := self._reject_if_unconfigured()) is not None:
            return unavailable

        from superset.ai.orchestrator import request_cancel
        from superset.daos.ai import AIChatThreadDAO

        try:
            payload = CancelPostSchema().load(request.json or {})
        except ValidationError as error:
            return self.response_400(message=error.messages)
        if AIChatThreadDAO.find_by_uuid_for_user(thread_uuid, self._user_id()) is None:
            return self.response_404()

        request_cancel(payload["run_id"])
        return self.response(200, message="OK")

    @expose("/feedback", methods=("POST",))
    @protect()
    @safe
    @statsd_metrics
    @permission_name("write")
    def feedback(self) -> Response:
        """Rate an assistant message.
        ---
        post:
          summary: Submit feedback
          requestBody:
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/FeedbackPostSchema'
          responses:
            200:
              description: Feedback recorded
            401:
              $ref: '#/components/responses/401'
            404:
              $ref: '#/components/responses/404'
            422:
              $ref: '#/components/responses/422'
        """
        if (unavailable := self._reject_if_unconfigured()) is not None:
            return unavailable

        from superset.commands.ai import SubmitAIChatFeedbackCommand

        try:
            payload = FeedbackPostSchema().load(request.json or {})
        except ValidationError as error:
            return self.response_400(message=error.messages)
        try:
            SubmitAIChatFeedbackCommand(
                payload["message_uuid"],
                self._user_id(),
                liked=payload["liked"],
                comment=payload.get("comment"),
            ).run()
        except AIChatMessageNotFoundError:
            return self.response_404()
        except AIChatMessageInvalidError as ex:
            return self.response_422(message=str(ex))
        return self.response(200, message="OK")

    @expose("/suggested-prompts", methods=("POST",))
    @protect()
    @safe
    @statsd_metrics
    @permission_name("read")
    def suggested_prompts(self) -> Response:
        """Suggest openers for the page the user is on.
        ---
        post:
          summary: Suggest opening prompts
          requestBody:
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/SuggestedPromptsPostSchema'
          responses:
            200:
              description: Suggestions, possibly empty
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
        """
        if (unavailable := self._reject_if_unconfigured()) is not None:
            return unavailable

        from superset.ai.suggestions import suggest_prompts, suggestions_enabled

        try:
            payload = SuggestedPromptsPostSchema().load(request.json or {})
        except ValidationError as error:
            return self.response_400(message=error.messages)

        # ``enabled`` is reported rather than implied by an empty list, so the
        # client can tell "this deployment does not generate suggestions" from
        # "it does, and had nothing to suggest here" and only fall back in the
        # first case.
        return self.response(
            200,
            result={
                "enabled": suggestions_enabled(),
                "prompts": suggest_prompts(payload.get("page_context")),
            },
        )

    # ------------------------------------------------------------------
    # internals
    # ------------------------------------------------------------------

    def _build_stream(self, run_id: str, turn: Any | None) -> Any:
        """
        Build the SSE generator.

        Wrapped in :func:`~flask.stream_with_context` so the request's own
        context — and therefore ``g``, the logged-in user, and the database
        session — stays alive for as long as the stream is being consumed.

        The obvious alternative, pushing a fresh app context inside the
        generator and copying ``g`` into it, is wrong here: the security manager
        holds the scoped session, so tearing that second context down detached
        the user's ORM instance and the *next* request from that browser
        answered 401. Keeping one context avoids the problem rather than
        papering over it. The cost is that a connection is held for the run,
        which is the trade inline execution already makes.

        ``turn`` is present in inline mode, where this generator *is* the run.
        In worker mode it is ``None`` and the generator tails the event bus.
        """

        def generate() -> Generator[str, None, None]:
            try:
                if turn is not None:
                    yield from _run_inline_stream(turn)
                else:
                    yield from _tail_event_bus(run_id)
            except Exception:  # pylint: disable=broad-except
                logger.exception("AI event stream failed for run %s", run_id)
                yield error_event().encode()

        return stream_with_context(generate())

    def _start_run(
        self,
        thread_uuid: str,
        user_id: int,
        run_id: str,
        assistant_message_uuid: str,
        agent_key: str | None,
        model: str | None,
        page_context: dict[str, Any] | None = None,
    ) -> None:
        """
        Queue the run, if the configured mode needs queueing.

        Worker mode hands it to Celery here. Inline mode does nothing: the turn
        is executed by the stream endpoint itself, so that the process producing
        events is the one holding the connection. Starting it here instead —
        on a thread, publishing to an in-process queue — would work only in a
        single-worker deployment, and Superset runs several.
        """
        if current_app.config.get("AI_ASSISTANT_EXECUTION_MODE") != "worker":
            return

        from superset.ai.orchestrator import TurnRequest
        from superset.ai.tasks import submit_turn

        submit_turn(
            TurnRequest(
                thread_uuid=thread_uuid,
                user_id=user_id,
                run_id=run_id,
                assistant_message_uuid=assistant_message_uuid,
                profile_key=agent_key,
                model=model,
                page_context=page_context,
            )
        )

    def _reject_if_unconfigured(self) -> Response | None:
        """
        Refuse the request unless the assistant can serve it.

        A disabled or unconfigured assistant answers 404 rather than 501 or 503,
        so a deployment that has not enabled the feature does not advertise it.
        An unauthenticated caller should already have been stopped by
        ``@protect()``; the second check exists so that a future change to the
        decorators cannot silently turn a missing principal into a query with no
        owner scoping.
        """
        if not _is_configured():
            return self.response_404()
        if get_user_id() is None:
            return self.response_401()
        return None

    def _user_id(self) -> int:
        """
        The acting user.

        Callers reach this only after :meth:`_reject_if_unconfigured` has
        established that there is one.
        """
        return cast(int, get_user_id())


def _is_configured() -> bool:
    """Whether the feature is enabled and a provider is configured."""
    from superset.ai.factories import is_configured

    return is_configured()


@transaction()
def _record_run_context(
    message: Any,
    run_id: str,
    payload: dict[str, Any],
) -> None:
    """
    Record on the assistant message what the run needs to reconstruct itself.

    The stream endpoint reads this rather than having the client restate it, so a
    reconnecting client finds the run, and worker execution reconstructs it with
    the same context the question was asked in.
    """
    message.update_extra(
        {
            "run_id": run_id,
            "agent_key": payload.get("agent_key"),
            "model": payload.get("model"),
            "page_context": payload.get("page_context"),
        }
    )


def _find_run_message(messages: list[Any], run_id: str) -> Any | None:
    """
    The assistant message a run belongs to.

    Looked up by the run identifier recorded on it, so a stream request carries
    no state the server has to trust beyond the identifier itself.
    """
    for message in messages:
        if message.extra.get("run_id") == run_id:
            return message
    return None


def _run_inline_stream(turn: Any) -> Generator[str, None, None]:
    """Execute the turn here and emit its events as they are produced."""
    from superset.ai.orchestrator import stream_turn

    for event in stream_turn(turn):
        yield event.encode()


def _tail_event_bus(run_id: str) -> Generator[str, None, None]:
    """Follow a run happening elsewhere, with keep-alives while idle."""
    from superset.ai.eventbus import get_event_bus

    bus = get_event_bus()
    # Polling fast means most idle passes produce nothing worth sending, so the
    # keep-alive is emitted on elapsed time rather than once per empty poll —
    # otherwise the client would receive ten comment frames a second.
    last_keepalive = time.monotonic()
    try:
        for event in bus.consume(
            run_id,
            timeout_seconds=_STREAM_TIMEOUT_SECONDS,
            poll_seconds=_EVENT_POLL_SECONDS,
        ):
            if event is None:
                now = time.monotonic()
                if now - last_keepalive >= KEEPALIVE_INTERVAL_SECONDS:
                    last_keepalive = now
                    yield KEEPALIVE_FRAME
                continue
            last_keepalive = time.monotonic()
            yield event.encode()
    finally:
        bus.close(run_id)


def _thread_dict(thread: Any) -> dict[str, Any]:
    """Serialise a conversation for the API."""
    return {
        "uuid": str(thread.uuid),
        "title": thread.title,
        "status": thread.status,
        "agent_key": thread.agent_key,
        "message_count": thread.message_count,
        "created_on": thread.created_on.isoformat() if thread.created_on else None,
        "changed_on": thread.changed_on.isoformat() if thread.changed_on else None,
    }


def _message_dict(message: Any, liked: bool | None = None) -> dict[str, Any]:
    """
    Serialise a message, including what the assistant did.

    ``liked`` is the reading user's own verdict — ``None`` when they have not
    rated it. Deliberately not an aggregate over all users: this drives the
    thumb state in that user's panel, and exposing other people's votes on a
    shared conversation would be a disclosure the user never asked for.
    """
    return {
        "uuid": str(message.uuid),
        "role": message.role,
        "content": message.content,
        "status": message.status,
        "created_on": message.created_on.isoformat() if message.created_on else None,
        "extra": message.extra,
        "liked": liked,
    }
