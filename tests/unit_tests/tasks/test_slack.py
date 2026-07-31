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
from pytest_mock import MockerFixture

from superset.app import SupersetApp
from superset.constants import CACHE_DISABLED_TIMEOUT
from superset.tasks.slack import cache_channels


def test_cache_channels_requires_a_successful_cache_write(
    app: SupersetApp,
    mocker: MockerFixture,
) -> None:
    app.config["SLACK_CACHE_TIMEOUT"] = 123
    app.config["SLACK_API_RATE_LIMIT_RETRY_COUNT"] = 4
    get_channels = mocker.patch("superset.tasks.slack.get_channels")

    cache_channels.run()

    get_channels.assert_called_once_with(
        force=True,
        cache_timeout=123,
        raise_on_cache_write_error=True,
    )


def test_cache_channels_warns_when_caching_is_disabled(
    app: SupersetApp,
    mocker: MockerFixture,
) -> None:
    app.config["SLACK_CACHE_TIMEOUT"] = CACHE_DISABLED_TIMEOUT
    get_channels = mocker.patch("superset.tasks.slack.get_channels")
    logger = mocker.patch("superset.tasks.slack.logger")

    cache_channels.run()

    get_channels.assert_not_called()
    logger.warning.assert_called_once_with(
        "Skipping Slack channels cache warm-up because "
        "SLACK_CACHE_TIMEOUT disables caching"
    )


def test_cache_channels_rolls_back_a_failed_cache_write(
    app: SupersetApp,
    mocker: MockerFixture,
) -> None:
    app.config["SLACK_CACHE_TIMEOUT"] = 123
    mocker.patch(
        "superset.tasks.slack.get_channels",
        side_effect=ConnectionError("metastore unavailable"),
    )
    db = mocker.patch("superset.db")

    with pytest.raises(ConnectionError, match="metastore unavailable"):
        cache_channels.run()

    db.session.commit.assert_not_called()
    db.session.rollback.assert_called_once_with()
