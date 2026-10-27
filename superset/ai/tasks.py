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
Background execution of assistant turns.

Used when ``AI_ASSISTANT_EXECUTION_MODE`` is ``"worker"``. The task body is a
thin wrapper: all the work lives in
:func:`superset.ai.orchestrator.execute_turn`, so the two execution modes cannot
diverge in behaviour.

To enable, add ``"superset.ai.tasks"`` to ``CeleryConfig.imports`` and set the
execution mode and a Redis event bus.
"""

from __future__ import annotations

import logging
from typing import Any

from superset.ai.orchestrator import execute_turn, TurnRequest
from superset.extensions import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(name="ai.run_turn", bind=True, soft_time_limit=None)
def run_turn(self: Any, payload: dict[str, Any]) -> str:  # noqa: ARG001
    """
    Answer one assistant turn.

    ``acks_late`` is deliberately not set: a turn costs money to run, so
    re-delivering it after a worker crash would double-charge for an answer the
    user may already have seen part of. Losing a turn is the better failure —
    the user can ask again, and the message row records that it failed.

    Not retried for the same reason.
    """
    from superset.utils.core import override_user

    request = TurnRequest.from_payload(payload)
    # The turn runs as the user who asked for it. Without this the worker has no
    # `g.user`, and every tool that checks permissions — which is all of the ones
    # that touch data — refuses, so the model reports an authentication problem
    # instead of answering. Impersonating here rather than inside the tools keeps
    # one boundary: the run is either the user's or it does not happen.
    with override_user(_load_user(request.user_id)):
        outcome = execute_turn(request)
    logger.info("AI turn %s finished with outcome %s", request.run_id, outcome.value)
    return outcome.value


def _load_user(user_id: int | None) -> Any:
    """
    The user a queued turn belongs to.

    Returns ``None`` when the id no longer resolves — an account deleted between
    the request and the run — which leaves the tools to refuse as they would for
    any unauthenticated caller rather than running with someone else's rights.
    """
    if user_id is None:
        return None
    from superset.extensions import security_manager

    return security_manager.get_user_by_id(user_id)


def submit_turn(request: TurnRequest) -> None:
    """
    Hand a turn to a worker.

    A queueing failure is raised rather than swallowed: the caller has not yet
    flushed response headers, so it can still turn this into an honest error
    instead of a stream that never produces anything.
    """
    run_turn.delay(request.to_payload())
