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
from __future__ import annotations

import copy
from collections.abc import Iterator

import pytest

from superset.config import DEFAULT_FEATURE_FLAGS
from superset.extensions import csrf


@pytest.fixture(autouse=True, scope="module")
def _clean_global_state() -> Iterator[None]:
    """Snapshot and restore global singletons that leak across modules.

    Tests in this package may set ``ENABLE_EXTENSIONS=True`` via the
    parametrized ``app`` fixture.  Two global singletons are affected:

    1. ``csrf._exempt_blueprints`` – ``ExtensionsRestApi``'s blueprint
       gets CSRF-exempted during app init.
    2. ``DEFAULT_FEATURE_FLAGS`` – ``feature_flag_manager.init_app``
       mutates this dict in-place via ``dict.update``.

    Without cleanup the pollution leaks into later modules.
    """
    saved_csrf = frozenset(csrf._exempt_blueprints)
    saved_flags = copy.deepcopy(DEFAULT_FEATURE_FLAGS)
    yield
    csrf._exempt_blueprints -= csrf._exempt_blueprints - saved_csrf
    DEFAULT_FEATURE_FLAGS.clear()
    DEFAULT_FEATURE_FLAGS.update(saved_flags)
