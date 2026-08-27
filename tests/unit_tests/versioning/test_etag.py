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
from flask import Flask

from superset.versioning.etag import raise_for_stale_write, StaleEntityError

LIVE = "9f1f4c1e-0000-4000-8000-000000000001"


def _put(app: Flask, if_match: str | None):
    headers = {"If-Match": if_match} if if_match is not None else {}
    return app.test_request_context("/api/v1/dataset/1", method="PUT", headers=headers)


def test_no_if_match_header_passes(app: Flask) -> None:
    with _put(app, None):
        raise_for_stale_write(LIVE)


def test_matching_if_match_passes(app: Flask) -> None:
    with _put(app, f'"{LIVE}"'):
        raise_for_stale_write(LIVE)


def test_star_if_match_passes(app: Flask) -> None:
    with _put(app, "*"):
        raise_for_stale_write(LIVE)


def test_stale_if_match_raises(app: Flask) -> None:
    with _put(app, '"9f1f4c1e-0000-4000-8000-000000000002"'):
        with pytest.raises(StaleEntityError):
            raise_for_stale_write(LIVE)


def test_if_match_list_containing_live_passes(app: Flask) -> None:
    with _put(app, f'"9f1f4c1e-0000-4000-8000-000000000002", "{LIVE}"'):
        raise_for_stale_write(LIVE)


def test_no_validator_available_passes(app: Flask) -> None:
    """Version capture off (or no version rows yet) degrades to an
    unconditional write rather than blocking every save."""
    with _put(app, f'"{LIVE}"'):
        raise_for_stale_write(None)
