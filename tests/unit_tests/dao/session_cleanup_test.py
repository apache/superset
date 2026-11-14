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
"""The unit-test session factory must release version-capture state at teardown."""

import gc
import weakref
from collections.abc import Callable, Iterator

import pytest
from sqlalchemy.orm import Session

from superset.models.dashboard import Dashboard


@pytest.fixture(scope="module")
def released_sessions() -> Iterator[list[weakref.ReferenceType[Session]]]:
    """Module scope puts this check after all function-scoped session/mocker exits."""
    references: list[weakref.ReferenceType[Session]] = []
    yield references
    gc.collect()
    assert all(reference() is None for reference in references), (
        "unit-test sessions remain reachable after fixture teardown"
    )


@pytest.mark.parametrize("session_count", [1, 2])
def test_versioned_sessions_are_released(
    released_sessions: list[weakref.ReferenceType[Session]],
    get_session: Callable[[], Session],
    session_count: int,
) -> None:
    """Flushed, uncommitted dashboards must not pin sessions via Continuum."""
    for index in range(session_count):
        session: Session = get_session()
        Dashboard.metadata.create_all(session.get_bind())
        dashboard: Dashboard = Dashboard(dashboard_title=f"capture_{index}")
        session.add(dashboard)
        session.flush()
        released_sessions.append(weakref.ref(session))
