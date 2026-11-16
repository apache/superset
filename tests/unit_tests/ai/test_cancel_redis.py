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
"""Worker cancellation must survive the Redis wire encoding boundary."""

from typing import Any

from flask import current_app
from pytest_mock import MockerFixture
from redis.connection import Encoder


def test_worker_cancel_flag_uses_a_redis_encodable_value(
    mocker: MockerFixture,
) -> None:
    """Exercise the coordination backend's raw set/get/delete, without a server."""
    from superset.ai import orchestrator
    from superset.coordination.cache_backend import RedisCacheBackend

    encoder = Encoder("utf-8", "strict", False)
    stored: dict[str, bytes] = {}
    backend = RedisCacheBackend(host="localhost", port=1)
    transport = mocker.patch.object(backend, "_cache")

    def write(name: str, value: Any, **_kwargs: Any) -> bool:
        stored[name] = encoder.encode(value)
        return True

    transport.set.side_effect = write
    transport.get.side_effect = stored.get
    transport.delete.side_effect = lambda key: int(stored.pop(key, None) is not None)
    mocker.patch("superset.ai.eventbus.get_event_bus_backend", return_value=backend)
    mocker.patch.dict(current_app.config, {"AI_ASSISTANT_EXECUTION_MODE": "worker"})
    run_id = "worker-encoding-regression"

    orchestrator.request_cancel(run_id)
    assert run_id not in orchestrator._CANCELLED_LOCALLY
    assert orchestrator.is_cancelled(run_id)
    assert transport.set.call_args.kwargs["ex"] == orchestrator._CANCEL_TTL_SECONDS
    orchestrator.clear_cancel(run_id)
    assert not orchestrator.is_cancelled(run_id)
