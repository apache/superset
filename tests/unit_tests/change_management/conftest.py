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
"""Running the extension's own tests against an unmodified Superset.

The framework has no test harness for an extension backend: extension
modules are imported by ``init_extensions`` inside a running app and are
not importable any other way, so there is nothing to point pytest at.
A local extension is still a plain package on disk, which is the whole
workaround here -- its ``src`` goes on the path and the gate is bound the
same way the entrypoint binds it at app init.

That is the fifth framework gap the conversion found, and the one with no
partial answer: these tests pass because this extension happens to be
unpacked on disk. A ``.supx`` loaded through ``InMemoryLoader`` could not
be tested at all.
"""

import sys
from pathlib import Path
from typing import Any

import pytest
from pytest_mock import MockerFixture
from sqlalchemy.orm.session import Session

EXTENSION_SRC = (
    Path(__file__).resolve().parents[3]
    / "local_extensions"
    / "asset-approval"
    / "backend"
    / "src"
)

if str(EXTENSION_SRC) not in sys.path:
    sys.path.insert(0, str(EXTENSION_SRC))


@pytest.fixture(autouse=True, scope="session")
def bind_review_gate() -> None:
    """Wrap the host's write paths, as the entrypoint does at app init.

    Session-scoped because the bindings replace methods on the host's own
    command classes: binding twice would wrap the wrappers and gate every
    write path a second time.
    """
    from asset_approval.bindings import install_bindings, install_review_commands

    install_review_commands()
    install_bindings()


@pytest.fixture(autouse=True, scope="module")
def answer_gate_signals(app: object) -> None:
    """Install the gate's HTTP layer on the test app.

    The app fixture is built by Superset's own conftest, so
    ``init_extensions`` never runs and nothing registers the error
    handlers or the ``after_request`` hook that turn a gate signal into a
    202 or a 409, and nothing registers the review API the approvals
    pages read. Module-scoped because the app fixture is: each module gets
    a fresh app, and these have to be registered before it serves a
    request.
    """
    with app.app_context():  # type: ignore[attr-defined]
        # The import has to happen inside the context too: importing the
        # entrypoint runs its module-level ``init()``, which creates the
        # extension's tables and so reaches for ``db.engine``.
        from asset_approval.entrypoint import install_http, install_views

        install_http()
        install_views()


class _ScopedSessionShim:
    """``db.session`` as production has it: callable, proxying the rest.

    In production ``superset.db.session`` is a ``scoped_session``, so
    ``db.session()`` returns the session for the current scope. Superset's
    unit-test harness patches it with a plain ``Session``, which is not
    callable, and any product code taking that route raises ``TypeError``
    before the test reaches what it meant to exercise.
    """

    def __init__(self, session: Session) -> None:
        self._session = session

    def __call__(self) -> Session:
        return self._session

    def __getattr__(self, name: str) -> Any:
        return getattr(self._session, name)


@pytest.fixture
def callable_db_session(mocker: MockerFixture, session: Session) -> Session:
    """``session``, but reachable through ``db.session()`` as well."""
    mocker.patch("superset.db.session", _ScopedSessionShim(session))
    return session
