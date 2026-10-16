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
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND,
# either express or implied.  See the License for the specific
# language governing permissions and limitations under the
# License.
"""
Sole-input mypy regression check for ``UUIDMixin.uuid``'s nullable type.

``superset/models/helpers.py`` declares ``UUIDMixin.uuid`` through
``@declared_attr`` with an explicit ``Mapped[Optional[uuid.UUID]]`` return
annotation so that mypy resolves the attribute deterministically even when it
checks a single file in isolation, which is how the per-PR pre-commit run
works (it only lints changed files). A plain ``uuid = sa.Column(...)`` class
attribute resolves to ``Any`` in that scoped mode, which is what let the
unnarrowed ``.uuid`` reads behind #44394, #44424, #44648 and #44789 through.

This is deliberately not a pytest test: it has no runtime assertions and is
only meaningful when mypy checks it as the SOLE input. CI runs the mypy hook
against just this file (see ``.github/workflows/pre-commit.yml``); the
``assert_type`` calls below fail if the declaration is ever reverted to a
plain column attribute.
"""

from typing import assert_type, Optional
from uuid import UUID

from superset.models.dashboard import Dashboard
from superset.models.helpers import UUIDMixin


def check_uuid_resolves_as_nullable(dashboard: Dashboard, mixin: UUIDMixin) -> None:
    assert_type(dashboard.uuid, Optional[UUID])
    assert_type(mixin.uuid, Optional[UUID])
