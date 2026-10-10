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
from click.testing import CliRunner
from pytest_mock import MockerFixture

from superset.cli import thumbnails


class _FakeModel:
    """Stand-in for a Dashboard/Slice that detaches mid-run.

    Once ``detached`` is set, ``str()`` raises -- mimicking the
    DetachedInstanceError that SQLAlchemy raises when the session that
    loaded the instance has been closed/expired.
    """

    def __init__(self, pk: int, label: str) -> None:
        self.id: int = pk
        self._label: str = label
        self.detached: bool = False

    def __str__(self) -> str:
        if self.detached:
            raise RuntimeError("Instance is not bound to a Session (simulated)")
        return self._label


def test_compute_thumbnails_survives_detached_instances(
    mocker: MockerFixture, app_context: None
) -> None:
    """Regression test for the DetachedInstanceError in compute-thumbnails.

    Computing a thumbnail can close/expire the session, detaching the ORM
    instances. The command must read each model's id and label *before* the
    compute loop, so building the progress message never touches a detached
    instance even when several models are processed.
    """
    models = [_FakeModel(1, "Dashboard A"), _FakeModel(2, "Dashboard B")]

    query = mocker.MagicMock()
    query.filter.return_value = query
    query.all.return_value = models
    db_mock = mocker.patch("superset.cli.thumbnails.db")
    db_mock.session.query.return_value = query

    def _detach_session(_url: object, _model_id: int, force: bool) -> None:
        # Computing a thumbnail expires the session -> every instance detaches.
        for model in models:
            model.detached = True

    cache_dashboard = mocker.patch(
        "superset.tasks.thumbnails.cache_dashboard_thumbnail",
        side_effect=_detach_session,
    )

    result = CliRunner().invoke(thumbnails.compute_thumbnails, ["-d"])

    assert result.exit_code == 0, result.output
    # Both dashboards were processed despite the simulated detachment...
    assert cache_dashboard.call_count == 2
    cache_dashboard.assert_any_call(None, 1, force=False)
    cache_dashboard.assert_any_call(None, 2, force=False)
    # ...and their labels were captured up front for the progress output.
    assert "Dashboard A" in result.output
    assert "Dashboard B" in result.output
