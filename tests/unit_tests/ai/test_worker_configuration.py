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
"""Worker transport validation happens before accepting work."""

import pytest
from flask import current_app
from pytest_mock import MockerFixture
from redis.exceptions import AuthenticationError, ConnectionError as RedisConnectionError


@pytest.mark.parametrize("cache_type", ["RedisCache", "RedisSentinelCache"])
@pytest.mark.parametrize("failure", [None, RedisConnectionError("unreachable"), AuthenticationError("invalid credential")])
def test_event_bus_probes_connection_before_use(
    mocker: MockerFixture, cache_type: str, failure: Exception | None,
) -> None:
    from superset.ai.eventbus import get_event_bus

    mocker.patch.dict(current_app.config, {
        "AI_ASSISTANT_EXECUTION_MODE": "worker",
        "AI_ASSISTANT_EVENT_BUS": "redis",
        "AI_ASSISTANT_EVENT_BUS_CACHE_CONFIG": {"CACHE_TYPE": cache_type},
    })
    ping = mocker.patch("redis.Redis.ping", return_value=True, side_effect=failure)
    if failure:
        with pytest.raises(RuntimeError, match="AI event bus Redis connection check failed") as caught:
            get_event_bus()
        assert "credential" not in str(caught.value)
    else:
        bus = get_event_bus()
        options = bus._cache._cache.connection_pool.connection_kwargs
        assert options["socket_timeout"] == 5
        assert options["socket_connect_timeout"] == 5
    ping.assert_called_once_with()


def test_submission_does_not_queue_work_when_event_bus_is_unavailable(
    mocker: MockerFixture,
) -> None:
    from superset.ai.orchestrator import TurnRequest
    from superset.ai.tasks import run_turn, submit_turn

    mocker.patch("superset.ai.eventbus.get_event_bus", side_effect=RuntimeError("connection check failed"))
    delay = mocker.patch.object(run_turn, "delay")
    request = TurnRequest(thread_uuid="thread", user_id=1, run_id="run", assistant_message_uuid="message")
    with pytest.raises(RuntimeError, match="connection check failed"):
        submit_turn(request)
    delay.assert_not_called()


def test_event_bus_rejects_an_unacknowledged_ping(mocker: MockerFixture) -> None:
    from superset.ai.eventbus import get_event_bus

    mocker.patch.dict(current_app.config, {
        "AI_ASSISTANT_EXECUTION_MODE": "worker",
        "AI_ASSISTANT_EVENT_BUS": "redis",
        "AI_ASSISTANT_EVENT_BUS_CACHE_CONFIG": {"CACHE_TYPE": "RedisCache"},
    })
    mocker.patch("redis.Redis.ping", return_value=False)
    with pytest.raises(RuntimeError, match="AI event bus Redis connection check failed"):
        get_event_bus()
