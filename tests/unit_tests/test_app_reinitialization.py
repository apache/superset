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
singletons (``appbuilder``, ``security_manager``, the app Celery tasks run
under) at an app that is not the module's active ``current_app``. Keep this module to
tests that rebuild the app themselves; the next test module builds a fresh one.
"""

import gc
import weakref
from concurrent.futures import ThreadPoolExecutor

from celery import Task
from flask import current_app, Flask

from superset.app import SupersetApp
from superset.extensions import celery_app
from tests.unit_tests.conftest import build_app


def test_reinitializing_the_app_does_not_chain_celery_task_classes() -> None:
    """Re-initializing does not wrap the Celery task base a second time.

    ``configure_celery`` wraps the Celery task base in an ``AppContextTask``
    that pushes an app context. A second initialization must leave the
    installed wrapper in place rather than wrap it again, or the task class
    hierarchy grows by one level per initialization.
    """
    build_app()
    depth_after_first: int = len(celery_app.Task.__mro__)

    build_app()

    assert len(celery_app.Task.__mro__) == depth_after_first
    wrappers: list[type] = [
        cls
        for cls in celery_app.Task.__mro__
        if "_superset_app_context_task" in vars(cls)
    ]
    assert len(wrappers) == 1


def test_previous_app_is_collectable_after_reinitialization() -> None:
    """The app from a previous initialization is garbage-collectable."""
    first: SupersetApp = build_app()
    first_ref: weakref.ReferenceType[SupersetApp] = weakref.ref(first)

    build_app()
    del first
    gc.collect()

    retained: SupersetApp | None = first_ref()
    referrers: list[str] = sorted(
        {type(ref).__qualname__ for ref in gc.get_referrers(retained)}
    )
    assert retained is None, f"previous app still referenced by {referrers}"


def test_task_registered_under_a_previous_app_runs_under_the_current_app() -> None:
    """A task first used under an earlier app runs under the current app.

    Celery builds a task's class on first use, subclassing whatever
    ``celery_app.Task`` is at that moment, and keeps that class in the task
    registry for the rest of the process. The wrapper must therefore resolve
    the app when the task is called, not when the wrapper was installed:
    otherwise a task first used under an earlier app keeps that app alive
    and pushes its context, rather than the current app's, whenever it runs
    with no context active.
    """
    first: SupersetApp = build_app()
    first_ref: weakref.ReferenceType[SupersetApp] = weakref.ref(first)
    task_name: str = "tests.app_reinitialization.which_app"

    @celery_app.task(name=task_name)
    def which_app() -> Flask:
        return current_app._get_current_object()

    task: Task = celery_app.tasks[task_name]  # builds the task class under ``first``
    try:
        current: SupersetApp = build_app()

        # A fresh thread has no app context, so the wrapper has to push one.
        with ThreadPoolExecutor(max_workers=1) as pool:
            pushed: Flask = pool.submit(task).result()
        assert pushed is current

        del first
        gc.collect()
        assert first_ref() is None, "previous app kept alive by the task class"
    finally:
        celery_app.tasks.unregister(task_name)
