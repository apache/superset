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
Initializing a second Superset app in one process must replace the first.

The unit suite builds one app per test module, so a single pytest-xdist
worker initializes hundreds of apps. Anything that keeps an earlier app
reachable retains its views, routing rules, mappers and worker pools for the
rest of the worker's life, and the suite's memory then grows with the number
of modules until the CI runner is exhausted.

Each test here initializes throwaway apps, which repoints the process-wide
singletons (``appbuilder``, ``security_manager``, ``celery_app.Task``) at an
app that is not the module's active ``current_app``. Keep this module to
tests that rebuild the app themselves; the next test module builds a fresh one.
"""

import gc
import weakref

from superset.extensions import celery_app
from tests.unit_tests.conftest import build_app


def test_reinitializing_the_app_does_not_chain_celery_task_classes() -> None:
    """
    ``configure_celery`` wraps the Celery task base in an ``AppContextTask``
    that pushes its app's context. A second initialization must wrap the
    original base again, not wrap the previous wrapper, or every app ever
    initialized stays reachable through the task class hierarchy.
    """
    build_app()
    depth_after_first = len(celery_app.Task.__mro__)

    build_app()

    assert len(celery_app.Task.__mro__) == depth_after_first
    wrappers = [
        cls
        for cls in celery_app.Task.__mro__
        if "_superset_app_context_task" in vars(cls)
    ]
    assert len(wrappers) == 1


def test_previous_app_is_collectable_after_reinitialization() -> None:
    first = build_app()
    first_ref = weakref.ref(first)

    build_app()
    del first
    gc.collect()

    retained = first_ref()
    referrers = sorted({type(ref).__qualname__ for ref in gc.get_referrers(retained)})
    assert retained is None, f"previous app still referenced by {referrers}"
